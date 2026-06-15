-- ============================================================================
-- Phase 18 — Announcements, recognition & rewards, visitor/meeting management
-- ============================================================================

insert into public.permissions (key, description, category) values
  ('announcements.manage', 'Publish announcements', 'engagement'),
  ('recognition.manage', 'Award recognition', 'engagement'),
  ('visitors.manage', 'Manage visitors & meetings', 'engagement')
on conflict (key) do nothing;
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p
  on p.key in ('announcements.manage', 'recognition.manage', 'visitors.manage')
where r.slug = 'hr'
on conflict do nothing;

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  category text not null default 'news' check (category in ('holiday', 'meeting', 'policy', 'birthday', 'news', 'alert')),
  published_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.recognitions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  award_type text not null check (award_type in ('star_performer', 'employee_of_month', 'appreciation')),
  points integer not null default 0,
  note text,
  awarded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_recognition_emp on public.recognitions(employee_id);

create table if not exists public.visitors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  purpose text,
  host_id uuid references public.profiles(id) on delete set null,
  visit_date date not null,
  pass_code text not null default substr(gen_random_uuid()::text, 1, 8),
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  created_at timestamptz not null default now()
);

-- RLS -------------------------------------------------------------------------
alter table public.announcements enable row level security;
alter table public.recognitions enable row level security;
alter table public.visitors enable row level security;

-- Announcements + recognition are org-wide readable; managed by HR.
create policy announcements_select on public.announcements for select to authenticated using (true);
create policy announcements_write on public.announcements for all to authenticated
  using (public.has_permission('announcements.manage')) with check (public.has_permission('announcements.manage'));

create policy recognitions_select on public.recognitions for select to authenticated using (true);
create policy recognitions_write on public.recognitions for all to authenticated
  using (public.has_permission('recognition.manage')) with check (public.has_permission('recognition.manage'));

create policy visitors_select on public.visitors for select to authenticated
  using (public.has_permission('visitors.manage'));
create policy visitors_write on public.visitors for all to authenticated
  using (public.has_permission('visitors.manage')) with check (public.has_permission('visitors.manage'));
