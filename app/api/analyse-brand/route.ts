import { NextRequest, NextResponse } from "next/server";
import type { AnalyseBrandPayload } from "@/lib/types";
import { callN8n, n8nEnabled } from "@/lib/n8n";
import { emptyModel } from "@/lib/brand/model";
import { runStages } from "@/lib/brand/pipelines";
import { toBrandDNA } from "@/lib/brand/projection";

// Backward-compatible wrapper around the Brand Engine "analyse" stages.
// New UI uses POST /api/brands/:id/run with live progress instead.
export async function POST(req: NextRequest) {
  try {
    const body: AnalyseBrandPayload = await req.json();
    if (n8nEnabled()) return callN8n("analyse-brand", body);
    const { brandName, websiteUrl, igHandle } = body;
    const model = emptyModel(brandName || "Untitled brand", "analyse");
    const result = await runStages(["ingest", "extract", "validate"], model, { websiteUrl, igHandle });
    return NextResponse.json({ dna: toBrandDNA(result.model), model: result.model, issues: result.issues });
  } catch (err) {
    console.error("[analyse-brand]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal server error" }, { status: 500 });
  }
}
