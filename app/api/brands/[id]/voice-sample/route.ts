import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
import { generateText } from "@/lib/llm";
import { toPromptContext } from "@/lib/brand/projection";
import type { BrandModel } from "@/lib/brand/model";

// Rewrites one sample sentence in the brand's current voice (used by the voice sliders).
// Fast model + cached brand context: costs a fraction of a paisa per call.
export async function POST(req: NextRequest) {
  const { model } = (await req.json().catch(() => ({}))) as { model?: BrandModel };
  if (!model) return NextResponse.json({ error: "model is required" }, { status: 400 });
  try {
    const line = await generateText(
      "You write one short social media line in a brand's voice. Reply with the line only, no quotes, no hashtags, under 22 words.",
      `Announce that a new product is available this week. Follow the VOICE settings exactly.`,
      { task: "fast", maxTokens: 80, cachedContext: toPromptContext(model) }
    );
    return NextResponse.json({ line: line.trim().replace(/^["“]|["”]$/g, "") });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
