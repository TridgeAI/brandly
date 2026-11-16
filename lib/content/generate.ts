import "server-only";
import type { BrandModel } from "@/lib/brand/model";
import { GeneratedPostSchema } from "@/lib/brand/schemas";
import { generateStructured } from "@/lib/llm";
import { lastLlmCallId } from "@/lib/llm-log";
import { llmScope } from "@/lib/db/llm-scope";
import { optionalSession } from "@/lib/db/session";
import { n8nEnabled, n8nRequest, type N8nRoute } from "@/lib/n8n";
import { layoutKitOf } from "@/lib/render/kit";
import type { BrandDNA, GeneratedPost, Platform, TemplateCategory } from "@/lib/types";
import { chooseLayout, pickBrief } from "./brief";
import { recentPosts } from "./history";
import { buildPostPrompt, finalizePost, postSchemaFor, POST_PROMPT_VERSION, POST_TEMPERATURE } from "./prompt";

export interface GenerateInput {
  model?: BrandModel;
  dna?: BrandDNA;
  platforms: Platform[];
  template?: TemplateCategory;
  topic?: string;
  tone?: string;
  additionalContext?: string;
  triggerContext?: string;
  /** Which feature the call is logged under. */
  feature: "generate-post" | "automation";
  /** Original request body, forwarded to n8n alongside the built prompt. */
  n8nBody?: Record<string, unknown>;
}

export type GenerateResult = { post: GeneratedPost; generationId?: string } | { error: string; status: number };

/**
 * Brief → prompt → LLM (or n8n) → validated post with a layout chosen.
 * The brief and history are decided here so n8n and the built-in path write the same kind of post.
 */
export async function generatePost(input: GenerateInput): Promise<GenerateResult> {
  const { model, dna, platforms } = input;
  const session = await optionalSession();
  const history = await recentPosts(model?.id, 15, session);
  const brief = pickBrief(model, history, input.template, {
    allowCarousel: platforms.some((p) => p === "instagram" || p === "linkedin"),
  });
  const prompt = buildPostPrompt({ ...input, brief, history });

  let raw: unknown;
  let generationId: string | undefined;
  if (n8nEnabled()) {
    const { status, data } = await n8nRequest(input.feature as N8nRoute, {
      ...(input.n8nBody ?? {}),
      brandContext: prompt.brandContext,
      prompt: { system: prompt.system, user: prompt.user, temperature: POST_TEMPERATURE },
    });
    if (status >= 400 || !data.post) return { error: String(data.error ?? `n8n responded with HTTP ${status}`), status: status >= 400 ? status : 502 };
    raw = data.post;
  } else {
    const opts = { task: "fast" as const, maxTokens: 2200, cachedContext: prompt.brandContext, temperature: POST_TEMPERATURE };
    raw = await llmScope(input.feature, { brandId: model?.id, promptVersion: POST_PROMPT_VERSION }, async () => {
      try {
        return await generateStructured(postSchemaFor(model), prompt.system, prompt.user, opts);
      } catch {
        // Two replies still used a banned phrase: accept a valid post rather than fail.
        return await generateStructured(GeneratedPostSchema, prompt.system, prompt.user, opts);
      } finally {
        generationId = lastLlmCallId() ?? undefined;
      }
    });
  }

  const post = finalizePost(raw, { model, dna, brief, platforms });
  if (!post) return { error: "The AI reply did not match the expected format.", status: 502 };
  const kit = layoutKitOf(model);
  if (kit) post.layout = chooseLayout(kit, post.format, history, { carousel: brief.carousel && (post.slides?.length ?? 0) >= 2 });
  return { post, generationId };
}
