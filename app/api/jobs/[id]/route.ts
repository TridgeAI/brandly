import { NextRequest, NextResponse } from "next/server";
import { errorResponse, requireSession } from "@/lib/db/session";

// Reads with the user's own client, so RLS limits this to jobs in their workspaces.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireSession();
    const { id } = await params;
    const { data: job, error } = await s.db
      .from("jobs")
      .select("kind, status, findings, result, error, attempts, max_attempts, run_at")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    return NextResponse.json({ ...job, result: job.status === "done" ? job.result : undefined });
  } catch (err) {
    return errorResponse(err, "job status");
  }
}
