import { NextRequest, NextResponse } from "next/server";
import { analyseImages, parseJSON } from "@/lib/llm";
import type { AnalysePdfPayload } from "@/lib/types";

const PDF_VISION_PROMPT = `These are rasterised pages from a brand PDF catalogue.
Each page is rendered at full resolution — ALL visual content is visible:
raster photos, vector illustrations, layered design elements, typography, colour blocks, gradients, and layout.

Analyse everything across all pages thoroughly.
Return ONLY a JSON object (no markdown, no preamble):
{
  "pdf_colors": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
  "pdf_visual_style": string,
  "pdf_design_aesthetic": string,
  "pdf_vibe": [string, string, string, string],
  "pdf_products_services": [string, string, string, string],
  "pdf_typography_feel": string,
  "pdf_layout_patterns": string,
  "pdf_brand_motifs": string,
  "pdf_target_audience": string,
  "pdf_communication_tone": string,
  "pdf_content_themes": [string, string, string, string]
}`;

export async function POST(req: NextRequest) {
  try {
    const body: AnalysePdfPayload = await req.json();
    const { pages, brandName } = body;

    if (!pages || pages.length === 0) {
      return NextResponse.json({ error: "No pages provided" }, { status: 400 });
    }

    // Cap at 8 pages to keep token cost reasonable
    const pagesToAnalyse = pages.slice(0, 8);

    const prompt = `Brand name: ${brandName}\n\n${PDF_VISION_PROMPT}`;
    const raw = await analyseImages(pagesToAnalyse, prompt, 1200);
    const insights = parseJSON<Record<string, unknown>>(raw);

    if (!insights) {
      return NextResponse.json(
        { error: "Failed to parse PDF visual analysis" },
        { status: 500 }
      );
    }

    return NextResponse.json({ insights });
  } catch (err) {
    console.error("[analyse-pdf]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
