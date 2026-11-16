import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_REDIRECTS = 5;

function isPrivateV4(a: number, b: number, c: number): boolean {
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && c === 0) || // 192.0.0.0/24
    (a === 198 && (b === 18 || b === 19)) || // 198.18.0.0/15
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

/** Expands an IPv6 address into 8 16-bit groups, or null if it can't be parsed. */
function expandV6(ip: string): number[] | null {
  let s = ip.toLowerCase().split("%")[0];
  // Embedded dotted IPv4 tail (::ffff:1.2.3.4) -> two hex groups.
  const dotted = s.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const p = dotted[2].split(".").map(Number);
    if (p.some((n) => !(n >= 0 && n <= 255))) return null;
    s = `${dotted[1]}${((p[0] << 8) | p[1]).toString(16)}:${((p[2] << 8) | p[3]).toString(16)}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 0) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...tail].map((g) => parseInt(g, 16));
  return groups.length === 8 && groups.every((g) => Number.isInteger(g) && g >= 0 && g <= 0xffff) ? groups : null;
}

export function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) {
    const g = expandV6(ip);
    if (!g) return true; // unparseable: fail closed
    const v4 = (hi: number, lo: number) => isPrivateV4(hi >> 8, hi & 255, lo >> 8);
    if (g.every((x) => x === 0)) return true; // ::
    if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true; // ::1
    if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return v4(g[6], g[7]); // ::ffff:a.b.c.d (any form)
    if (g.slice(0, 6).every((x) => x === 0)) return v4(g[6], g[7]); // deprecated IPv4-compatible ::a.b.c.d
    if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return v4(g[6], g[7]); // NAT64 64:ff9b::/96
    if (g[0] === 0x2002) return v4(g[1], g[2]); // 6to4 embeds an IPv4 address
    if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
    if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link local
    if ((g[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 site local
    if ((g[0] & 0xff00) === 0xff00) return true; // multicast
    return false;
  }
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !(n >= 0 && n <= 255))) return true;
  return isPrivateV4(p[0], p[1], p[2]);
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

/**
 * fetch() that validates every hop: the start URL and each redirect target are
 * checked with assertPublicUrl *before* being requested.
 * Known limit: the hostname is resolved again by fetch, so DNS rebinding between
 * check and request is not fully closed (needs an IP-pinned dispatcher).
 */
export async function safeFetch(rawUrl: string, init: RequestInit = {}): Promise<Response> {
  let url = await assertPublicUrl(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(url, { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      res.body?.cancel().catch(() => {});
      url = await assertPublicUrl(new URL(res.headers.get("location")!, url).toString());
      continue;
    }
    return res;
  }
  throw new Error("Too many redirects.");
}
