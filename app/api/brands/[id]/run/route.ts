import { NextRequest, NextResponse } from "next/server";
import { PIPELINES, runStages, type PipelineId } from "@/lib/brand/pipelines";
import { friendlyError } from "@/lib/errors";
import { emptyModel, type BrandModel } from "@/lib/brand/model";
import { errorResponse, requireSession } from "@/lib/db/session";
import { withLlmContext } from "@/lib/llm-log";
import { attachSourceMedia } from "@/lib/brand/photos";

// Long enough for a website read + AI synthesis; well inside Vercel's limits.
export const maxDuration = 120;

// Runs a whole pipeline (e.g. "analyse") and streams progress in the same response
// as newline-delimited JSON, so it works on serverless hosts where a separate
// "poll the job" request could land on a different instance.
//   {"type":"finding","finding":{...}}   one per update
//   {"type":"done","result":{...}}       once, at the end
//   {"type":"error","error":"..."}       once, on failure
// Phase 1 is stateless: the browser sends the current model and gets the merged model back.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let session;
  try {
    session = await requireSession();
  } catch (err) {
    return errorResponse(err, "run auth");
  }
  const body = (await req.json().catch(() => ({}))) as {
    pipeline?: PipelineId;
    model?: BrandModel;
    name?: string;
    input?: Record<string, unknown>;
  };
  const pipeline = body.pipeline ?? "analyse";
  if (!(pipeline in PIPELINES)) return NextResponse.json({ error: `Unknown pipeline "${pipeline}"` }, { status: 400 });

  const model = body.model ?? emptyModel(body.name?.trim() || "Untitled brand", pipeline, id);
  // Resolve the user before streaming so every LLM call in the run is logged against them.
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      // Keep the connection alive while a slow model is thinking.
      const ping = setInterval(() => send({ type: "ping" }), 10_000);
      try {
        const result = await withLlmContext(
          { feature: `pipeline:${pipeline}`, workspaceId: session?.workspaceId, userId: session?.userId, brandId: id },
          () => runStages(PIPELINES[pipeline], model, body.input ?? {}, (finding) => send({ type: "finding", finding }))
        );
        // Keep real photos and the logo in Supabase so posts can use them later.
        if (session && pipeline !== "build") {
          const input = body.input ?? {};
          const shots = input.imageSource === "instagram" || input.imageSource === "upload" ? (input.images as string[] | undefined) : undefined;
          try {
            const before = result.model.expression.photos?.length ?? 0;
            result.model = await attachSourceMedia(session, result.model, {
              photoUrls: result.output.photoUrls as string[] | undefined,
              screenshots: shots,
            });
            const saved = (result.model.expression.photos?.length ?? 0) - before;
            if (saved > 0) send({ type: "finding", finding: { id: "photos", label: `Saved ${saved} brand photos for your posts`, status: "done" } });
          } catch (err) {
            console.warn("[run] storing brand media failed", err);
          }
        }
        send({ type: "done", result });
      } catch (err) {
        console.error(`[run ${pipeline}]`, err);
        send({ type: "error", error: friendlyError(err) });
      } finally {
        clearInterval(ping);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
