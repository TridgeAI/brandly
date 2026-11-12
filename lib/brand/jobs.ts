import type { Finding } from "./stages/types";
import type { RunResult } from "./pipelines";

// In-process job store (Phase 1). Lives on globalThis so it survives Next.js
// dev hot-reloads. Phase 2 moves this to a Supabase `jobs` table + Realtime.
export interface Job {
  id: string;
  status: "running" | "done" | "error";
  findings: Finding[];
  result?: RunResult;
  error?: string;
  createdAt: number;
}

const g = globalThis as unknown as { __brandlyJobs?: Map<string, Job> };
const jobs = (g.__brandlyJobs ??= new Map<string, Job>());

const TTL_MS = 30 * 60 * 1000;

export function createJob(): Job {
  for (const [id, j] of jobs) if (Date.now() - j.createdAt > TTL_MS) jobs.delete(id);
  const job: Job = { id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, status: "running", findings: [], createdAt: Date.now() };
  jobs.set(job.id, job);
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function upsertFinding(job: Job, f: Finding) {
  const i = job.findings.findIndex((x) => x.id === f.id);
  if (i >= 0) job.findings[i] = f;
  else job.findings.push(f);
}

export function runJob(job: Job, work: (report: (f: Finding) => void) => Promise<RunResult>) {
  work((f) => upsertFinding(job, f))
    .then((result) => {
      job.result = result;
      job.status = "done";
    })
    .catch((err) => {
      job.error = friendlyError(err);
      // Anything still "in progress" failed with the job.
      job.findings = job.findings.map((f) => (f.status === "info" ? { ...f, status: "error" as const } : f));
      job.status = "error";
      console.error(`[job ${job.id}]`, err);
    });
}

/** Turns provider errors into something a business owner can act on. */
export function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/401|invalid x-api-key|authentication/i.test(msg)) return "The AI service rejected the API key. Check ANTHROPIC_API_KEY or GEMINI_API_KEY in .env.local.";
  if (/429|503|rate limit|overloaded|high demand|unavailable/i.test(msg)) return "The AI service is busy right now. Try again in a minute.";
  if (/No LLM configured/i.test(msg)) return "No AI service is set up. Add ANTHROPIC_API_KEY or GEMINI_API_KEY to .env.local.";
  return msg;
}
