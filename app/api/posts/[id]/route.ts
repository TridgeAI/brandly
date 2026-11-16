import { NextRequest, NextResponse } from "next/server";
import { errorResponse, requireSession } from "@/lib/db/session";
import { postToRow } from "@/lib/db/mappers";
import { editRatio } from "@/lib/edit-ratio";
import type { GeneratedPost, ScheduledPost } from "@/lib/types";

// Updates a post and records what changed as content_events, so quality can be measured:
// caption edits (with how much was rewritten, vs. the model's original), scheduling, publishing.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const updates = (await req.json()) as Partial<ScheduledPost>;
    const row = postToRow(updates);
    if (!Object.keys(row).length) return NextResponse.json({ ok: true });
    const s = await requireSession();

    const { data: before, error: readErr } = await s.db
      .from("posts")
      .select("content, original_content, status, scheduled_at, generation_id")
      .eq("id", id)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!before) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    const { error } = await s.db.from("posts").update(row).eq("id", id);
    if (error) throw error;

    const base = { post_id: id, workspace_id: s.workspaceId, user_id: s.userId, llm_call_id: before.generation_id };
    const events: Record<string, unknown>[] = [];
    if (updates.content && JSON.stringify(updates.content) !== JSON.stringify(before.content)) {
      const original = (before.original_content ?? before.content) as GeneratedPost;
      const changedFields = (Object.keys(updates.content) as (keyof GeneratedPost)[]).filter(
        (k) => JSON.stringify(updates.content![k]) !== JSON.stringify(original[k])
      );
      events.push({
        ...base,
        event: "edited",
        props: { edit_ratio: editRatio(original.caption ?? "", updates.content.caption ?? ""), fields: changedFields },
      });
    }
    if (updates.status && updates.status !== before.status && (updates.status === "scheduled" || updates.status === "published")) {
      events.push({ ...base, event: updates.status });
    } else if (updates.scheduledAt && before.scheduled_at && new Date(updates.scheduledAt).getTime() !== new Date(before.scheduled_at).getTime()) {
      events.push({ ...base, event: "rescheduled", props: { from: before.scheduled_at, to: updates.scheduledAt } });
    }
    if (events.length) {
      const { error: evErr } = await s.db.from("content_events").insert(events);
      if (evErr) console.warn("[content_events]", evErr.message);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, "post update");
  }
}

// Soft delete: the row stays as a "discarded" signal for quality analysis and is hidden from the app.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const s = await requireSession();
    const { error } = await s.db.from("posts").update({ status: "discarded" }).eq("id", id);
    if (error) throw error;
    await s.db.from("content_events").insert({ post_id: id, workspace_id: s.workspaceId, user_id: s.userId, event: "discarded" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, "post delete");
  }
}
