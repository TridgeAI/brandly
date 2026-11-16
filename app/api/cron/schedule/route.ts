import { NextRequest, NextResponse } from "next/server";
import { checkCron } from "@/lib/jobs/cron-auth";
import { errorResponse } from "@/lib/db/session";
import { adminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

const DAY = 24 * 60 * 60 * 1000;

// Periodic housekeeping, plus the place later phases enqueue per-workspace recurring jobs
// (sync, outcomes, decay) using dedupe keys like `sync:<brand>:<YYYY-MM-DD-HH>`.
export async function GET(req: NextRequest) {
  const denied = checkCron(req);
  if (denied) return denied;
  try {
    const db = adminClient();
    if (!db) return NextResponse.json({ error: "SUPABASE_SECRET_KEY is not set." }, { status: 503 });
    const done = await db.from("jobs").delete({ count: "exact" }).eq("status", "done").lt("updated_at", new Date(Date.now() - 30 * DAY).toISOString());
    if (done.error) throw done.error;
    const dead = await db.from("jobs").delete({ count: "exact" }).eq("status", "dead").lt("updated_at", new Date(Date.now() - 90 * DAY).toISOString());
    if (dead.error) throw dead.error;
    return NextResponse.json({ deletedDone: done.count ?? 0, deletedDead: dead.count ?? 0 });
  } catch (err) {
    return errorResponse(err, "cron schedule");
  }
}
