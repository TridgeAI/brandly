import { NextRequest, NextResponse } from "next/server";
import { LAYOUT_IDS, type BrandModel, type LayoutId } from "@/lib/brand/model";
import { chooseLayout, layoutNeedsPhoto } from "@/lib/content/brief";
import { recentPosts } from "@/lib/content/history";
import { errorResponse, requireSession } from "@/lib/db/session";
import { layoutKitOf } from "@/lib/render/kit";
import { encodeForUpload, generatePhoto, loadVisuals, resolvePhoto, storeRendered, type PhotoRef } from "@/lib/render/media";
import { renderPost, type RenderSize } from "@/lib/render/render";
import type { GeneratedPost, RenderedMedia } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  brandModel: BrandModel;
  post: GeneratedPost;
  /** Defaults to post.layout, then a layout chosen from the brand kit. */
  layout?: LayoutId;
  size?: RenderSize;
  /** Omit (or "auto") to choose a photo; "generate" for a new AI photo; null for none; or reuse an earlier choice. */
  photo?: PhotoRef | null | "auto" | "generate";
  /** Save to storage and return signed URLs (needs sign-in). Otherwise returns small JPEG previews. */
  store?: boolean;
  /** Folder name for stored images (usually the post id). */
  key?: string;
}

// Renders the post as the brand's own branded image(s): its fonts, colours, logo and layout kit.
export async function POST(req: NextRequest) {
  try {
    const b = (await req.json()) as Body;
    if (!b.brandModel?.expression || !b.post) return NextResponse.json({ error: "brandModel and post are required" }, { status: 400 });
    const model = b.brandModel;
    const size: RenderSize = b.size === "1080x1080" ? "1080x1080" : "1080x1350";
    const session = await requireSession();

    const kit = layoutKitOf(model)!;
    const history = await recentPosts(model.id, 15, session);
    const wanted = b.layout ?? b.post.layout;
    const layout: LayoutId =
      wanted && (LAYOUT_IDS as readonly string[]).includes(wanted)
        ? wanted
        : chooseLayout(kit, b.post.format, history, { carousel: (b.post.slides?.length ?? 0) >= 2 });

    const aspect = size === "1080x1080" ? "1:1" : "4:5";
    let photo: PhotoRef | undefined = typeof b.photo === "object" && b.photo ? b.photo : undefined;
    if (b.photo === "generate") photo = await generatePhoto(b.post, aspect);
    else if ((b.photo === undefined || b.photo === "auto") && layoutNeedsPhoto(layout)) photo = await resolvePhoto(model, b.post, history, aspect);

    const visuals = await loadVisuals(session, model, photo);
    const pngs = await renderPost({ model, post: b.post, layout, size, logo: visuals.logo, logoTone: visuals.logoTone, photo: visuals.photo });

    let rendered: RenderedMedia;
    if (b.store) {
      const key = (b.key ?? crypto.randomUUID()).replace(/[^\w-]/g, "").slice(0, 64) || crypto.randomUUID();
      const encoded = await Promise.all(pngs.map((p) => encodeForUpload(p)));
      const { paths, urls } = await storeRendered(session, model.id, key, encoded);
      rendered = { layout, paths, urls, size, photo };
    } else {
      const previews = await Promise.all(pngs.map((p) => encodeForUpload(p, 80)));
      rendered = { layout, paths: [], urls: previews.map((x) => `data:${x.mime};base64,${x.buf.toString("base64")}`), size, photo };
    }
    return NextResponse.json({ rendered, layouts: kit.layouts });
  } catch (err) {
    return errorResponse(err, "render-post");
  }
}
