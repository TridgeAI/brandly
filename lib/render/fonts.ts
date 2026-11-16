import "server-only";

// Satori (next/og) needs TTF/OTF data; it can't read woff2. Google Fonts' CSS API
// returns TrueType links when the request has no browser User-Agent.
export interface FontData {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700;
  style: "normal";
}

const cache = new Map<string, Promise<FontData[]>>();

async function fetchCss(family: string, weights: string): Promise<string | null> {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}${weights}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "Brandly/1.0" } });
  return res.ok ? res.text() : null;
}

async function load(family: string): Promise<FontData[]> {
  // Ask for regular + bold; some families only have one weight.
  const css = (await fetchCss(family, ":wght@400;700")) ?? (await fetchCss(family, ""));
  if (!css) return [];
  const faces = [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map((m) => m[1]);
  const out: FontData[] = [];
  const seen = new Set<number>();
  for (const face of faces) {
    const src = face.match(/src:\s*url\(([^)]+)\)\s*format\(['"]?(truetype|opentype)['"]?\)/)?.[1];
    const weight = Number(face.match(/font-weight:\s*(\d+)/)?.[1] ?? 400) >= 600 ? 700 : 400;
    // Latin subset is listed last when there are several; keep the first per weight that loads.
    if (!src || seen.has(weight)) continue;
    const r = await fetch(src, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) continue;
    out.push({ name: family, data: await r.arrayBuffer(), weight, style: "normal" });
    seen.add(weight);
  }
  // Use the regular file for bold too (Satori fakes nothing; this avoids a missing-weight fallback).
  if (out.length === 1) out.push({ ...out[0], weight: out[0].weight === 400 ? 700 : 400 });
  return out;
}

function loadCached(family: string): Promise<FontData[]> {
  const key = family.trim().toLowerCase();
  if (!cache.has(key)) {
    const p = load(family.trim()).catch(() => [] as FontData[]);
    cache.set(key, p);
    // Don't keep failures forever (network blips).
    p.then((f) => !f.length && setTimeout(() => cache.delete(key), 60_000));
  }
  return cache.get(key)!;
}

/**
 * Loads the brand's heading and body fonts. Falls back to Inter when a font
 * isn't on Google Fonts. Returns the family names to use in layouts.
 */
export async function brandFonts(heading: string, body: string): Promise<{ fonts: FontData[]; heading: string; body: string }> {
  const [h, b, inter] = await Promise.all([loadCached(heading || "Inter"), loadCached(body || "Inter"), loadCached("Inter")]);
  const fonts = [...h, ...b, ...inter];
  const dedup = fonts.filter((f, i) => fonts.findIndex((x) => x.name === f.name && x.weight === f.weight) === i);
  return { fonts: dedup, heading: h.length ? heading : "Inter", body: b.length ? body : "Inter" };
}
