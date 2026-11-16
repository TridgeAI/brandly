import { NextRequest, NextResponse } from "next/server";
import { checkCron } from "@/lib/jobs/cron-auth";
import { drain } from "@/lib/jobs/queue";
import { errorResponse } from "@/lib/db/session";

export const maxDuration = 60;

// Vercel Cron calls this with GET. Works due jobs until the time budget is used.
export async function GET(req: NextRequest) {
  const denied = checkCron(req);
  if (denied) return denied;
  try {
    return NextResponse.json(await drain({ worker: `cron-${crypto.randomUUID().slice(0, 8)}`, budgetMs: 45_000 }));
  } catch (err) {
    return errorResponse(err, "cron drain");
  }
}
