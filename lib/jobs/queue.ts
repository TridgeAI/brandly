import "server-only";
import { after } from "next/server";
import { friendlyError } from "@/lib/errors";
import { withLlmContext } from "@/lib/llm-log";
import { adminClient } from "@/lib/supabase/admin";
import { HANDLERS, type JobRow } from "./handlers";

export interface EnqueueInput {
  kind: string;
  workspaceId: string;
  brandId?: string;
  payload?: Record<string, unknown>;
  runAt?: Date;
  /** Only one queued/running/retrying job per key; a repeat enqueue returns the existing id. */
  dedupeKey?: string;
  createdBy?: string;
  maxAttempts?: number;
}

function db() {
  const c = adminClient();
  if (!c) throw new Error("Job queue needs SUPABASE_SECRET_KEY.");
  return c;
}

export async function enqueue(input: EnqueueInput): Promise<string> {
  const { data, error } = await db()
    .from("jobs")
    .insert({
      kind: input.kind,
      workspace_id: input.workspaceId,
      brand_id: input.brandId ?? null,
      payload: input.payload ?? {},
      run_at: (input.runAt ?? new Date()).toISOString(),
      dedupe_key: input.dedupeKey ?? null,
      created_by: input.createdBy ?? null,
      ...(input.maxAttempts ? { max_attempts: input.maxAttempts } : {}),
    })
    .select("id")
    .single();
  if (!error) return data.id as string;

  if (error.code === "23505" && input.dedupeKey) {
    const { data: existing } = await db()
      .from("jobs")
      .select("id")
      .eq("dedupe_key", input.dedupeKey)
      .in("status", ["queued", "running", "error"])
      .maybeSingle();
    if (existing) return existing.id as string;
  }
  throw error;
}

/** Enqueue, then start working the queue right after the response is sent (no waiting for cron). */
export async function enqueueAndKick(input: EnqueueInput): Promise<string> {
  const id = await enqueue(input);
  after(() => drain({ worker: `kick-${id.slice(0, 8)}`, budgetMs: 40_000 }).catch((e) => console.error("[jobs] kick failed", e)));
  return id;
}

export async function claim(worker: string, limit: number): Promise<JobRow[]> {
  const { data, error } = await db().rpc("claim_jobs", { p_worker: worker, p_limit: limit });
  if (error) throw error;
  return (data ?? []) as JobRow[];
}

async function complete(job: JobRow, result: unknown) {
  const { error } = await db()
    .from("jobs")
    .update({ status: "done", result: result ?? null, error: null, locked_at: null, locked_by: null })
    .eq("id", job.id);
  if (error) throw error;
}

/** Backoff: 30s, 60s, 120s ... capped at 1 hour. */
export function backoffMs(attempts: number): number {
  return Math.min(30_000 * 2 ** Math.max(0, attempts - 1), 3_600_000);
}

async function fail(job: JobRow, err: unknown) {
  const dead = job.attempts >= job.max_attempts;
  const { error } = await db()
    .from("jobs")
    .update({
      status: dead ? "dead" : "error",
      error: friendlyError(err),
      run_at: dead ? undefined : new Date(Date.now() + backoffMs(job.attempts)).toISOString(),
      locked_at: null,
      locked_by: null,
    })
    .eq("id", job.id);
  if (error) throw error;
}

/** Runs due jobs one at a time until the queue is empty or the time budget is spent. */
export async function drain(opts: { worker: string; budgetMs: number }): Promise<{ ran: number; failed: number }> {
  const deadline = Date.now() + opts.budgetMs;
  let ran = 0;
  let failed = 0;
  while (Date.now() < deadline) {
    const [job] = await claim(opts.worker, 1);
    if (!job) break;
    const handler = HANDLERS[job.kind];
    try {
      if (!handler) throw new Error(`Unknown job kind "${job.kind}"`);
      const result = await withLlmContext(
        { feature: `job:${job.kind}`, workspaceId: job.workspace_id, userId: job.created_by ?? undefined, brandId: job.brand_id ?? undefined },
        () => handler(job)
      );
      await complete(job, result);
      ran++;
    } catch (err) {
      console.error(`[job ${job.id} ${job.kind}]`, err);
      await fail(job, err);
      failed++;
    }
  }
  return { ran, failed };
}
