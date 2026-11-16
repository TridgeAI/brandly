-- Brandly initial schema
-- Tenancy: auth.users → profiles; workspaces ← workspace_members(role) → every tenant row carries workspace_id.
-- Learning data: llm_calls (every model call), content_events (implicit feedback),
-- generation_feedback (explicit), field_corrections (brand-model edits), build_sessions (pairwise choices),
-- post_metrics (real-world outcome), product_events (funnels).

-- ───────────────────────────────────────────────────────────── helpers
alter table public._migrations enable row level security; -- never exposed through the API

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ───────────────────────────────────────────────────────────── identity & tenancy
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  role_title text,
  company_size text,
  signup_source text,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  plan text not null default 'free',
  owner_id uuid not null references auth.users(id) on delete cascade,
  personal boolean not null default false,
  -- DPDP: content is only used to improve models when the workspace opts in.
  data_training_opt_in boolean not null default false,
  consent_at timestamptz,
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner', 'admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on public.workspace_members(user_id);

create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'editor' check (role in ('admin', 'editor', 'viewer')),
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- Membership checks used by every RLS policy. SECURITY DEFINER so they can read
-- workspace_members without recursing into its own policies.
create or replace function public.is_member(ws uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.has_role(ws uuid, roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = (select auth.uid()) and m.role = any(roles)
  );
$$;

create or replace function public.can_edit(ws uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_role(ws, array['owner', 'admin', 'editor']);
$$;

-- Storage paths are "<workspace_id>/...".
create or replace function public.can_access_path(path text, need_edit boolean) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  ws uuid;
begin
  begin
    ws := split_part(path, '/', 1)::uuid;
  exception when others then
    return false;
  end;
  if need_edit then return public.can_edit(ws); end if;
  return public.is_member(ws);
end $$;

-- New user → profile + personal workspace + owner membership.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  ws_id uuid;
  display_name text := coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1));
  opt_in boolean := coalesce((new.raw_user_meta_data->>'training_opt_in')::boolean, false);
