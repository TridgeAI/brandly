import { NextRequest, NextResponse } from "next/server";
import { callN8n, n8nEnabled } from "@/lib/n8n";
import { postizEnabled, publishWithPostiz } from "@/lib/postiz";
import { errorResponse, requireSession } from "@/lib/db/session";
import { signPaths } from "@/lib/render/media";
import type { ScheduledPost } from "@/lib/types";

export const maxDuration = 60;

// Publishes through the n8n backend (which posts via Postiz) when N8N_WEBHOOK_BASE_URL is set.
// Without n8n, falls back to calling Postiz directly (POSTIZ_API_URL/POSTIZ_API_KEY).
// Body: { post, mediaUrls?, publishAt? } — a future publishAt makes Postiz schedule the post.
export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch (err) {
    return errorResponse(err, "publish auth");
  }
  const body = await req.json();
  // Branded images live in private storage: sign fresh links for every slide so Postiz can fetch them.
  const paths = (body?.post as ScheduledPost | undefined)?.content?.rendered?.paths;
  if (!body?.mediaUrls?.length && paths?.length) {
    try {
      body.mediaUrls = await signPaths(session, "images", paths, 60 * 60 * 24 * 7);
    } catch (err) {
      console.warn("[publish] couldn't sign media", err);
    }
  }
  if (n8nEnabled() || !postizEnabled()) return callN8n("publish", body);

  if (!body?.post) return NextResponse.json({ error: "Missing post" }, { status: 400 });
  try {
    const out = await publishWithPostiz({ post: body.post, mediaUrls: body.mediaUrls, publishAt: body.publishAt });
    return NextResponse.json({ postId: body.post.id, ...out }, { status: out.status === "failed" ? 502 : 200 });
  } catch (err) {
    console.error("[publish:postiz]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Could not reach Postiz: ${msg}` }, { status: 502 });
  }
}
