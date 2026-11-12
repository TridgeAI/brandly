import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { dedupeColors, hexToHsl } from "./brand/color";

const UA = "Mozilla/5.0 (compatible; BrandlyBot/1.0; +https://brandly.app/bot)";
const MAX_HTML_BYTES = 1_500_000;
const MAX_CSS_BYTES = 400_000;

// ── SSRF guard ─────────────────────────────────────────────────────────────
function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) {
    const v6 = ip.toLowerCase();
    if (v6.startsWith("::ffff:")) return isPrivateIp(v6.slice(7));
    return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

/** Normalises a user-typed URL and rejects anything that isn't a public http(s) address. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  const withScheme = /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`;
  const url = new URL(withScheme);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http and https links are supported.");
  if (url.username || url.password) throw new Error("Links with passwords are not supported.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("That address isn't public.");
  const ips = isIP(host) ? [host] : (await lookup(host, { all: true })).map((r) => r.address);
  if (!ips.length || ips.some(isPrivateIp)) throw new Error("That address isn't public.");
  return url;
}

async function fetchCapped(url: string, maxBytes: number, timeoutMs = 15_000): Promise<{ text: string; finalUrl: string } | null> {
  const safe = await assertPublicUrl(url);
  const res = await fetch(safe, {
    headers: { "User-Agent": UA, Accept: "text/html,text/css,*/*;q=0.8" },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok || !res.body) return null;
  // Re-check where redirects landed.
  await assertPublicUrl(res.url);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  reader.cancel().catch(() => {});
  return { text: new TextDecoder().decode(Buffer.concat(chunks.map((c) => Buffer.from(c)))), finalUrl: res.url };
}

const stripTags = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