begin
  insert into public.profiles (id, email, full_name, signup_source)
  values (new.id, new.email, display_name, new.raw_user_meta_data->>'signup_source');

  insert into public.workspaces (name, owner_id, personal, data_training_opt_in, consent_at, terms_accepted_at)
  values (
    display_name || '''s workspace', new.id, true, opt_in,
    case when opt_in then now() end,
    case when (new.raw_user_meta_data->>'terms_accepted')::boolean then now() end
  )
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role) values (ws_id, new.id, 'owner') on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────────────────────────────────────────── brand
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  mode text not null default 'analyse' check (mode in ('analyse', 'build', 'refine')),
  current_version_id uuid,
  sources jsonb not null default '{}'::jsonb,
  logo_path text,
  legacy_id text, -- id from the old localStorage store, kept for imports
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index brands_workspace_idx on public.brands(workspace_id, created_at desc);

-- Append-only history of the Brand Model. brands.current_version_id points at the latest.
create table public.brand_versions (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  version int not null,
  model jsonb not null,
  changed_paths text[] not null default '{}',
  source text not null check (source in ('stage', 'user', 'import', 'rollback', 'build')),
  stage_id text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (brand_id, version)
);
create index brand_versions_brand_idx on public.brand_versions(brand_id, version desc);

alter table public.brands
  add constraint brands_current_version_fk
  foreign key (current_version_id) references public.brand_versions(id) on delete set null;

create table public.brand_evidence (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source text not null check (source in ('website', 'instagram', 'pdf', 'upload')),
  url text,
  summary text,
  raw jsonb,
  storage_path text,
  created_at timestamptz not null default now()
);
create index brand_evidence_brand_idx on public.brand_evidence(brand_id);

-- Build door: every direction shown + the one picked (preference data).
create table public.build_sessions (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  directions jsonb not null default '[]'::jsonb,
  selected_index int,
  selected_at timestamptz,
  llm_call_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index build_sessions_brand_idx on public.build_sessions(brand_id);

-- A user changing a field the AI filled in: measures extraction accuracy per field.
create table public.field_corrections (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  version_id uuid references public.brand_versions(id) on delete set null,
  field_path text not null,
  old_value jsonb,
  new_value jsonb,
  prior_source text, -- extracted | inferred | generated | user
  prior_confidence real,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index field_corrections_brand_idx on public.field_corrections(brand_id, created_at desc);
create index field_corrections_path_idx on public.field_corrections(field_path);

-- ───────────────────────────────────────────────────────────── content
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  generation_id uuid, -- llm_calls.id that produced original_content
  template text,
  topic text,
  platforms text[] not null default '{}',
  content jsonb not null,           -- current (possibly edited) GeneratedPost
  original_content jsonb,           -- exactly what the model returned; never updated
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'failed', 'discarded')),
  scheduled_at timestamptz,
  published_at timestamptz,
  media_path text,
  media_url text,
  notes text,
  legacy_id text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index posts_workspace_idx on public.posts(workspace_id, created_at desc);
create index posts_brand_idx on public.posts(brand_id, scheduled_at);

create table public.post_publications (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'facebook', 'linkedin', 'twitter')),
  external_id text,
  url text,
  status text not null default 'pending' check (status in ('pending', 'published', 'failed')),
  error text,
  published_at timestamptz,
  created_at timestamptz not null default now()
);
create index post_publications_post_idx on public.post_publications(post_id);

create table public.post_metrics (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.post_publications(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  captured_at timestamptz not null default now(),
  impressions int,
  reach int,
  likes int,
  comments int,
  shares int,
  saves int,
  clicks int,
  raw jsonb
);
create index post_metrics_pub_idx on public.post_metrics(publication_id, captured_at desc);

create table public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  trigger jsonb not null,
  platforms text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'paused', 'error')),
  last_run_at timestamptz,
  next_run_at timestamptz,
  posts_generated int not null default 0,
  legacy_id text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index automation_rules_due_idx on public.automation_rules(next_run_at) where status = 'active';

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete cascade,
  kind text not null check (kind in ('pdf', 'image', 'logo', 'evidence')),
  storage_path text not null,
  mime text,
  bytes bigint,
  source_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ───────────────────────────────────────────────────────────── learning / flywheel
-- Reference prices (USD per million tokens). Fill in from provider pricing pages.
create table public.model_prices (
  model text primary key,
  provider text not null,
  input_per_mtok numeric not null,
  output_per_mtok numeric not null,
  cached_input_per_mtok numeric,
  updated_at timestamptz not null default now()
);

-- One row per successful or failed provider call. Written by the server (service role).
create table public.llm_calls (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  feature text not null,          -- 'generate-post', 'stage:extract', 'voice-sample', ...
  task text,                      -- fast | vision | creative
  provider text,
  model text,
  prompt_version text,
  system_hash text,
  input jsonb,                    -- {system, user, cachedContext?} or a reference
  output text,
  parsed_ok boolean,
  input_tokens int,
  output_tokens int,
  cache_read_tokens int,
  cache_write_tokens int,
  cost_usd numeric,
  latency_ms int,
  attempts int not null default 1,
  fallback_from text,             -- models tried before this one, comma-separated
  error text,
  created_at timestamptz not null default now()
);
create index llm_calls_workspace_idx on public.llm_calls(workspace_id, created_at desc);
create index llm_calls_feature_idx on public.llm_calls(feature, created_at desc);
create index llm_calls_brand_idx on public.llm_calls(brand_id);

alter table public.posts
  add constraint posts_generation_fk foreign key (generation_id) references public.llm_calls(id) on delete set null;
alter table public.build_sessions
  add constraint build_sessions_llm_fk foreign key (llm_call_id) references public.llm_calls(id) on delete set null;

-- Explicit feedback (thumbs / stars + reasons).
create table public.generation_feedback (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  llm_call_id uuid references public.llm_calls(id) on delete set null,
  post_id uuid references public.posts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  rating smallint not null check (rating between -1 and 5),
  reasons text[] not null default '{}',
  comment text,
  created_at timestamptz not null default now(),
  check (llm_call_id is not null or post_id is not null)
);
create index generation_feedback_post_idx on public.generation_feedback(post_id);
create index generation_feedback_call_idx on public.generation_feedback(llm_call_id);

-- Implicit feedback: what people did with a generation.
create table public.content_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  llm_call_id uuid references public.llm_calls(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  event text not null check (event in (
    'generated', 'regenerated', 'edited', 'copied', 'scheduled', 'rescheduled',
    'published', 'discarded', 'variant_selected', 'image_generated'
  )),
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index content_events_post_idx on public.content_events(post_id);
create index content_events_ws_idx on public.content_events(workspace_id, created_at desc);

-- Product analytics (onboarding funnel, feature use).
create table public.product_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  brand_id uuid references public.brands(id) on delete set null,
  name text not null,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index product_events_name_idx on public.product_events(name, created_at desc);
create index product_events_ws_idx on public.product_events(workspace_id, created_at desc);

-- Long-running stage runs (replaces the in-memory job map).
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete cascade,
  stage text not null,
  status text not null default 'running' check (status in ('running', 'done', 'error')),
  findings jsonb not null default '[]'::jsonb,
  result jsonb,
  error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jobs_brand_idx on public.jobs(brand_id, created_at desc);

-- ───────────────────────────────────────────────────────────── triggers
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger workspaces_updated before update on public.workspaces for each row execute function public.set_updated_at();
create trigger brands_updated before update on public.brands for each row execute function public.set_updated_at();
create trigger build_sessions_updated before update on public.build_sessions for each row execute function public.set_updated_at();
create trigger posts_updated before update on public.posts for each row execute function public.set_updated_at();
create trigger automation_rules_updated before update on public.automation_rules for each row execute function public.set_updated_at();
create trigger jobs_updated before update on public.jobs for each row execute function public.set_updated_at();

-- Child rows always inherit workspace_id from their brand (prevents cross-tenant mix-ups).
create or replace function public.inherit_brand_workspace() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.brand_id is not null then
    select b.workspace_id into new.workspace_id from public.brands b where b.id = new.brand_id;
  end if;
  return new;
end $$;

create trigger brand_versions_ws before insert on public.brand_versions for each row execute function public.inherit_brand_workspace();
create trigger brand_evidence_ws before insert on public.brand_evidence for each row execute function public.inherit_brand_workspace();
create trigger build_sessions_ws before insert on public.build_sessions for each row execute function public.inherit_brand_workspace();
create trigger field_corrections_ws before insert on public.field_corrections for each row execute function public.inherit_brand_workspace();
create trigger posts_ws before insert on public.posts for each row execute function public.inherit_brand_workspace();
create trigger automation_rules_ws before insert on public.automation_rules for each row execute function public.inherit_brand_workspace();
create trigger jobs_ws before insert on public.jobs for each row execute function public.inherit_brand_workspace();

create or replace function public.inherit_post_workspace() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.post_id is not null then
    select p.workspace_id into new.workspace_id from public.posts p where p.id = new.post_id;
  end if;
  return new;
end $$;
create trigger post_publications_ws before insert on public.post_publications for each row execute function public.inherit_post_workspace();
create trigger content_events_ws before insert on public.content_events for each row execute function public.inherit_post_workspace();
create trigger generation_feedback_ws before insert on public.generation_feedback for each row execute function public.inherit_post_workspace();

-- Brand versions: number sequentially, then point the brand at the new version.
create or replace function public.brand_version_before() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.brands where id = new.brand_id for update;
  select coalesce(max(v.version), 0) + 1 into new.version from public.brand_versions v where v.brand_id = new.brand_id;
  return new;
end $$;

create or replace function public.brand_version_after() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.brands set current_version_id = new.id, name = coalesce(new.model->>'name', name) where id = new.brand_id;
  return new;
end $$;

create trigger brand_versions_number before insert on public.brand_versions for each row execute function public.brand_version_before();
create trigger brand_versions_current after insert on public.brand_versions for each row execute function public.brand_version_after();

-- original_content is the model's raw output and must never change.
create or replace function public.posts_freeze_original() returns trigger
language plpgsql as $$
begin
  if old.original_content is not null then
    new.original_content = old.original_content;
  end if;
  return new;
end $$;
create trigger posts_original_frozen before update on public.posts for each row execute function public.posts_freeze_original();

-- ───────────────────────────────────────────────────────────── RLS
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.brands enable row level security;
alter table public.brand_versions enable row level security;
alter table public.brand_evidence enable row level security;
alter table public.build_sessions enable row level security;
alter table public.field_corrections enable row level security;
alter table public.posts enable row level security;
alter table public.post_publications enable row level security;
alter table public.post_metrics enable row level security;
alter table public.automation_rules enable row level security;
alter table public.media_assets enable row level security;
alter table public.model_prices enable row level security;
alter table public.llm_calls enable row level security;
alter table public.generation_feedback enable row level security;
alter table public.content_events enable row level security;
alter table public.product_events enable row level security;
alter table public.jobs enable row level security;

-- profiles: yourself, and people you share a workspace with.
create policy profiles_select on public.profiles for select to authenticated using (
  id = (select auth.uid())
  or exists (
    select 1 from public.workspace_members a
    join public.workspace_members b on a.workspace_id = b.workspace_id
    where a.user_id = (select auth.uid()) and b.user_id = profiles.id
  )
);
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- workspaces
create policy workspaces_select on public.workspaces for select to authenticated using (public.is_member(id));
create policy workspaces_insert on public.workspaces for insert to authenticated with check (owner_id = (select auth.uid()));
create policy workspaces_update on public.workspaces for update to authenticated
  using (public.has_role(id, array['owner', 'admin'])) with check (public.has_role(id, array['owner', 'admin']));
create policy workspaces_delete on public.workspaces for delete to authenticated using (public.has_role(id, array['owner']));

-- creator of a new workspace becomes its owner
create or replace function public.add_workspace_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner') on conflict do nothing;
  return new;
end $$;
create trigger workspaces_owner after insert on public.workspaces for each row execute function public.add_workspace_owner();

-- members
create policy members_select on public.workspace_members for select to authenticated using (public.is_member(workspace_id));
create policy members_insert on public.workspace_members for insert to authenticated
  with check (public.has_role(workspace_id, array['owner', 'admin']) and role <> 'owner');
create policy members_update on public.workspace_members for update to authenticated
  using (public.has_role(workspace_id, array['owner', 'admin'])) with check (role <> 'owner');
create policy members_delete on public.workspace_members for delete to authenticated
  using ((public.has_role(workspace_id, array['owner', 'admin']) and role <> 'owner') or (user_id = (select auth.uid()) and role <> 'owner'));

-- invites
create policy invites_all on public.workspace_invites for all to authenticated
  using (public.has_role(workspace_id, array['owner', 'admin']))
  with check (public.has_role(workspace_id, array['owner', 'admin']));

-- Standard tenant tables: members read, editors write.
do $$
declare t text;
begin
  foreach t in array array[
    'brands', 'brand_evidence', 'build_sessions', 'posts', 'post_publications',
    'post_metrics', 'automation_rules', 'media_assets', 'jobs'
  ] loop
    execute format('create policy %1$s_select on public.%1$I for select to authenticated using (public.is_member(workspace_id))', t);
    execute format('create policy %1$s_insert on public.%1$I for insert to authenticated with check (public.can_edit(workspace_id))', t);
    execute format('create policy %1$s_update on public.%1$I for update to authenticated using (public.can_edit(workspace_id)) with check (public.can_edit(workspace_id))', t);
    execute format('create policy %1$s_delete on public.%1$I for delete to authenticated using (public.can_edit(workspace_id))', t);
  end loop;
end $$;

-- Append-only tables: read + insert, no update/delete (rows go away with their brand/workspace).
create policy brand_versions_select on public.brand_versions for select to authenticated using (public.is_member(workspace_id));
create policy brand_versions_insert on public.brand_versions for insert to authenticated
  with check (public.can_edit(workspace_id) and created_by = (select auth.uid()));

create policy field_corrections_select on public.field_corrections for select to authenticated using (public.is_member(workspace_id));
create policy field_corrections_insert on public.field_corrections for insert to authenticated
  with check (public.can_edit(workspace_id) and user_id = (select auth.uid()));

create policy feedback_select on public.generation_feedback for select to authenticated using (public.is_member(workspace_id));
create policy feedback_insert on public.generation_feedback for insert to authenticated
  with check (public.is_member(workspace_id) and user_id = (select auth.uid()));

create policy content_events_select on public.content_events for select to authenticated using (public.is_member(workspace_id));
create policy content_events_insert on public.content_events for insert to authenticated
  with check (public.is_member(workspace_id) and user_id = (select auth.uid()));

create policy product_events_select on public.product_events for select to authenticated using (public.is_member(workspace_id));
create policy product_events_insert on public.product_events for insert to authenticated
  with check (user_id = (select auth.uid()) and (workspace_id is null or public.is_member(workspace_id)));

-- llm_calls: written only by the server (service role bypasses RLS); members can read their own.
create policy llm_calls_select on public.llm_calls for select to authenticated using (public.is_member(workspace_id));

create policy model_prices_select on public.model_prices for select to authenticated using (true);

-- ───────────────────────────────────────────────────────────── storage
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('pdfs', 'pdfs', false, 52428800),
  ('evidence', 'evidence', false, 10485760),
  ('images', 'images', false, 20971520),
  ('logos', 'logos', false, 5242880)
on conflict (id) do nothing;

create policy brandly_storage_select on storage.objects for select to authenticated
  using (bucket_id in ('pdfs', 'evidence', 'images', 'logos') and public.can_access_path(name, false));
create policy brandly_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('pdfs', 'evidence', 'images', 'logos') and public.can_access_path(name, true));
create policy brandly_storage_update on storage.objects for update to authenticated
  using (bucket_id in ('pdfs', 'evidence', 'images', 'logos') and public.can_access_path(name, true));
create policy brandly_storage_delete on storage.objects for delete to authenticated
  using (bucket_id in ('pdfs', 'evidence', 'images', 'logos') and public.can_access_path(name, true));

-- ───────────────────────────────────────────────────────────── analysis views
-- security_invoker: views respect the caller's RLS.
create view public.v_llm_cost with (security_invoker = true) as
select
  c.id, c.workspace_id, c.brand_id, c.feature, c.model, c.created_at,
  coalesce(
    c.cost_usd,
    (coalesce(c.input_tokens, 0) - coalesce(c.cache_read_tokens, 0)) * p.input_per_mtok / 1e6
      + coalesce(c.cache_read_tokens, 0) * coalesce(p.cached_input_per_mtok, p.input_per_mtok) / 1e6
      + coalesce(c.output_tokens, 0) * p.output_per_mtok / 1e6
  ) as cost_usd
from public.llm_calls c
left join public.model_prices p on p.model = c.model;

create view public.v_cost_per_brand with (security_invoker = true) as
select workspace_id, brand_id, feature, model,
  count(*) as calls, sum(cost_usd) as cost_usd, min(created_at) as first_call, max(created_at) as last_call
from public.v_llm_cost
group by workspace_id, brand_id, feature, model;

create view public.v_post_quality with (security_invoker = true) as
select
  p.id as post_id, p.workspace_id, p.brand_id, p.template, p.status, p.created_at,
  c.model, c.prompt_version,
  (select avg(f.rating)::real from public.generation_feedback f where f.post_id = p.id) as avg_rating,
  (select count(*) from public.content_events e where e.post_id = p.id and e.event = 'regenerated') as regenerations,
  (select (e.props->>'edit_ratio')::real from public.content_events e
     where e.post_id = p.id and e.event = 'edited' order by e.created_at desc limit 1) as last_edit_ratio,
  (p.content is distinct from p.original_content) as was_edited,
  m.impressions, m.likes, m.comments, m.shares, m.saves
from public.posts p
left join public.llm_calls c on c.id = p.generation_id
left join lateral (
  select sum(x.impressions) as impressions, sum(x.likes) as likes, sum(x.comments) as comments,
         sum(x.shares) as shares, sum(x.saves) as saves
  from public.post_publications pub
  join lateral (
    select * from public.post_metrics pm where pm.publication_id = pub.id order by pm.captured_at desc limit 1
  ) x on true
  where pub.post_id = p.id
) m on true;

create view public.v_field_accuracy with (security_invoker = true) as
select workspace_id, field_path, prior_source,
  count(*) as corrections, avg(prior_confidence)::real as avg_prior_confidence
from public.field_corrections
group by workspace_id, field_path, prior_source;
