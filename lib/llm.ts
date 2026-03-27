
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Singleton client for Anthropic — instantiated once per server process
const anthropicClient = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// Singleton client for Gemini — instantiated once per server process
const geminiClient = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

export const CLAUDE_MODEL = "claude-opus-4-5" as const;
export const GEMINI_MODEL = "gemini-1.5-pro" as const; // Using a suitable Gemini model

// ── Text generation (Anthropic Claude) ──────────────────────────────────────
async function generateTextClaude(
  system: string,
  user: string,
  maxTokens = 1500
): Promise<string> {
  if (!anthropicClient) {
    throw new Error("Anthropic client not initialized. ANTHROPIC_API_KEY is missing.");
  }
  const msg = await anthropicClient.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  const block = msg.content[0];
  return block.type === "text" ? block.text : "";
}

// ── Text generation (Google Gemini) ─────────────────────────────────────────
async function generateTextGemini(
  system: string,
  user: string,
  maxTokens = 1500
): Promise<string> {
  if (!geminiClient) {
    throw new Error("Gemini client not initialized. GEMINI_API_KEY is missing.");
  }
  const model = geminiClient.getGenerativeModel({ model: GEMINI_MODEL });
  const prompt = `System: ${system}\nUser: ${user}`; // Gemini often prefers prompts formatted this way
  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

// ── Primary text generation with fallback ───────────────────────────────────
export async function generateText(
  system: string,
  user: string,
  maxTokens = 1500
): Promise<string> {
  if (anthropicClient) {
    try {
      console.log("[LLM] Attempting generation with Claude...");
      return await generateTextClaude(system, user, maxTokens);
    } catch (error) {
      console.warn("[LLM] Claude generation failed, falling back to Gemini:", error);
      if (geminiClient) {
        console.log("[LLM] Attempting generation with Gemini...");
        return await generateTextGemini(system, user, maxTokens);
      } else {
        throw new Error("Claude failed and Gemini client not initialized.");
      }
    }
  } else if (geminiClient) {
    console.log("[LLM] Claude client not initialized, attempting generation with Gemini...");
    return await generateTextGemini(system, user, maxTokens);
  } else {
    throw new Error("No LLM client initialized. ANTHROPIC_API_KEY or GEMINI_API_KEY is missing.");
  }
}

// ── Vision — analyse images (Anthropic Claude) ─────────────────────────────
export async function analyseImages(
  base64Images: string[],
  prompt: string,
  maxTokens = 1500
): Promise<string> {
  if (!anthropicClient) {
    throw new Error("Anthropic client not initialized for image analysis. ANTHROPIC_API_KEY is missing.");
  }
  const content: Anthropic.MessageParam["content"] = [
    ...base64Images.map(
      (b64): Anthropic.ImageBlockParam => ({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: b64 },
      })
    ),
    { type: "text", text: prompt },
  ];

  const msg = await anthropicClient.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    messages: [{ role: "user", content }],
  });
  const block = msg.content[0];
  return block.type === "text" ? block.text : "";
}

// ── Safe JSON parse ────────────────────────────────────────────────────────
export function parseJSON<T>(text: string): T | null {
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean) as T;
  } catch (error) {
    console.error("Error parsing JSON:", error, "Original text:", text);
    return null;
  }
}
