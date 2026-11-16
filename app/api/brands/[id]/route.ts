import { NextRequest, NextResponse } from "next/server";
import { errorResponse, requireSession } from "@/lib/db/session";
import { saveBrandVersion, type VersionSource } from "@/lib/db/brands";
import { BRAND_SELECT, brandFromRow, type BrandRow } from "@/lib/db/mappers";
import type { BrandModel } from "@/lib/brand/model";
import type { Brand } from "@/lib/types";

const SOURCES: VersionSource[] = ["stage", "user", "build", "rollback"];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const s = await requireSession();
    const { data, error } = await s.db.from("brands").select(BRAND_SELECT).eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    return NextResponse.json({ brand: brandFromRow(data as unknown as BrandRow) });
  } catch (err) {
    return errorResponse(err, "brand get");
  }
}

// Saves the Brand Model as a new version. Body: { model, sources?, source?, stageId? }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as { model?: BrandModel; sources?: Brand["sources"]; source?: VersionSource; stageId?: string };
    if (!body.model || body.model.id !== id) return NextResponse.json({ error: "model with a matching id is required" }, { status: 400 });
    const source = body.source && SOURCES.includes(body.source) ? body.source : "user";
    const s = await requireSession();
    const result = await saveBrandVersion(s, body.model, { sources: body.sources, source, stageId: body.stageId });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err, "brand save");
  }
}

// Deletes the brand; posts, rules, versions and evidence go with it (FK cascade).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const s = await requireSession();
    const { error } = await s.db.from("brands").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, "brand delete");
  }
}
