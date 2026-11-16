import { NextRequest, NextResponse } from "next/server";
import { errorResponse, requireSession } from "@/lib/db/session";
import { saveBrandPhoto } from "@/lib/brand/photos";
import { signPaths } from "@/lib/render/media";
import { toRenderable } from "@/lib/render/assets";

// Brand photos live in the `images` bucket under <workspace>/brands/<brand>/photos/.
// The list itself is part of the Brand Model (expression.photos), saved by the client.

const ownPath = (ws: string, brandId: string, path: string) => path.startsWith(`${ws}/brands/${brandId}/photos/`) && !path.includes("..");

/** GET ?path=…&path=… → signed URLs for display. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const s = await requireSession();
    const paths = req.nextUrl.searchParams.getAll("path").filter((p) => ownPath(s.workspaceId, id, p)).slice(0, 50);
    const urls = await signPaths(s, "images", paths, 60 * 60);
    return NextResponse.json({ photos: paths.map((path, i) => ({ path, url: urls[i] })) });
  } catch (err) {
    return errorResponse(err, "brand photos list");
  }
}

/** POST multipart (field "file") → { photo, url }. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const s = await requireSession();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Add an image file." }, { status: 400 });
    if (file.size > 15_000_000) return NextResponse.json({ error: "That image is over 15 MB." }, { status: 400 });
    const jpeg = await toRenderable({ buf: Buffer.from(await file.arrayBuffer()), type: file.type }, { maxSide: 1600 });
    if (!jpeg) return NextResponse.json({ error: "That file isn't an image Brandly can read." }, { status: 400 });
    const photo = await saveBrandPhoto(s, id, Buffer.from(jpeg.split(",")[1], "base64"), "upload");
    const [url] = await signPaths(s, "images", [photo.path], 60 * 60);
    return NextResponse.json({ photo, url });
  } catch (err) {
    return errorResponse(err, "brand photo upload");
  }
}

/** DELETE ?path=… removes the stored file (the client removes it from the model). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const s = await requireSession();
    const path = req.nextUrl.searchParams.get("path") ?? "";
    if (!ownPath(s.workspaceId, id, path)) return NextResponse.json({ error: "Unknown photo" }, { status: 400 });
    const { error } = await s.db.storage.from("images").remove([path]);
    if (error) throw error;
    await s.db.from("media_assets").delete().eq("storage_path", path);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, "brand photo delete");
  }
}
