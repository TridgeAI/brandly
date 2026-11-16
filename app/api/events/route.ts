import { NextRequest, NextResponse } from "next/server";
import { errorResponse, requireSession } from "@/lib/db/session";

const CONTENT_EVENTS = new Set([
  "generated", "regenerated", "edited", "copied", "scheduled", "rescheduled",
  "published", "discarded", "variant_selected", "image_generated",
]);

interface EventIn {
  name: string;
  props?: Record<string, unknown>;
  postId?: string;
  generationId?: string;
  brandId?: string;
}

// Batched analytics. Content events (what people did with a generation) go to content_events;
// everything else (onboarding steps, feature use) goes to product_events. Body: { events: EventIn[] }
export async function POST(req: NextRequest) {
  try {
    const { events } = (await req.json()) as { events?: EventIn[] };
    if (!Array.isArray(events) || !events.length) return NextResponse.json({ ok: true });
    const s = await requireSession();
    const batch = events.slice(0, 50);
    const content = batch
      .filter((e) => CONTENT_EVENTS.has(e.name) && (e.postId || e.generationId))
      .map((e) => ({
        workspace_id: s.workspaceId,
        post_id: e.postId ?? null,
        llm_call_id: e.generationId ?? null,
        user_id: s.userId,
        event: e.name,
        props: e.props ?? {},
      }));
    const product = batch
      .filter((e) => !CONTENT_EVENTS.has(e.name))
      .map((e) => ({
        workspace_id: s.workspaceId,
        user_id: s.userId,
        brand_id: e.brandId ?? null,
        name: e.name.slice(0, 80),
        props: e.props ?? {},
      }));
    const results = await Promise.all([
      content.length ? s.db.from("content_events").insert(content) : null,
      product.length ? s.db.from("product_events").insert(product) : null,
    ]);
    for (const r of results) if (r?.error) throw r.error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, "events");
  }
}
