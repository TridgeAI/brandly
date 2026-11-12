import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { z, ZodTypeAny } from "zod";

// Singleton clients, instantiated once per server process
const anthropicClient = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;
const geminiClient = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const groqKey = process.env.GROQ_API_KEY || null;

type Provider = "claude" | "groq" | "gemini";

// ── Model routing ──────────────────────────────────────────────────────────
// One config, keyed by kind of task. Override any list with env vars (comma-separated).
//   fast     → extraction, scoring, captions, everyday posts (cheap, high volume)
//   vision   → PDF pages, screenshots (Groq has no vision model, so Gemini/Claude)
//   creative → brand synthesis and Build "directions" (once per brand)
export type LlmTask = "fast" | "vision" | "creative";

const list = (env: string | undefined, fallback: string[]) =>
  env ? env.split(",").map((m) => m.trim()).filter(Boolean) : fallback;

// Providers are tried in `order`; inside a provider, models are tried in turn
// when one is busy or missing, so a single overloaded model never blocks onboarding.
export const MODELS: Record<LlmTask, { order: Provider[] } & Record<Provider, string[]>> = {
  fast: {
    order: ["groq", "claude", "gemini"],
    groq: list(process.env.MODEL_FAST_GROQ, ["openai/gpt-oss-20b", "qwen/qwen3.8-27b"]),
    claude: list(process.env.MODEL_FAST_CLAUDE, ["claude-haiku-5-5"]),
    gemini: list(process.env.MODEL_FAST_GEMINI, ["gemini-3.1-flash-lite", "gemini-2.5-flash"]),
  },
  vision: {
    order: ["gemini", "claude"],
    groq: [],
    claude: list(process.env.MODEL_VISION_CLAUDE, ["claude-haiku-5-5"]),
    gemini: list(process.env.MODEL_VISION_GEMINI, ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash"]),
  },
  creative: {
    order: ["groq", "claude", "gemini"],
    groq: list(process.env.MODEL_CREATIVE_GROQ, ["openai/gpt-oss-120b", "qwen/qwen3.8-27b"]),
    claude: list(process.env.MODEL_CREATIVE_CLAUDE, ["claude-sonnet-5-5"]),
    gemini: list(process.env.MODEL_CREATIVE_GEMINI, ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-2.5-flash"]),
  },
};

/** Kept for older imports. */
export const CLAUDE_MODEL = MODELS.fast.claude[0];
export const GEMINI_MODEL = MODELS.fast.gemini[0];

const REQUEST_TIMEOUT_MS = 60_000;

export interface GenerateOptions {
  task?: LlmTask;
  maxTokens?: number;
  /**
   * Stable text (e.g. the brand context) placed before the request. Claude marks
   * it for prompt caching; Groq caches repeated prefixes automatically.
   */
  cachedContext?: string;
  /** Ask the provider for a JSON object (used by generateStructured). */
  json?: boolean;
}

// A provider whose key was rejected is skipped for the rest of the process,
// instead of failing (and adding latency) on every call.
const disabled = new Set<Provider>();
const msgOf = (e: unknown) => String(e instanceof Error ? e.message : e);
const isAuthError = (e: unknown) =>
  /\b401\b|\b403\b|invalid x-api-key|invalid api key|API key not valid|authentication|PERMISSION_DENIED/i.test(msgOf(e));
const isBusyError = (e: unknown) =>
  /\b429\b|\b503\b|\b529\b|overloaded|high demand|unavailable|rate limit|RESOURCE_EXHAUSTED|timed? ?out|aborted/i.test(msgOf(e));
const isMissingModel = (e: unknown) => /\b404\b|not found|is not supported|decommissioned|does not exist/i.test(msgOf(e));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const hasKey = (p: Provider) => (p === "claude" ? !!anthropicClient : p === "groq" ? !!groqKey : !!geminiClient);

async function claudeText(system: string, user: string, model: string, maxTokens: number, cachedContext?: string) {
  if (!anthropicClient) throw new Error("ANTHROPIC_API_KEY is missing.");
  const systemBlocks: Anthropic.TextBlockParam[] = [{ type: "text", text: system }];
  if (cachedContext) systemBlocks.push({ type: "text", text: cachedContext, cache_control: { type: "ephemeral" } });
  const msg = await anthropicClient.messages.create(
    { model, max_tokens: maxTokens, system: systemBlocks, messages: [{ role: "user", content: user }] },
    { timeout: REQUEST_TIMEOUT_MS }
  );
  logUsage(model, msg.usage);
  return msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}

/** Groq exposes an OpenAI-compatible API, so no SDK is needed. */
async function groqText(system: string, user: string, model: string, maxTokens: number, cachedContext?: string, json = false) {
  if (!groqKey) throw new Error("GROQ_API_KEY is missing.");
  const isGptOss = model.startsWith("openai/gpt-oss");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      model,
      // Brand context first so Groq's automatic prefix caching can reuse it.
      messages: [
        { role: "system", content: cachedContext ? `${cachedContext}\n\n${system}` : system },
        { role: "user", content: user },
      ],
      // Reasoning tokens count toward the limit, so leave headroom.
      max_completion_tokens: isGptOss ? maxTokens + 2000 : maxTokens,
      temperature: 0.7,
      ...(json ? { response_format: { type: "json_object" } } : {}),
      ...(isGptOss ? { reasoning_effort: "low", include_reasoning: false } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${data?.error?.message ?? res.statusText}`);
  if (process.env.LOG_LLM_USAGE === "1" && data.usage) {
    console.log(`[LLM usage] ${model} in=${data.usage.prompt_tokens} out=${data.usage.completion_tokens}`);
  }
  return (data.choices?.[0]?.message?.content as string | undefined) ?? "";
}

async function geminiText(system: string, user: string, model: string, maxTokens: number, cachedContext?: string, json = false) {
  if (!geminiClient) throw new Error("GEMINI_API_KEY is missing.");
  const m = geminiClient.getGenerativeModel(
    {
      model,
      systemInstruction: cachedContext ? `${system}\n\n${cachedContext}` : system,
      // Thinking tokens count toward the limit, so leave headroom.
      generationConfig: { maxOutputTokens: maxTokens + 2000, ...(json ? { responseMimeType: "application/json" } : {}) },
    },
    { timeout: REQUEST_TIMEOUT_MS }
  );
  const result = await m.generateContent(user);
  return result.response.text();
}

function order(task: LlmTask): Provider[] {
  const configured = MODELS[task].order.filter((p) => hasKey(p) && MODELS[task][p].length);
  if (!configured.length) {
    throw new Error(
      task === "vision"
        ? "Reading images needs GEMINI_API_KEY or ANTHROPIC_API_KEY."
        : "No LLM configured. Set GROQ_API_KEY, GEMINI_API_KEY or ANTHROPIC_API_KEY."
    );
  }
  const usable = configured.filter((p) => !disabled.has(p));
  return usable.length ? usable : configured;
}

/** Tries each provider and each of its models; one quick retry when a model is busy. */
async function withFallback<T>(task: LlmTask, call: (provider: Provider, model: string) => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (const provider of order(task)) {
    for (const model of MODELS[task][provider]) {
      let moveOn = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          return await call(provider, model);
        } catch (err) {
          lastError = err;
          console.warn(`[LLM] ${provider}/${model} (${task}) failed:`, msgOf(err).slice(0, 200));
          if (isAuthError(err)) {
            disabled.add(provider);
            break;
          }
          if (isBusyError(err) && attempt === 0) {
            await wait(1200);
            continue;
          }
          moveOn = isBusyError(err) || isMissingModel(err);
          break;
        }
      }
      if (disabled.has(provider)) break;
      if (!moveOn) break; // e.g. a bad request: try the next provider instead of the next model
    }
  }
  throw lastError instanceof Error ? lastError : new Error("LLM generation failed");
}

// ── Text generation with provider + model fallback ─────────────────────────
export async function generateText(system: string, user: string, maxTokensOrOpts: number | GenerateOptions = 1500): Promise<string> {
  const opts: GenerateOptions = typeof maxTokensOrOpts === "number" ? { maxTokens: maxTokensOrOpts } : maxTokensOrOpts;
  const task = opts.task ?? "fast";
  const maxTokens = opts.maxTokens ?? 1500;
  return withFallback(task, (provider, model) =>
    provider === "claude"
      ? claudeText(system, user, model, maxTokens, opts.cachedContext)
      : provider === "groq"
      ? groqText(system, user, model, maxTokens, opts.cachedContext, opts.json)
      : geminiText(system, user, model, maxTokens, opts.cachedContext, opts.json)
  );
}

/**
 * Structured output: the response must parse and pass the zod schema.
 * On failure it retries once with the validation error attached.
 */
export async function generateStructured<S extends ZodTypeAny>(
  schema: S,
  system: string,
  user: string,
  opts: GenerateOptions = {}
): Promise<z.output<S>> {
  const fullSystem = `${system}\nReturn ONLY one JSON object. No markdown fences, no commentary.`;
  let prompt = user;
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await generateText(fullSystem, prompt, { ...opts, json: true });
    const parsed = parseJSON<unknown>(raw);
    const result = schema.safeParse(parsed);
    if (result.success) return result.data as z.output<S>;
    const problem = parsed === null ? "The reply was not valid JSON." : result.error.issues.slice(0, 6).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    console.warn(`[LLM] structured output invalid (attempt ${attempt + 1}): ${problem}`);
    prompt = `${user}\n\nYour previous reply was rejected: ${problem}\nReturn corrected JSON only.`;
  }
  throw new Error("The AI reply did not match the expected format.");
}

// ── Vision ─────────────────────────────────────────────────────────────────
export async function analyseImages(base64Images: string[], prompt: string, maxTokens = 1500): Promise<string> {
  return withFallback("vision", async (provider, model) => {
    if (provider === "gemini") {
      const m = geminiClient!.getGenerativeModel({ model, generationConfig: { maxOutputTokens: maxTokens + 2000 } }, { timeout: REQUEST_TIMEOUT_MS });
      const res = await m.generateContent([
        ...base64Images.map((data) => ({ inlineData: { mimeType: "image/jpeg", data } })),
        { text: prompt },
      ]);
      return res.response.text();
    }
    const content: Anthropic.MessageParam["content"] = [
      ...base64Images.map(
        (b64): Anthropic.ImageBlockParam => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } })
      ),
      { type: "text", text: prompt },
    ];
    const msg = await anthropicClient!.messages.create({ model, max_tokens: maxTokens, messages: [{ role: "user", content }] }, { timeout: REQUEST_TIMEOUT_MS });
    logUsage(model, msg.usage);
    return msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  });
}

// ── Safe JSON parse ────────────────────────────────────────────────────────
export function parseJSON<T>(text: string): T | null {
  const clean = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(clean) as T;
  } catch {
    // Fall back to the first {...} block in the text.
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(clean.slice(start, end + 1)) as T;
      } catch {
        /* fall through */
      }
    }
    console.error("Error parsing JSON. Original text:", text.slice(0, 500));
    return null;
  }
}

function logUsage(model: string, usage: Anthropic.Usage | undefined) {
  if (!usage || process.env.LOG_LLM_USAGE !== "1") return;
  console.log(
    `[LLM usage] ${model} in=${usage.input_tokens} out=${usage.output_tokens} cache_read=${usage.cache_read_input_tokens ?? 0} cache_write=${usage.cache_creation_input_tokens ?? 0}`
  );
}
