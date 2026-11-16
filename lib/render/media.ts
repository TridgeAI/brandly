import "server-only";
import type { BrandModel } from "@/lib/brand/model";
import type { Session } from "@/lib/db/session";
import type { ContentHistory } from "@/lib/content/history";
import { n8nEnabled, n8nRequest } from "@/lib/n8n";
import type { GeneratedPost, RenderedMedia } from "@/lib/types";
import { imageFromStorage, imageFromUrl, imageTone } from "./assets";
import { layoutKitOf } from "./kit";

export type PhotoRef = NonNullable<RenderedMedia["photo"]>;

/** Brand photo for this post: least recently used one first (Phase 3b). */
export function pickBrandPhoto(model: BrandModel, history: ContentHistory): PhotoRef | undefined {
  const photos = model.expression.photos ?? [];
  if (!photos.length) return undefined;
  const lastUse = (path: string) => {
    const i = history.posts.findIndex((p) => p.photoPath === path);
    return i < 0 ? Infinity : i; // larger = longer ago
  };
  const best = [...photos].sort((a, b) => lastUse(b.path) - lastUse(a.path))[0];
  return { kind: "brand", ref: best.path };
}

/** Generated photo through the n8n image workflow, from the post's visual brief. */
export async function generatePhoto(post: GeneratedPost, aspect: "4:5" | "1:1"): Promise<PhotoRef | undefined> {
  if (!n8nEnabled() || !post.imagePrompt) return undefined;
  const { status, data } = await n8nRequest("generate-image", { prompt: post.imagePrompt, aspect, styled: true });
  if (status >= 400 || typeof data.imageUrl !== "string") {
    console.warn("[render] image generation failed", data.error);
    return undefined;
  }
  return { kind: "generated", ref: data.imageUrl };
}

/** Chooses where the photo comes from: a real brand photo when it fits, else a generated one. */
export async function resolvePhoto(model: BrandModel, post: GeneratedPost, history: ContentHistory, aspect: "4:5" | "1:1"): Promise<PhotoRef | undefined> {
  const brand = pickBrandPhoto(model, history);
  if (brand && post.visualBrief?.usesProductPhoto) return brand;
  return (await generatePhoto(post, aspect)) ?? brand;
}

/** Loads the photo and logo as data URIs for Satori. */
export async function loadVisuals(session: Session | null, model: BrandModel, photo: PhotoRef | undefined) {
  const kit = layoutKitOf(model)!;
  const duotone = kit.photoTreatment === "duotone" ? model.expression.tokens.color.primary.$value : undefined;
  const [photoUri, logoUri] = await Promise.all([
    !photo
      ? undefined
      : photo.kind === "brand"
      ? session
        ? imageFromStorage(session.db, "images", photo.ref, { maxSide: 1400, duotone })
        : undefined
      : imageFromUrl(photo.ref, { maxSide: 1400, duotone }),
    model.expression.logoPath && session
      ? imageFromStorage(session.db, "logos", model.expression.logoPath, { maxSide: 512, keepAlpha: true })
      : imageFromUrl(model.expression.logoUrl, { maxSide: 512, keepAlpha: true }),
  ]);
  return { photo: photoUri, logo: logoUri, logoTone: await imageTone(logoUri) };
}

const SIGN_SECONDS = 60 * 60 * 24 * 30;

export interface EncodedImage {
  buf: Buffer;
  mime: "image/png" | "image/jpeg";
}

/** PNG from Satori → JPEG (much smaller, accepted by every network). Keeps PNG if sharp is missing. */
export async function encodeForUpload(png: Buffer, quality = 90): Promise<EncodedImage> {
  try {
    const sharp = (await import("sharp")).default;
    return { buf: await sharp(png).jpeg({ quality, mozjpeg: true }).toBuffer(), mime: "image/jpeg" };
  } catch {
    return { buf: png, mime: "image/png" };
  }
}

/** Uploads rendered images to the images bucket and records them as media assets. */
export async function storeRendered(s: Session, brandId: string, key: string, images: EncodedImage[]): Promise<{ paths: string[]; urls: string[] }> {
  const paths = images.map((img, i) => `${s.workspaceId}/brands/${brandId}/posts/${key}/${i + 1}.${img.mime === "image/png" ? "png" : "jpg"}`);
  await Promise.all(
    images.map(async (img, i) => {
      const { error } = await s.db.storage.from("images").upload(paths[i], img.buf, { contentType: img.mime, upsert: true });
      if (error) throw new Error(`Couldn't save the image: ${error.message}`);
    })
  );
  const { error: maErr } = await s.db.from("media_assets").insert(
    images.map((img, i) => ({
      workspace_id: s.workspaceId,
      brand_id: brandId,
      kind: "image",
      storage_path: paths[i],
      mime: img.mime,
      bytes: img.buf.byteLength,
      created_by: s.userId,
    }))
  );
  if (maErr) console.warn("[media_assets]", maErr.message);
  return { paths, urls: await signPaths(s, "images", paths) };
}

export async function signPaths(s: Session, bucket: string, paths: string[], seconds = SIGN_SECONDS): Promise<string[]> {
  if (!paths.length) return [];
  const { data, error } = await s.db.storage.from(bucket).createSignedUrls(paths, seconds);
  if (error || !data) throw new Error(`Couldn't sign image links: ${error?.message}`);
  return data.map((d) => d.signedUrl ?? "");
}
