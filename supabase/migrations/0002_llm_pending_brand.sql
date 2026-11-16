-- Onboarding runs the AI before the brand row exists. Calls made then keep the brand id here,
-- and are linked (brand_id set) when the brand is first saved.
alter table public.llm_calls add column pending_brand_id uuid;
create index llm_calls_pending_brand_idx on public.llm_calls(pending_brand_id) where pending_brand_id is not null;

create or replace function public.link_pending_llm_calls() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.llm_calls
     set brand_id = new.id, workspace_id = coalesce(workspace_id, new.workspace_id), pending_brand_id = null
   where pending_brand_id = new.id;
  return new;
end $$;

create trigger brands_link_llm_calls after insert on public.brands
  for each row execute function public.link_pending_llm_calls();
