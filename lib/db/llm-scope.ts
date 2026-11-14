import "server-only";
import { withLlmContext } from "@/lib/llm-log";
import { optionalSession } from "./session";

/**
 * Runs AI work tagged with who/what it was for, so each LLM call is logged
 * against the workspace, user and brand. Works (unlogged) when signed out.
 */
export async function llmScope<T>(feature: string, opts: { brandId?: string; promptVersion?: string }, fn: () => Promise<T>): Promise<T> {
  const s = await optionalSession();
  return withLlmContext(
    { feature, workspaceId: s?.workspaceId, userId: s?.userId, brandId: opts.brandId, promptVersion: opts.promptVersion },
    fn
  );
}
