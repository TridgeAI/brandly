import "server-only";
import { optionalSession, type Session } from "@/lib/db/session";
import type { GeneratedPost } from "@/lib/types";

/** What Brandly needs to remember about a past post to avoid repeating it. */
export interface PastPost {
  id: string;
  createdAt: string;
  template?: string;
  /** First line of the caption. */
  opening: string;
  format?: string;
  hook?: string;
  layout?: string;
  pillar?: string;
  headline?: string;
  /** Brand photo path used in the visual, if any. */
  photoPath?: string;
}

export interface ContentHistory {
  /** Newest first. */
  posts: PastPost[];
  /** Thumbs-down counts by format and layout (Phase 4 learning). */
  dislikes: { formats: Record<string, number>; layouts: Record<string, number> };
}

export const EMPTY_HISTORY: ContentHistory = { posts: [], dislikes: { formats: {}, layouts: {} } };

const firstLine = (s = "") => s.split(/\n/).map((l) => l.trim()).find(Boolean)?.slice(0, 160) ?? "";

/**
 * The brand's recent posts (newest first) and which formats/layouts got a thumbs-down.
 * Returns an empty history when signed out or the brand isn't saved yet.
 */
export async function recentPosts(brandId: string | undefined, limit = 15, session?: Session | null): Promise<ContentHistory> {
  if (!brandId) return EMPTY_HISTORY;
  const s = session === undefined ? await optionalSession() : session;
  if (!s) return EMPTY_HISTORY;
  try {
    const { data, error } = await s.db
      .from("posts")
      .select("id, created_at, template, content, generation_id")
      .eq("brand_id", brandId)
      .neq("status", "discarded")
      .order("created_at", { ascending: false })
      .limit(Math.max(limit, 40));
    if (error) throw error;
    const rows = (data ?? []) as { id: string; created_at: string; template: string | null; content: GeneratedPost; generation_id: string | null }[];

    const posts: PastPost[] = rows.slice(0, limit).map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      template: r.template ?? undefined,
      opening: firstLine(r.content?.caption),
      format: r.content?.format,
      hook: r.content?.hook,
      layout: r.content?.rendered?.layout ?? r.content?.layout,
      pillar: r.content?.pillar,
      headline: r.content?.headline,
      photoPath: r.content?.rendered?.photo?.kind === "brand" ? r.content.rendered.photo.ref : undefined,
    }));

    // Feedback is linked to the post or to the LLM call that wrote it.
    const byPost = new Map(rows.map((r) => [r.id, r]));
    const byCall = new Map(rows.filter((r) => r.generation_id).map((r) => [r.generation_id!, r]));
    const dislikes: ContentHistory["dislikes"] = { formats: {}, layouts: {} };
    if (rows.length) {
      const ids = rows.map((r) => r.id);
      const calls = [...byCall.keys()];
      const filter = [`post_id.in.(${ids.join(",")})`, calls.length ? `llm_call_id.in.(${calls.join(",")})` : ""].filter(Boolean).join(",");
      const { data: fb } = await s.db.from("generation_feedback").select("post_id, llm_call_id, rating").or(filter).lte("rating", 0).limit(200);
      for (const f of (fb ?? []) as { post_id: string | null; llm_call_id: string | null; rating: number }[]) {
        const row = (f.post_id && byPost.get(f.post_id)) || (f.llm_call_id && byCall.get(f.llm_call_id));
        if (!row) continue;
        const fmt = row.content?.format;
        const lay = row.content?.rendered?.layout ?? row.content?.layout;
        if (fmt) dislikes.formats[fmt] = (dislikes.formats[fmt] ?? 0) + 1;
        if (lay) dislikes.layouts[lay] = (dislikes.layouts[lay] ?? 0) + 1;
      }
    }
    return { posts, dislikes };
  } catch (err) {
    console.warn("[history]", err instanceof Error ? err.message : err);
    return EMPTY_HISTORY;
  }
}

/** The ALREADY POSTED prompt block. */
export function historyBlock(h: ContentHistory): string {
  if (!h.posts.length) return "";
  const lines = h.posts.slice(0, 15).map((p, i) => {
    const tags = [p.format, p.hook && `hook:${p.hook}`, p.pillar].filter(Boolean).join(", ");
    return `${i + 1}. "${p.opening}"${p.headline ? ` / headline "${p.headline}"` : ""}${tags ? ` [${tags}]` : ""}`;
  });
  return `ALREADY POSTED (newest first). Do NOT reuse these openings, sentence structures, headlines or angles. Start differently:
${lines.join("\n")}`;
}
