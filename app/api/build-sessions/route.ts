import { NextRequest, NextResponse } from "next/server";
import { errorResponse, requireSession } from "@/lib/db/session";

// Build door: every direction that was shown and the one picked (pairwise preference data).
export async function POST(req: NextRequest) {
  try {
    const b = (await req.json()) as { brandId?: string; answers?: unknown; directions?: unknown[]; selectedIndex?: number };
    if (!b.brandId) return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    const s = await requireSession();
    const { error } = await s.db.from("build_sessions").insert({
      brand_id: b.brandId,
      workspace_id: s.workspaceId,
      answers: b.answers ?? {},
      directions: b.directions ?? [],
      selected_index: b.selectedIndex ?? null,
      selected_at: b.selectedIndex != null ? new Date().toISOString() : null,
      created_by: s.userId,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, "build session");
  }
}
