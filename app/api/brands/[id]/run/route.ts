import { NextRequest, NextResponse } from "next/server";
import { PIPELINES, runStages, type PipelineId } from "@/lib/brand/pipelines";
import { createJob, runJob } from "@/lib/brand/jobs";
import { emptyModel, type BrandModel } from "@/lib/brand/model";

// Runs a whole pipeline (e.g. "analyse") as a background job.
// Phase 1 is stateless: the browser sends the current model and gets the merged model back.
// Body: { pipeline: "analyse" | "build" | "refine", model?: BrandModel, name?: string, input: {...} }
// Response: 202 { jobId }  → poll GET /api/jobs/:jobId
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    pipeline?: PipelineId;
    model?: BrandModel;
    name?: string;
    input?: Record<string, unknown>;
  };
  const pipeline = body.pipeline ?? "analyse";
  if (!(pipeline in PIPELINES)) return NextResponse.json({ error: `Unknown pipeline "${pipeline}"` }, { status: 400 });

  const model = body.model ?? emptyModel(body.name?.trim() || "Untitled brand", pipeline, id);
  const job = createJob();
  runJob(job, (report) => runStages(PIPELINES[pipeline], model, body.input ?? {}, report));
  return NextResponse.json({ jobId: job.id }, { status: 202 });
}
