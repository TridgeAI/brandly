import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/brand/jobs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) return NextResponse.json({ error: "Job not found or expired" }, { status: 404 });
  return NextResponse.json({
    status: job.status,
    findings: job.findings,
    error: job.error,
    result: job.status === "done" ? job.result : undefined,
  });
}
