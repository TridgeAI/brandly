import { NextRequest, NextResponse } from "next/server";
import type { GeneratePostPayload } from "@/lib/types";
import { generatePost } from "@/lib/content/generate";

export const maxDuration = 60;

// Picks a brief (format, hook, pillar) from the brand's recent posts, writes the post
// with the full brand context, and chooses a layout. Runs through n8n when it is configured.
export async function POST(req: NextRequest) {
  try {
    const body: GeneratePostPayload = await req.json();
    if (!body.platforms?.length) return NextResponse.json({ error: "Choose at least one platform" }, { status: 400 });
    const result = await generatePost({
      feature: "generate-post",
      model: body.brandModel,
      dna: body.brandDNA,
      platforms: body.platforms,
      template: body.template,
      topic: body.topic,
      tone: body.tone,
      additionalContext: body.additionalContext,
      n8nBody: body as unknown as Record<string, unknown>,
    });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[generate-post]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal server error" }, { status: 500 });
  }
}
