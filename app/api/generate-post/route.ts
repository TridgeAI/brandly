import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
import { generateText, parseJSON } from "@/lib/llm";
import type { GeneratePostPayload, GeneratedPost } from "@/lib/types";
import { CONTENT_TEMPLATES, PLATFORM_LIMITS } from "@/lib/templates";
import { callN8n, n8nEnabled } from "@/lib/n8n";
import { toPromptContext } from "@/lib/brand/projection";

const SYSTEM = `You are an expert social media content strategist.
You write deeply on-brand content that feels human, not AI-generated.
Return ONLY a JSON object — no markdown, no preamble.`;

export async function POST(req: NextRequest) {
  try {
    const body: GeneratePostPayload = await req.json();
    if (n8nEnabled()) return callN8n("generate-post", body);
    const { brandDNA, brandModel, template, topic, platforms, tone, additionalContext } = body;
    // The brand context is a stable prefix, so it is sent as cached context.
    const brandContext = brandModel ? toPromptContext(brandModel) : `Brand DNA:
${JSON.stringify(brandDNA, null, 2)}`;

    const templateConfig = CONTENT_TEMPLATES.find((t) => t.id === template);
    const platformLimitsList = platforms
      .map((p) => `${p}: ${PLATFORM_LIMITS[p].caption} chars`)
      .join(", ");

    const userPrompt = `Content request:
- Template: ${templateConfig?.label} — ${templateConfig?.promptHint}
- Topic/focus: ${topic || "general brand content"}
- Platforms: ${platforms.join(", ")}
- Character limits: ${platformLimitsList}
- Tone override: ${tone || "match brand tone"}
- Additional context: ${additionalContext || "none"}

Generate a full post package and return this JSON shape:
{
  "caption": string (primary caption, optimised for Instagram, within 2200 chars),
  "hashtags": string[] (8-15 hashtags, mix of broad and niche, no # prefix needed — add it in the array),
  "imagePrompt": string (detailed Midjourney/DALL-E style prompt that matches brand visual style, 2-3 sentences),
  "cta": string (clear call to action, 1 sentence),
  "bestTimeToPost": string (e.g. "Tuesday–Thursday, 7–9am or 6–8pm"),
  "postType": string (e.g. "Carousel", "Single image", "Reel", "Story"),
  "platformVariants": {
    "instagram": string (caption adapted for Instagram),
    "facebook": string (longer, more conversational, no hashtags needed),
    "linkedin": string (professional tone, insight-driven, 3 hashtags max),
    "twitter": string (punchy, under 280 chars including hashtags)
  }
}

Rules:
- platformVariants must only include the requested platforms: ${platforms.join(", ")}
- Write captions that sound like a real human, not AI
- Embed the brand's communication tone and vibe naturally
- hashtags array should include the # symbol`;

    const raw = await generateText(SYSTEM, userPrompt, { task: "fast", maxTokens: 2000, cachedContext: brandContext });
    const post = parseJSON<GeneratedPost>(raw);

    if (!post) {
      return NextResponse.json(
        { error: "Failed to parse generated post" },
        { status: 500 }
      );
    }

    return NextResponse.json({ post });
  } catch (err) {
    console.error("[generate-post]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
