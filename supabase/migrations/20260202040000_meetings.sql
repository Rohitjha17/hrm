-- ============================================================================
-- Internal meetings (Visitors & Meetings tab)
-- Any employee can host a meeting, invite colleagues, and share a link.
-- Invitees see their upcoming meetings and accept/decline the invitation.
-- Admin oversight via the existing visitors.manage permission
-- ("Manage visitors & meetings").
-- ============================================================================

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  meeting_link text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  host_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_meetings_host on public.meetings(host_id);
create index if not exists idx_meetings_starts on public.meetings(starts_at);

create table if not exists public.meeting_invitees (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'accepted', 'declined')),
  responded_at timestamptz,
  unique (meeting_id, user_id)
);
create index if not exists idx_meeting_invitees_user on public.meeting_invitees(user_id);
create index if not exists idx_meeting_invitees_meeting on public.meeting_invitees(meeting_id);

create trigger trg_meetings_updated before update on public.meetings
  for each row execute function public.set_updated_at();

-- RLS -------------------------------------------------------------------------
alter table public.meetings enable row level security;
alter table public.meeting_invitees enable row level security;

-- Meetings visible to the host, any invitee, or visitors/meetings admins.
create policy meetings_select on public.meetings for select to authenticated
  using (
    host_id = auth.uid()
    or public.has_permission('visitors.manage')
    or exists (select 1 from public.meeting_invitees i where i.meeting_id = meetings.id and i.user_id = auth.uid())
  );
create policy meetings_insert on public.meetings for insert to authenticated
  with check (host_id = auth.uid() or public.has_permission('visitors.manage'));
create policy meetings_update on public.meetings for update to authenticated
  using (host_id = auth.uid() or public.has_permission('visitors.manage'))
  with check (host_id = auth.uid() or public.has_permission('visitors.manage'));
create policy meetings_delete on public.meetings for delete to authenticated
  using (host_id = auth.uid() or public.has_permission('visitors.manage'));

-- Invitee rows: visible to the meeting host, the invitee, or admins.
create policy meeting_invitees_select on public.meeting_invitees for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_permission('visitors.manage')
    or exists (select 1 from public.meetings m where m.id = meeting_id and m.host_id = auth.uid())
  );
-- Only the host (or admin) builds the invite list.
create policy meeting_invitees_insert on public.meeting_invitees for insert to authenticated
  with check (
    public.has_permission('visitors.manage')
    or exists (select 1 from public.meetings m where m.id = meeting_id and m.host_id = auth.uid())
  );
-- Invitees respond to their own invitation; hosts/admins can adjust too.
create policy meeting_invitees_update on public.meeting_invitees for update to authenticated
  using (
    user_id = auth.uid()
    or public.has_permission('visitors.manage')
    or exists (select 1 from public.meetings m where m.id = meeting_id and m.host_id = auth.uid())
  )
  with check (
    user_id = auth.uid()
    or public.has_permission('visitors.manage')
    or exists (select 1 from public.meetings m where m.id = meeting_id and m.host_id = auth.uid())
  );
create policy meeting_invitees_delete on public.meeting_invitees for delete to authenticated
  using (
    public.has_permission('visitors.manage')
    or exists (select 1 from public.meetings m where m.id = meeting_id and m.host_id = auth.uid())
  );

alter publication supabase_realtime add table public.meetings;
alter publication supabase_realtime add table public.meeting_invitees;
