import "server-only";
import { assertPublicUrl } from "@/lib/web";
import { hexToRgb } from "@/lib/brand/color";
import type { Db } from "@/lib/db/session";

// Satori decodes PNG, JPEG and SVG only, so everything else (WebP, AVIF, GIF) goes
// through sharp. sharp ships with Next.js; if it is missing, those images are skipped.
type Sharp = typeof import("sharp").default;
let sharpMod: Sharp | null | undefined;
async function getSharp(): Promise<Sharp | null> {
  if (sharpMod !== undefined) return sharpMod;
  try {
    sharpMod = (await import("sharp")).default;
  } catch {
    sharpMod = null;
  }
  return sharpMod;
}

const MAX_BYTES = 12_000_000;

async function fetchBytes(url: string): Promise<{ buf: Buffer; type: string } | null> {
  if (url.startsWith("data:")) {
    const m = url.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/);
    if (!m) return null;
    return { buf: m[2] ? Buffer.from(m[3], "base64") : Buffer.from(decodeURIComponent(m[3])), type: m[1] ?? "" };
  }
  const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host : "";
  const target = new URL(url);
  if (target.host !== supabaseHost) await assertPublicUrl(url);
  const res = await fetch(target, { signal: AbortSignal.timeout(20_000), headers: { "User-Agent": "Mozilla/5.0 (compatible; BrandlyBot/1.0)" } });
  if (!res.ok) return null;
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) return null;
  return { buf, type: res.headers.get("content-type")?.split(";")[0] ?? "" };
}

const toDataUri = (buf: Buffer, type: string) => `data:${type};base64,${buf.toString("base64")}`;

export interface ImageOptions {
  /** Longest side after resizing. */
  maxSide?: number;
  /** Tint a greyscale copy with this colour (duotone treatment). */
  duotone?: string;
  /** Keep transparency (logos). */
  keepAlpha?: boolean;
}

/** Turns image bytes into a data URI Satori can draw. Returns undefined for unusable images. */
export async function toRenderable(input: { buf: Buffer; type: string }, opts: ImageOptions = {}): Promise<string | undefined> {
  const { buf, type } = input;
  const isSvg = type.includes("svg") || buf.subarray(0, 200).toString("utf8").includes("<svg");
  const sharp = await getSharp();
  if (!sharp) {
    if (isSvg) return toDataUri(buf, "image/svg+xml");
    if (/png|jpe?g/.test(type) && !opts.duotone) return toDataUri(buf, type);
    return undefined;
  }
  try {
    let img = sharp(buf, { density: isSvg ? 300 : undefined, animated: false }).rotate();
    const max = opts.maxSide ?? 1600;
    img = img.resize({ width: max, height: max, fit: "inside", withoutEnlargement: !isSvg });
    if (opts.duotone) {
      const [r, g, b] = hexToRgb(opts.duotone);
      img = img.grayscale().tint({ r, g, b });
    }
    if (opts.keepAlpha) return toDataUri(await img.png().toBuffer(), "image/png");
    return toDataUri(await img.flatten({ background: "#ffffff" }).jpeg({ quality: 86 }).toBuffer(), "image/jpeg");
  } catch {
    return undefined; // ICO and other formats sharp can't read
  }
}

export async function imageFromUrl(url: string | undefined, opts: ImageOptions = {}): Promise<string | undefined> {
  if (!url) return undefined;
  try {
    const bytes = await fetchBytes(url);
    return bytes ? toRenderable(bytes, opts) : undefined;
  } catch (err) {
    console.warn("[render] image fetch failed", url.slice(0, 120), err instanceof Error ? err.message : err);
    return undefined;
  }
}

export async function imageFromStorage(db: Db, bucket: string, path: string | undefined, opts: ImageOptions = {}): Promise<string | undefined> {
  if (!path) return undefined;
  const { data, error } = await db.storage.from(bucket).download(path);
  if (error || !data) {
    console.warn("[render] storage download failed", bucket, path, error?.message);
    return undefined;
  }
  return toRenderable({ buf: Buffer.from(await data.arrayBuffer()), type: data.type }, opts);
}

/** Raw bytes of a remote image, re-encoded as JPEG for storage (brand photos). */
export async function downloadAsJpeg(url: string, maxSide = 1600): Promise<{ buf: Buffer; width?: number; height?: number } | null> {
  try {
    const bytes = await fetchBytes(url);
    if (!bytes) return null;
    const sharp = await getSharp();
    if (!sharp) return /jpe?g/.test(bytes.type) ? { buf: bytes.buf } : null;
    const img = sharp(bytes.buf, { animated: false }).rotate();
    const meta = await img.metadata();
    const out = await img.resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 85 }).toBuffer();
    return { buf: out, width: meta.width, height: meta.height };
  } catch {
    return null;
  }
}

/** Average tone of an image's visible (non-transparent) pixels. */
export async function imageTone(dataUri: string | undefined): Promise<"light" | "dark" | undefined> {
  if (!dataUri?.startsWith("data:")) return undefined;
  const sharp = await getSharp();
  if (!sharp) return undefined;
  try {
    const buf = Buffer.from(dataUri.split(",")[1], "base64");
    const { data, info } = await sharp(buf).resize(64, 64, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let sum = 0;
    let weight = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      const a = data[i + 3] / 255;
      if (a < 0.1) continue;
      sum += ((0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255) * a;
      weight += a;
    }
    return weight ? (sum / weight > 0.6 ? "light" : "dark") : undefined;
  } catch {
    return undefined;
  }
}
