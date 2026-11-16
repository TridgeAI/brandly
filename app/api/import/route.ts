import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { errorResponse, requireSession } from "@/lib/db/session";
import { saveBrandVersion } from "@/lib/db/brands";
import { postToRow, ruleToRow } from "@/lib/db/mappers";
import { fromBrandDNA } from "@/lib/brand/projection";
import type { AutomationRule, Brand, ScheduledPost } from "@/lib/types";

export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// One-time import of the old browser-only store (localStorage "brandly-store").
// Old ids like "brand_1731..." become uuids; the old id is kept in legacy_id so re-running is safe.
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { brands?: Brand[]; posts?: ScheduledPost[]; automationRules?: AutomationRule[] };
    const s = await requireSession();
    const idMap = new Map<string, string>();
    let brands = 0;

    const { data: already, error: readErr } = await s.db
      .from("brands")
      .select("id, legacy_id")
      .eq("workspace_id", s.workspaceId)
      .not("legacy_id", "is", null);
    if (readErr) throw readErr;
    for (const r of already ?? []) idMap.set(r.legacy_id as string, r.id as string);

    for (const b of body.brands ?? []) {
      if (idMap.has(b.id)) continue;
      const id = UUID.test(b.id) ? b.id : randomUUID();
      const model = { ...(b.model ?? fromBrandDNA(b.dna, id)), id, name: b.name };
      await saveBrandVersion(s, model, { sources: b.sources, source: "import", legacyId: b.id });
      idMap.set(b.id, id);
      brands++;
    }

    const { data: oldPosts } = await s.db.from("posts").select("legacy_id").eq("workspace_id", s.workspaceId).not("legacy_id", "is", null);
    const seenPosts = new Set((oldPosts ?? []).map((p) => p.legacy_id as string));
    const postRows = (body.posts ?? [])
      .filter((p) => idMap.has(p.brandId) && !seenPosts.has(p.id))
      .map((p) => ({
        ...postToRow(p),
        id: UUID.test(p.id) ? p.id : randomUUID(),
        legacy_id: p.id,
        brand_id: idMap.get(p.brandId),
        workspace_id: s.workspaceId,
        original_content: p.content,
        created_at: p.createdAt,
        created_by: s.userId,
      }));
    if (postRows.length) {
      const { error } = await s.db.from("posts").insert(postRows);
      if (error) throw error;
    }

    const { data: oldRules } = await s.db.from("automation_rules").select("legacy_id").eq("workspace_id", s.workspaceId).not("legacy_id", "is", null);
    const seenRules = new Set((oldRules ?? []).map((r) => r.legacy_id as string));
    const ruleRows = (body.automationRules ?? [])
      .filter((r) => idMap.has(r.brandId) && !seenRules.has(r.id))
      .map((r) => ({
        ...ruleToRow(r),
        id: UUID.test(r.id) ? r.id : randomUUID(),
        legacy_id: r.id,
        brand_id: idMap.get(r.brandId),
        workspace_id: s.workspaceId,
        created_at: r.createdAt,
        created_by: s.userId,
      }));
    if (ruleRows.length) {
      const { error } = await s.db.from("automation_rules").insert(ruleRows);
      if (error) throw error;
    }

    return NextResponse.json({ brands, posts: postRows.length, rules: ruleRows.length });
  } catch (err) {
    return errorResponse(err, "import");
  }
}
