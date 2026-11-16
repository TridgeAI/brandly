import type { AutomationRule, Brand, ScheduledPost } from "@/lib/types";
import type { BrandModel } from "@/lib/brand/model";
import { toBrandDNA } from "@/lib/brand/projection";

// Row shapes (snake_case) ↔ the app's existing types (camelCase).

export interface BrandRow {
  id: string;
  name: string;
  sources: Brand["sources"] | null;
  created_at: string;
  updated_at: string;
  current?: { model: BrandModel } | null;
}

export function brandFromRow(r: BrandRow): Brand | null {
  const model = r.current?.model;
  if (!model) return null;
  const m: BrandModel = { ...model, id: r.id, name: r.name };
  return { id: r.id, name: r.name, dna: toBrandDNA(m), model: m, sources: r.sources ?? {}, createdAt: r.created_at, updatedAt: r.updated_at };
}

export interface PostRow {
  id: string;
  brand_id: string;
  content: ScheduledPost["content"];
  platforms: string[];
  scheduled_at: string | null;
  status: string;
  created_at: string;
  media_url: string | null;
  notes: string | null;
  generation_id: string | null;
}

export function postFromRow(r: PostRow): ScheduledPost {
  return {
    id: r.id,
    brandId: r.brand_id,
    content: r.content,
    platforms: r.platforms as ScheduledPost["platforms"],
    scheduledAt: r.scheduled_at ?? r.created_at,
    status: (r.status === "discarded" ? "draft" : r.status) as ScheduledPost["status"],
    createdAt: r.created_at,
    mediaUrl: r.media_url ?? undefined,
    notes: r.notes ?? undefined,
    generationId: r.generation_id ?? undefined,
  };
}

/** Columns a client may set on a post. */
export function postToRow(p: Partial<ScheduledPost>) {
  const row: Record<string, unknown> = {};
  if (p.content !== undefined) row.content = p.content;
  if (p.platforms !== undefined) row.platforms = p.platforms;
  if (p.scheduledAt !== undefined) row.scheduled_at = p.scheduledAt;
  if (p.status !== undefined) {
    row.status = p.status;
    if (p.status === "published") row.published_at = new Date().toISOString();
  }
  if (p.mediaUrl !== undefined) row.media_url = p.mediaUrl;
  if (p.notes !== undefined) row.notes = p.notes;
  return row;
}

export interface RuleRow {
  id: string;
  brand_id: string;
  name: string;
  trigger: AutomationRule["trigger"];
  platforms: string[];
  status: AutomationRule["status"];
  last_run_at: string | null;
  next_run_at: string | null;
  posts_generated: number;
  created_at: string;
}

export function ruleFromRow(r: RuleRow): AutomationRule {
  return {
    id: r.id,
    brandId: r.brand_id,
    name: r.name,
    trigger: r.trigger,
    platforms: r.platforms as AutomationRule["platforms"],
    status: r.status,
    lastRun: r.last_run_at ?? undefined,
    nextRun: r.next_run_at ?? undefined,
    postsGenerated: r.posts_generated,
    createdAt: r.created_at,
  };
}

export function ruleToRow(r: Partial<AutomationRule>) {
  const row: Record<string, unknown> = {};
  if (r.name !== undefined) row.name = r.name;
  if (r.trigger !== undefined) row.trigger = r.trigger;
  if (r.platforms !== undefined) row.platforms = r.platforms;
  if (r.status !== undefined) row.status = r.status;
  if (r.lastRun !== undefined) row.last_run_at = r.lastRun;
  if (r.nextRun !== undefined) row.next_run_at = r.nextRun;
  if (r.postsGenerated !== undefined) row.posts_generated = r.postsGenerated;
  return row;
}

export const BRAND_SELECT = "id, name, sources, created_at, updated_at, current:brand_versions!brands_current_version_fk(model)";
export const POST_SELECT = "id, brand_id, content, platforms, scheduled_at, status, created_at, media_url, notes, generation_id";
export const RULE_SELECT = "id, brand_id, name, trigger, platforms, status, last_run_at, next_run_at, posts_generated, created_at";
