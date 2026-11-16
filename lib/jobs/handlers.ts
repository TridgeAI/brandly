import "server-only";

// Job handlers, keyed by `kind`. Add new kinds here.
//
// SECURITY: handlers run with the service-role client, which bypasses RLS. Every query a
// handler makes MUST filter by job.workspace_id, and must not trust ids in the payload
// without checking they belong to that workspace.

export interface JobRow {
  id: string;
  kind: string;
  workspace_id: string;
  brand_id: string | null;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
  created_by: string | null;
}

export type JobHandler = (job: JobRow) => Promise<unknown>;

export const HANDLERS: Record<string, JobHandler> = {
  // Used by tests: returns its payload, or throws when payload.fail is true.
  "test.echo": async (job) => {
    if (job.payload.fail === true) throw new Error("test.echo asked to fail");
    return job.payload;
  },
};
