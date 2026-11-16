import "server-only";
import type { BrandModel } from "@/lib/brand/model";
import type { Brand } from "@/lib/types";
import type { Session } from "./session";

export type VersionSource = "stage" | "user" | "import" | "rollback" | "build";

const get = (obj: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);

const LAYERS = ["name", "strategy", "identity", "personality", "expression", "voice", "content", "compliance"] as const;

/** Leaf paths whose values differ between two models (for brand_versions.changed_paths). */
export function diffPaths(prev: unknown, next: unknown, base = ""): string[] {
  if (JSON.stringify(prev) === JSON.stringify(next)) return [];
  const isObj = (v: unknown) => v && typeof v === "object" && !Array.isArray(v);
  if (!isObj(prev) || !isObj(next)) return [base];
  const keys = new Set([...Object.keys(prev as object), ...Object.keys(next as object)]);
  return [...keys].flatMap((k) =>
    diffPaths((prev as Record<string, unknown>)[k], (next as Record<string, unknown>)[k], base ? `${base}.${k}` : k)
  );
}

/**
 * Saves a Brand Model as a new version (creating the brand on first save).
 * When a user changes a field the AI filled in, a field_corrections row records it.
 */
export async function saveBrandVersion(
  s: Session,
  model: BrandModel,
  opts: { sources?: Brand["sources"]; source: VersionSource; stageId?: string; legacyId?: string }
) {
  const { db, userId, workspaceId } = s;
  // Queryable copy of the classification (the BrandModel stays the source of truth).
  const classification = {
    industry: model.strategy.industry ?? null,
    business_model: model.strategy.businessModel ?? null,
    primary_goal: model.strategy.primaryGoal ?? null,
  };
  const { data: existing, error: readErr } = await db
    .from("brands")
    .select("id, current:brand_versions!brands_current_version_fk(id, model)")
    .eq("id", model.id)
    .maybeSingle();
  if (readErr) throw readErr;

  if (!existing) {
    const { error } = await db.from("brands").insert({
      id: model.id,
      workspace_id: workspaceId,
      name: model.name,
      mode: model.mode,
      sources: opts.sources ?? {},
      legacy_id: opts.legacyId,
      created_by: userId,
      ...classification,
    });
    if (error) throw error;
  } else {
    const { error } = await db
      .from("brands")
      .update({ ...(opts.sources ? { sources: opts.sources } : {}), name: model.name, ...classification })
      .eq("id", model.id);
    if (error) throw error;
  }

  const current = (existing?.current as unknown as { id: string; model: BrandModel } | null) ?? null;
  const prev = current?.model;
  const changed = prev ? LAYERS.flatMap((l) => diffPaths(prev[l], model[l], l)) : [];
  if (prev && !changed.length) return { versionId: current!.id, changed };

  const { data: version, error } = await db
    .from("brand_versions")
    .insert({
      brand_id: model.id,
      workspace_id: workspaceId,
      version: 0, // set by trigger
      model,
      changed_paths: changed,
      source: opts.source,
      stage_id: opts.stageId,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw error;

  if (prev && opts.source === "user") {
    // A meta entry marks a field the engine filled in; a user change to it is a correction.
    const corrections = Object.entries(prev.meta ?? {})
      .filter(([, m]) => m.source !== "user")
      .filter(([path]) => JSON.stringify(get(prev, path)) !== JSON.stringify(get(model, path)))
      .map(([path, m]) => ({
        brand_id: model.id,
        workspace_id: workspaceId,
        version_id: version.id,
        field_path: path,
        old_value: get(prev, path) ?? null,
        new_value: get(model, path) ?? null,
        prior_source: m.source,
        prior_confidence: m.confidence,
        user_id: userId,
      }));
    if (corrections.length) {
      const { error: cErr } = await db.from("field_corrections").insert(corrections);
      if (cErr) console.warn("[field_corrections]", cErr.message);
    }
  }
  return { versionId: version.id, changed };
}
