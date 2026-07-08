-- ============================================================================
-- Fix: infinite RLS recursion between meetings and meeting_invitees.
-- meetings_select referenced meeting_invitees while meeting_invitees policies
-- referenced meetings — Postgres detects the cycle (42P17). Break it with
-- SECURITY DEFINER helpers that check membership without invoking RLS.
-- ============================================================================

create or replace function public.is_meeting_host(p_meeting uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.meetings m where m.id = p_meeting and m.host_id = auth.uid());
$$;
grant execute on function public.is_meeting_host(uuid) to authenticated;

create or replace function public.is_meeting_invitee(p_meeting uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.meeting_invitees i where i.meeting_id = p_meeting and i.user_id = auth.uid());
$$;
grant execute on function public.is_meeting_invitee(uuid) to authenticated;

drop policy if exists meetings_select on public.meetings;
create policy meetings_select on public.meetings for select to authenticated
  using (
    host_id = auth.uid()
    or public.has_permission('visitors.manage')
    or public.is_meeting_invitee(id)
  );

drop policy if exists meeting_invitees_select on public.meeting_invitees;
create policy meeting_invitees_select on public.meeting_invitees for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_permission('visitors.manage')
    or public.is_meeting_host(meeting_id)
  );

drop policy if exists meeting_invitees_insert on public.meeting_invitees;
create policy meeting_invitees_insert on public.meeting_invitees for insert to authenticated
  with check (public.has_permission('visitors.manage') or public.is_meeting_host(meeting_id));

drop policy if exists meeting_invitees_update on public.meeting_invitees;
create policy meeting_invitees_update on public.meeting_invitees for update to authenticated
  using (
    user_id = auth.uid()
    or public.has_permission('visitors.manage')
    or public.is_meeting_host(meeting_id)
  )
  with check (
    user_id = auth.uid()
    or public.has_permission('visitors.manage')
    or public.is_meeting_host(meeting_id)
  );

drop policy if exists meeting_invitees_delete on public.meeting_invitees;
create policy meeting_invitees_delete on public.meeting_invitees for delete to authenticated
  using (public.has_permission('visitors.manage') or public.is_meeting_host(meeting_id));