/** Fetches a web page and returns its visible text (used by the automation fallback). */
export async function fetchWebsiteContent(url: string): Promise<string | null> {
  try {
    const page = await fetchCapped(url, MAX_HTML_BYTES, 20_000);
    return page ? stripTags(page.text) : null;
  } catch (error) {
    console.error(`Error fetching ${url}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

// ── Brand evidence extraction ──────────────────────────────────────────────
export interface WebsiteEvidence {
  url: string;
  title: string;
  description: string;
  themeColor?: string;
  logoUrl?: string;
  ogImage?: string;
  colors: string[]; // by frequency, grays removed
  fonts: string[];
  headings: string[];
  copySample: string;
  stylesheetsRead: number;
}

const attr = (tag: string, name: string) => tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1];

function metaContent(html: string, key: string): string | undefined {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const k = attr(tag, "property") ?? attr(tag, "name");
    if (k?.toLowerCase() === key) return attr(tag, "content");
  }
  return undefined;
}

const GENERIC_FONTS = new Set([
  "sans-serif", "serif", "monospace", "system-ui", "inherit", "initial", "cursive", "fantasy", "ui-sans-serif",
  "ui-serif", "ui-monospace", "-apple-system", "blinkmacsystemfont", "segoe ui", "roboto", "helvetica", "helvetica neue",
  "arial", "noto sans", "apple color emoji", "segoe ui emoji", "segoe ui symbol", "noto color emoji", "var", "unset",
]);

function countColors(css: string): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (hex: string, n = 1) => counts.set(hex, (counts.get(hex) ?? 0) + n);
  for (const m of css.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
    let h = m[1].toLowerCase();
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    add(`#${h.toUpperCase()}`);
  }
  for (const m of css.matchAll(/rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/gi)) {
    const hex = "#" + [m[1], m[2], m[3]].map((v) => Math.min(255, +v).toString(16).padStart(2, "0")).join("").toUpperCase();
    add(hex);
  }
  // Brand-named custom properties count extra.
  for (const m of css.matchAll(/--[\w-]*(?:brand|primary|accent|main|theme)[\w-]*\s*:\s*(#[0-9a-f]{3,6})\b/gi)) {
    let h = m[1].slice(1).toLowerCase();
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    add(`#${h.toUpperCase()}`, 8);
  }
  return counts;
}

function extractFonts(html: string, css: string): string[] {
  const fonts = new Map<string, number>();
  const add = (f: string, n = 1) => {
    const name = f.trim().replace(/^["']|["']$/g, "").trim();
    if (!name || GENERIC_FONTS.has(name.toLowerCase()) || name.startsWith("var(") || name.length > 40) return;
    fonts.set(name, (fonts.get(name) ?? 0) + n);
  };
  for (const m of html.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'>\s]+)/gi)) {
    for (const fam of decodeURIComponent(m[1]).matchAll(/family=([^:&;]+)/g)) add(fam[1].replace(/\+/g, " "), 10);
  }
  for (const m of css.matchAll(/font-family\s*:\s*([^;}{]+)/gi)) {
    const first = m[1].split(",")[0];
    add(first);
  }
  return [...fonts.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f).slice(0, 4);
}

export async function fetchWebsiteEvidence(rawUrl: string): Promise<WebsiteEvidence> {
  const page = await fetchCapped(rawUrl, MAX_HTML_BYTES, 20_000);
  if (!page) throw new Error("The website didn't respond. Check the link and try again.");
  const { text: html, finalUrl } = page;
  const base = new URL(finalUrl);
  const abs = (href?: string) => {
    if (!href) return undefined;
    try {
      return new URL(href, base).toString();
    } catch {
      return undefined;
    }
  };

  // Inline CSS + style attributes + up to 3 same-site stylesheets.
  let css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
  css += "\n" + [...html.matchAll(/style\s*=\s*"([^"]*)"/gi)].map((m) => m[1]).join(";");
  const sheetLinks = (html.match(/<link\b[^>]*>/gi) ?? [])
    .filter((t) => /rel\s*=\s*["']?stylesheet/i.test(t))
    .map((t) => abs(attr(t, "href")))
    .filter((u): u is string => !!u && !/fonts\.googleapis/.test(u))
    .slice(0, 3);
  let stylesheetsRead = 0;
  await Promise.all(
    sheetLinks.map(async (u) => {
      try {
        const sheet = await fetchCapped(u, MAX_CSS_BYTES, 10_000);
        if (sheet) {
          css += "\n" + sheet.text;
          stylesheetsRead++;
        }
      } catch {
        /* skip unreadable stylesheet */
      }
    })
  );

  const counts = countColors(css);
  const ranked = [...counts.entries()]
    .filter(([hex]) => {
      const { s, l } = hexToHsl(hex);
      return s >= 0.12 && l > 0.06 && l < 0.95;
    })
    .sort((a, b) => b[1] - a[1])
    .map(([hex]) => hex);
  const themeColor = metaContent(html, "theme-color");
  const themeIsBrand = themeColor && hexToHsl(themeColor).s >= 0.12;
  const colors = dedupeColors([...(themeIsBrand ? [themeColor] : []), ...ranked]).slice(0, 6);

  const icons = (html.match(/<link\b[^>]*>/gi) ?? []).filter((t) => /rel\s*=\s*["'][^"']*(icon|apple-touch-icon)/i.test(t));
  const appleIcon = icons.find((t) => /apple-touch-icon/i.test(t));
  const logoImg = (html.match(/<img\b[^>]*>/gi) ?? []).find((t) => /logo/i.test(t));
  const logoUrl = abs(logoImg ? attr(logoImg, "src") : undefined) ?? abs(appleIcon ? attr(appleIcon, "href") : undefined) ?? abs(icons[0] ? attr(icons[0], "href") : undefined);

  const headings = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    .map((m) => stripTags(m[1]))
    .filter((h) => h.length > 2 && h.length < 160)
    .slice(0, 12);

  return {
    url: finalUrl,
    title: stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ""),
    description: metaContent(html, "description") ?? metaContent(html, "og:description") ?? "",
    themeColor,
    logoUrl,
    ogImage: abs(metaContent(html, "og:image")),
    colors,
    fonts: extractFonts(html, css),
    headings,
    copySample: stripTags(html).slice(0, 5000),
    stylesheetsRead,
  };
}
