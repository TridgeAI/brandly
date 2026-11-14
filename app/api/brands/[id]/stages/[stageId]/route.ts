import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
import { STAGES, runStages } from "@/lib/brand/pipelines";
import type { BrandModel } from "@/lib/brand/model";
import { friendlyError } from "@/lib/brand/jobs";
import { llmScope } from "@/lib/db/llm-scope";

// Runs one stage synchronously. Body: { model: BrandModel, input?: {...} }
// Response: { model, findings, issues, applied, skippedLocked }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; stageId: string }> }) {
  const { id, stageId } = await params;
  if (!STAGES[stageId]) return NextResponse.json({ error: `Unknown stage "${stageId}"` }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { model?: BrandModel; input?: Record<string, unknown> };
  if (!body.model) return NextResponse.json({ error: "model is required" }, { status: 400 });
  try {
    const model = body.model;
    const result = await llmScope(`stage:${stageId}`, { brandId: id }, () => runStages([stageId], model, body.input ?? {}));
    return NextResponse.json(result);
  } catch (err) {
    console.error(`[stage ${stageId}]`, err);
    return NextResponse.json({ error: friendlyError(err) }, { status: 500 });
  }
}
