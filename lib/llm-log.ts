import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";

// Every LLM call is recorded in `llm_calls` so prompts and models can be compared later
// against what users did with the output (edits, ratings, engagement).
// Routes set the context once; lib/llm.ts records each call inside it.

export interface LlmContext {
  feature: string;
  workspaceId?: string;
  brandId?: string;
  userId?: string;
  promptVersion?: string;
  /** Records made in this context, newest last. */
  calls: LlmCallRecord[];
}

export interface LlmCallRecord {
  id: string;
  workspace_id?: string;
  brand_id?: string;
  user_id?: string;
  feature: string;
  task?: string;
  provider?: string;
  model?: string;
  prompt_version?: string;
  system_hash?: string;
  input?: unknown;
  output?: string;
  parsed_ok?: boolean;
  input_tokens?: number;
  output_tokens?: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
  latency_ms?: number;
  attempts: number;
  fallback_from?: string;
  error?: string;
}

const store = new AsyncLocalStorage<LlmContext>();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function withLlmContext<T>(ctx: Omit<LlmContext, "calls"> & { calls?: LlmCallRecord[] }, fn: () => Promise<T>): Promise<T> {
  const parent = store.getStore();
  const brandId = ctx.brandId && UUID.test(ctx.brandId) ? ctx.brandId : undefined;
  return store.run({ ...parent, ...ctx, brandId: brandId ?? parent?.brandId, calls: parent?.calls ?? ctx.calls ?? [] }, fn);
}

/** Runs fn with a different `feature` label (e.g. one per pipeline stage). */
export function withFeature<T>(feature: string, fn: () => Promise<T>): Promise<T> {
  const parent = store.getStore();
  if (!parent) return fn();
  return store.run({ ...parent, feature }, fn);
}

export function currentLlmContext() {
  return store.getStore();
}

/** id of the latest call in this context (e.g. to link a saved post to its generation). */
export function lastLlmCallId(): string | undefined {
  return store.getStore()?.calls.at(-1)?.id;
}

export const hashText = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);

export function startRecord(task: string, input: unknown, system?: string): LlmCallRecord {
  const ctx = store.getStore();
  const rec: LlmCallRecord = {
    id: randomUUID(),
    workspace_id: ctx?.workspaceId,
    brand_id: ctx?.brandId,
    user_id: ctx?.userId,
    feature: ctx?.feature ?? "unknown",
    prompt_version: ctx?.promptVersion,
    task,
    input,
    system_hash: system ? hashText(system) : undefined,
    attempts: 0,
  };
  ctx?.calls.push(rec);
  return rec;
}

let warned = false;

/**
 * Saves a record without delaying the response: inside a request it runs after the
 * response is sent (next/server `after`), otherwise straight away.
 */
export async function persistRecord(rec: LlmCallRecord) {
  const save = async () => {
    try {
      const { adminClient } = await import("@/lib/supabase/admin");
      const db = adminClient();
      if (!db) {
        if (!warned) console.warn("[llm-log] SUPABASE_SECRET_KEY not set; LLM calls are not being recorded.");
        warned = true;
        return;
      }
      let { error } = await db.from("llm_calls").insert(rec);
      if (error?.code === "23503" && rec.brand_id) {
        // The brand isn't saved yet (onboarding runs the AI first). Keep the id in a column
        // that saveBrandVersion backfills from once the brand exists.
        ({ error } = await db.from("llm_calls").insert({ ...rec, brand_id: null, pending_brand_id: rec.brand_id }));
      }
      if (error) console.warn("[llm-log] insert failed:", error.message);
    } catch (err) {
      console.warn("[llm-log] insert failed:", err instanceof Error ? err.message : err);
    }
  };
  try {
    const { after } = await import("next/server");
    after(save);
  } catch {
    await save();
  }
}
