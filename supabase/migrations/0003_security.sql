-- 0003 · Security hardening (Learning Engine phase 0)
-- Fixes found in review: members policy escalation, tenant mixing on UPDATE,
-- post_metrics without workspace inheritance, unscoped pending-LLM linking.

-- ── workspace_members: no escalation, owner row untouchable ─────────────────
drop policy members_update on public.workspace_members;
create policy members_update on public.workspace_members for update to authenticated
  using (public.has_role(workspace_id, array['owner', 'admin']) and role <> 'owner')
  with check (public.has_role(workspace_id, array['owner', 'admin']) and role <> 'owner');

-- A membership row can change role only; never move to another workspace or user.
create or replace function public.members_freeze_keys() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.workspace_id is distinct from old.workspace_id or new.user_id is distinct from old.user_id then
    raise exception 'workspace_id and user_id of a membership cannot change';
  end if;
  return new;
end $$;
create trigger workspace_members_freeze before update on public.workspace_members
  for each row execute function public.members_freeze_keys();

-- ── Tenant inheritance also on UPDATE (previously INSERT only) ──────────────
drop trigger brand_versions_ws on public.brand_versions;
drop trigger brand_evidence_ws on public.brand_evidence;
drop trigger build_sessions_ws on public.build_sessions;
drop trigger field_corrections_ws on public.field_corrections;
drop trigger posts_ws on public.posts;
drop trigger automation_rules_ws on public.automation_rules;
drop trigger jobs_ws on public.jobs;
drop trigger post_publications_ws on public.post_publications;
drop trigger content_events_ws on public.content_events;
drop trigger generation_feedback_ws on public.generation_feedback;

create trigger brand_versions_ws before insert or update of brand_id, workspace_id on public.brand_versions for each row execute function public.inherit_brand_workspace();
create trigger brand_evidence_ws before insert or update of brand_id, workspace_id on public.brand_evidence for each row execute function public.inherit_brand_workspace();
create trigger build_sessions_ws before insert or update of brand_id, workspace_id on public.build_sessions for each row execute function public.inherit_brand_workspace();
create trigger field_corrections_ws before insert or update of brand_id, workspace_id on public.field_corrections for each row execute function public.inherit_brand_workspace();
create trigger posts_ws before insert or update of brand_id, workspace_id on public.posts for each row execute function public.inherit_brand_workspace();
create trigger automation_rules_ws before insert or update of brand_id, workspace_id on public.automation_rules for each row execute function public.inherit_brand_workspace();
create trigger jobs_ws before insert or update of brand_id, workspace_id on public.jobs for each row execute function public.inherit_brand_workspace();
create trigger media_assets_ws before insert or update of brand_id, workspace_id on public.media_assets for each row execute function public.inherit_brand_workspace();

create trigger post_publications_ws before insert or update of post_id, workspace_id on public.post_publications for each row execute function public.inherit_post_workspace();
create trigger content_events_ws before insert or update of post_id, workspace_id on public.content_events for each row execute function public.inherit_post_workspace();
create trigger generation_feedback_ws before insert or update of post_id, workspace_id on public.generation_feedback for each row execute function public.inherit_post_workspace();

-- ── post_metrics: workspace comes from its publication, never the client ────
create or replace function public.inherit_publication_workspace() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select p.workspace_id into new.workspace_id from public.post_publications p where p.id = new.publication_id;
  if new.workspace_id is null then
    raise exception 'unknown publication %', new.publication_id;
  end if;
  return new;
end $$;
create trigger post_metrics_ws before insert or update of publication_id, workspace_id on public.post_metrics
  for each row execute function public.inherit_publication_workspace();

-- ── Event/feedback rows with no post: client-supplied workspace must be theirs ─
-- (RLS write policies already require can_edit(workspace_id); this also ties any
-- referenced llm_call to the same workspace.)
create or replace function public.check_llm_call_workspace() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.llm_call_id is not null and not exists (
    select 1 from public.llm_calls c where c.id = new.llm_call_id and c.workspace_id = new.workspace_id
  ) then
    raise exception 'llm_call does not belong to this workspace';
  end if;
  return new;
end $$;
create trigger generation_feedback_llm_ws before insert or update of llm_call_id, workspace_id on public.generation_feedback
  for each row execute function public.check_llm_call_workspace();

-- ── Pending LLM-call linking: same workspace (or same user when unscoped) only ─
create or replace function public.link_pending_llm_calls() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.llm_calls
     set brand_id = new.id, workspace_id = coalesce(workspace_id, new.workspace_id), pending_brand_id = null
   where pending_brand_id = new.id
     and (workspace_id = new.workspace_id or (workspace_id is null and user_id = (select auth.uid())));
  return new;
end $$;
