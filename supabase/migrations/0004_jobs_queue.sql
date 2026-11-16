-- Jobs become a real queue: kind/payload, retries with backoff, dead-letter state,
-- crash recovery, and de-duplication. Only the service role writes; members can read.

alter table public.jobs
  add column kind text not null default 'legacy',
  add column payload jsonb not null default '{}'::jsonb,
  add column run_at timestamptz not null default now(),
  add column attempts int not null default 0,
  add column max_attempts int not null default 5,
  add column locked_at timestamptz,
  add column locked_by text,
  add column dedupe_key text;

alter table public.jobs alter column kind drop default;
alter table public.jobs alter column stage drop not null;

alter table public.jobs drop constraint jobs_status_check;
alter table public.jobs add constraint jobs_status_check
  check (status in ('queued', 'running', 'done', 'error', 'dead'));
alter table public.jobs alter column status set default 'queued';

create index jobs_due_idx on public.jobs(run_at) where status in ('queued', 'error');
create unique index jobs_dedupe_idx on public.jobs(dedupe_key)
  where dedupe_key is not null and status in ('queued', 'running', 'error');

-- Clients never create or change jobs: handlers run with the service role and trust the payload.
drop policy jobs_insert on public.jobs;
drop policy jobs_update on public.jobs;
drop policy jobs_delete on public.jobs;

-- Atomically takes up to p_limit due jobs. Also reclaims jobs whose worker died mid-run.
create or replace function public.claim_jobs(p_worker text, p_limit int, p_stale interval default '10 minutes')
returns setof public.jobs
language sql
security definer
set search_path = public
as $$
  update public.jobs
  set status = 'running', locked_at = now(), locked_by = p_worker, attempts = attempts + 1
  where id in (
    select id from public.jobs
    where (status in ('queued', 'error') and run_at <= now())
       or (status = 'running' and locked_at < now() - p_stale)
    order by run_at
    for update skip locked
    limit p_limit
  )
  returning *;
$$;

revoke execute on function public.claim_jobs(text, int, interval) from public, anon, authenticated;
grant execute on function public.claim_jobs(text, int, interval) to service_role;
