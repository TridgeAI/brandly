import { NextRequest, NextResponse } from "next/server";
import { errorResponse, requireSession } from "@/lib/db/session";

// Explicit feedback on a generation. Body: { postId?, generationId?, rating (-1 | 1, or 1-5), reasons?, comment? }
export async function POST(req: NextRequest) {
  try {
    const b = (await req.json()) as { postId?: string; generationId?: string; rating?: number; reasons?: string[]; comment?: string };
    if (!b.postId && !b.generationId) return NextResponse.json({ error: "postId or generationId is required" }, { status: 400 });
    if (typeof b.rating !== "number" || b.rating < -1 || b.rating > 5) return NextResponse.json({ error: "rating must be between -1 and 5" }, { status: 400 });
    const s = await requireSession();
    const { error } = await s.db.from("generation_feedback").insert({
      workspace_id: s.workspaceId,
      post_id: b.postId ?? null,
      llm_call_id: b.generationId ?? null,
      user_id: s.userId,
      rating: Math.round(b.rating),
      reasons: (b.reasons ?? []).slice(0, 10),
      comment: b.comment?.slice(0, 2000) ?? null,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, "feedback");
  }
}
