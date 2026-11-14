import { NextRequest, NextResponse } from "next/server";
import { errorResponse, requireSession } from "@/lib/db/session";
import { postToRow } from "@/lib/db/mappers";
import type { ScheduledPost } from "@/lib/types";

// Body: { post, template?, topic? }. original_content is stored once and never changes,
// so later edits can be measured against what the model wrote.
export async function POST(req: NextRequest) {
  try {
    const { post, template, topic } = (await req.json()) as { post?: ScheduledPost; template?: string; topic?: string };
    if (!post?.id || !post.brandId || !post.content) return NextResponse.json({ error: "post with id, brandId and content is required" }, { status: 400 });
    const s = await requireSession();
    const { error } = await s.db.from("posts").insert({
      ...postToRow(post),
      id: post.id,
      brand_id: post.brandId,
      workspace_id: s.workspaceId, // replaced by the brand's workspace in a trigger
      original_content: post.content,
      generation_id: post.generationId ?? null,
      template: template ?? null,
      topic: topic ?? null,
      created_by: s.userId,
    });
    if (error) throw error;
    // Saving a generation is itself a signal: kept as a draft, or scheduled straight away.
    await s.db.from("content_events").insert({
      post_id: post.id,
      workspace_id: s.workspaceId,
      user_id: s.userId,
      llm_call_id: post.generationId ?? null,
      event: post.status === "scheduled" ? "scheduled" : "generated",
      props: { template, platforms: post.platforms },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, "post create");
  }
}
