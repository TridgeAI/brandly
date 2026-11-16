import { NextRequest, NextResponse } from "next/server";
import { errorResponse, requireSession } from "@/lib/db/session";

// Version history (newest first), without the full models. ?version=N returns that version's model.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const s = await requireSession();
    const v = req.nextUrl.searchParams.get("version");
    if (v) {
      const { data, error } = await s.db
        .from("brand_versions")
        .select("id, version, model, source, created_at")
        .eq("brand_id", id)
        .eq("version", Number(v))
        .maybeSingle();
      if (error) throw error;
      return data ? NextResponse.json({ version: data }) : NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
    const { data, error } = await s.db
      .from("brand_versions")
      .select("id, version, source, stage_id, changed_paths, created_at, created_by")
      .eq("brand_id", id)
      .order("version", { ascending: false })
      .limit(100);
    if (error) throw error;
    return NextResponse.json({ versions: data });
  } catch (err) {
    return errorResponse(err, "brand versions");
  }
}
