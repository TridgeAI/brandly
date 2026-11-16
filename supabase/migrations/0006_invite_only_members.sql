-- Members can only join through a valid invite.
-- Before: members_insert let any admin insert any user_id into workspace_members.
-- Now: clients cannot insert at all. Rows are created by the signup/workspace triggers
-- (security definer) and by accept_invite() below.
drop policy members_insert on public.workspace_members;

create or replace function public.accept_invite(invite_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  mail text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  inv public.workspace_invites%rowtype;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  -- Lock the row so two concurrent accepts cannot both succeed.
  select * into inv from public.workspace_invites where token = invite_token for update;
  if not found
     or inv.accepted_at is not null
     or inv.expires_at < now()
     or lower(inv.email) <> mail then
    -- One message for every failure so tokens cannot be probed.
    raise exception 'invalid or expired invite' using errcode = '42501';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (inv.workspace_id, uid, inv.role)
  on conflict (workspace_id, user_id) do nothing;

  update public.workspace_invites set accepted_at = now() where id = inv.id;
  return inv.workspace_id;
end $$;

revoke all on function public.accept_invite(text) from public, anon;
grant execute on function public.accept_invite(text) to authenticated;
