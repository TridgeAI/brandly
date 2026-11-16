import "server-only";
import { createHash } from "node:crypto";
import type { Session } from "@/lib/db/session";
import { downloadAsJpeg } from "@/lib/render/assets";
import { assertPublicUrl } from "@/lib/web";
import type { BrandModel, BrandPhoto } from "./model";

export const MAX_BRAND_PHOTOS = 24;
const MIN_SIDE = 400;

const hash = (s: string | Buffer) => createHash("sha256").update(s).digest("hex").slice(0, 16);

async function brandExists(s: Session, brandId: string): Promise<boolean> {
  const { data } = await s.db.from("brands").select("id").eq("id", brandId).maybeSingle();
  return !!data;
}

async function record(s: Session, brandId: string, kind: "image" | "logo", path: string, bytes: number, mime: string, sourceUrl?: string) {
  // The brand row may not exist yet during onboarding; the asset is still kept (brand_id null).
  const withBrand = await brandExists(s, brandId);
  const { error } = await s.db.from("media_assets").insert({
    workspace_id: s.workspaceId,
    brand_id: withBrand ? brandId : null,
    kind,
    storage_path: path,
    mime,
    bytes,
    source_url: sourceUrl ?? null,
    created_by: s.userId,
  });
  if (error) console.warn("[media_assets]", error.message);
}

/** Saves one image (bytes) as a brand photo. */
export async function saveBrandPhoto(s: Session, brandId: string, buf: Buffer, source: BrandPhoto["source"], sourceUrl?: string): Promise<BrandPhoto> {
  const path = `${s.workspaceId}/brands/${brandId}/photos/${hash(buf)}.jpg`;
  const { error } = await s.db.storage.from("images").upload(path, buf, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`Couldn't save the photo: ${error.message}`);
  await record(s, brandId, "image", path, buf.byteLength, "image/jpeg", sourceUrl);
  return { path, sourceUrl, source, addedAt: new Date().toISOString() };
}

/** Downloads website images and keeps the ones big enough to use in posts. */
export async function importBrandPhotos(s: Session, brandId: string, urls: string[], source: BrandPhoto["source"], max = 12): Promise<BrandPhoto[]> {
  const out: BrandPhoto[] = [];
  for (const url of urls.slice(0, max * 2)) {
    if (out.length >= max) break;
    const img = await downloadAsJpeg(url);
    if (!img || (img.width ?? 0) < MIN_SIDE || (img.height ?? 0) < MIN_SIDE) continue;
    try {
      out.push(await saveBrandPhoto(s, brandId, img.buf, source, url));
    } catch (err) {
      console.warn("[brand photos]", err instanceof Error ? err.message : err);
    }
  }
  return out;
}

/** Copies the logo into the logos bucket so renders don't depend on the website. */
export async function storeLogo(s: Session, brandId: string, url: string): Promise<string | undefined> {
  try {
    const res = await fetch(await assertPublicUrl(url), { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return undefined;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > 5_000_000) return undefined;
    const mime = res.headers.get("content-type")?.split(";")[0] || "image/png";
    const ext = mime.includes("svg") ? "svg" : mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : mime.includes("icon") ? "ico" : "png";
    const path = `${s.workspaceId}/brands/${brandId}/logo-${hash(buf)}.${ext}`;
    const { error } = await s.db.storage.from("logos").upload(path, buf, { contentType: mime, upsert: true });
    if (error) throw error;
    await record(s, brandId, "logo", path, buf.byteLength, mime, url);
    return path;
  } catch (err) {
    console.warn("[logo]", err instanceof Error ? err.message : err);
    return undefined;
  }
}

/**
 * After an analyse/refine run: store found photos and the logo, and add them to the model.
 * Existing photos are kept; duplicates (same source URL) are skipped.
 */
export async function attachSourceMedia(
  s: Session,
  model: BrandModel,
  found: { photoUrls?: string[]; screenshots?: string[]; logoUrl?: string }
): Promise<BrandModel> {
  const have = model.expression.photos ?? [];
  const room = Math.max(0, Math.min(12, MAX_BRAND_PHOTOS - have.length));
  const known = new Set(have.map((p) => p.sourceUrl).filter(Boolean));
  const urls = (found.photoUrls ?? []).filter((u) => !known.has(u));
  const fromSite = room ? await importBrandPhotos(s, model.id, urls, "website", room) : [];
  const shots: BrandPhoto[] = [];
  for (const b64 of (found.screenshots ?? []).slice(0, Math.max(0, room - fromSite.length))) {
    try {
      shots.push(await saveBrandPhoto(s, model.id, Buffer.from(b64, "base64"), "instagram"));
    } catch (err) {
      console.warn("[brand photos]", err instanceof Error ? err.message : err);
    }
  }
  const logoUrl = found.logoUrl ?? model.expression.logoUrl;
  const logoPath = logoUrl && !model.expression.logoPath ? await storeLogo(s, model.id, logoUrl) : undefined;
  if (!fromSite.length && !shots.length && !logoPath) return model;
  return {
    ...model,
    expression: {
      ...model.expression,
      photos: [...have, ...fromSite, ...shots],
      ...(logoPath ? { logoPath } : {}),
    },
  };
}
