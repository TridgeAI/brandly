import { NextRequest, NextResponse } from "next/server";
import { generateText, parseJSON } from "@/lib/llm";
import type { BrandDNA, AnalyseBrandPayload } from "@/lib/types";

const SYSTEM = `You are a senior brand strategist AI. Synthesise all provided source signals into a Brand DNA profile.
Return ONLY a JSON object — no markdown, no preamble, no explanation:
{
  "brandName": string,
  "colors": { "primary": hex_string, "secondary": hex_string, "accent": hex_string, "neutral": hex_string },
  "typography_feel": string,
  "visual_style": string,
  "vibe": [string, string, string, string],
  "products_services": [string, string, string, string],
  "target_audience": string,
  "communication_tone": string,
  "content_themes": [string, string, string, string],
  "hashtag_clusters": [string, string, string, string, string, string],
  "do": [string, string, string],
  "dont": [string, string, string],
  "one_liner": string
}
CRITICAL: If PDF visual insights are provided, they are HIGH PRIORITY.
Trust the extracted colours and aesthetic over assumptions.
Hex colours must form a coherent, aesthetically strong palette.`;

export async function POST(req: NextRequest) {
  try {
    const body: AnalyseBrandPayload = await req.json();
    const { brandName, websiteUrl, igHandle, pdfInsights } = body;

    const userPrompt = `Brand name: ${brandName}
Website: ${websiteUrl || "not provided"}
Instagram: @${igHandle || "not provided"}
PDF catalogue provided: ${pdfInsights ? "yes" : "no"}

${
  pdfInsights
    ? `PDF Visual Analysis (HIGH PRIORITY — extracted directly from catalogue pages):
${JSON.stringify(pdfInsights, null, 2)}`
    : ""
}

Build a detailed, specific Brand DNA. Be concrete, not generic.
Colours must reflect the actual brand aesthetic.
Avoid vague adjectives — be precise about style, audience, and tone.`;

    const raw = await generateText(SYSTEM, userPrompt, 1500);
    const dna = parseJSON<BrandDNA>(raw);

    if (!dna) {
      return NextResponse.json(
        { error: "Failed to parse brand DNA from AI response" },
        { status: 500 }
      );
    }

    return NextResponse.json({ dna });
  } catch (err) {
    console.error("[analyse-brand]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
