-- ============================================================================
-- Phase 19 — Employee monitoring (FEASIBILITY-CONSTRAINED)
--
-- IMPORTANT: continuous, silent, background screenshot capture is NOT possible
-- from a web browser — the screen-capture API requires explicit per-session
-- user consent and cannot run invisibly on a timer. This implements the
-- feasible version: OPT-IN screen-share capture the employee consents to, with
-- an admin-configurable interval that a future NATIVE DESKTOP AGENT would
-- consume for true background monitoring. See docs/hosting.md.
-- ============================================================================

insert into public.permissions (key, description, category) values
  ('monitoring.view', 'View monitoring captures', 'monitoring'),
  ('monitoring.config', 'Configure monitoring', 'monitoring')
on conflict (key) do nothing;
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key in ('monitoring.view', 'monitoring.config')
where r.slug = 'hr'
on conflict do nothing;

create table if not exists public.monitoring_config (
  id boolean primary key default true,
  constraint monitoring_config_singleton check (id),
  capture_interval_minutes integer not null default 15 check (capture_interval_minutes in (10, 15, 20, 30)),
  updated_at timestamptz not null default now()
);
insert into public.monitoring_config (id) values (true) on conflict (id) do nothing;

create table if not exists public.screenshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  captured_at timestamptz not null default now(),
  system_name text,
  activity_status text not null default 'active' check (activity_status in ('active', 'idle')),
  storage_path text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_screenshots_user on public.screenshots(user_id, captured_at);

create trigger trg_monitoring_config_updated before update on public.monitoring_config
  for each row execute function public.set_updated_at();

-- RLS -------------------------------------------------------------------------
alter table public.monitoring_config enable row level security;
alter table public.screenshots enable row level security;

create policy monitoring_config_select on public.monitoring_config for select to authenticated
  using (public.has_permission('monitoring.view') or public.has_permission('monitoring.config'));
create policy monitoring_config_write on public.monitoring_config for all to authenticated
  using (public.has_permission('monitoring.config')) with check (public.has_permission('monitoring.config'));

create policy screenshots_select on public.screenshots for select to authenticated
  using (user_id = auth.uid() or public.has_permission('monitoring.view'));
create policy screenshots_insert on public.screenshots for insert to authenticated
  with check (user_id = auth.uid()); -- employees opt in to capturing their own

-- Storage policies for the private screenshots bucket -----------------------
create policy screenshots_insert_obj on storage.objects for insert to authenticated
  with check (bucket_id = 'screenshots' and (storage.foldername(name))[1] = auth.uid()::text);
create policy screenshots_select_obj on storage.objects for select to authenticated
  using (
    bucket_id = 'screenshots'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.has_permission('monitoring.view'))
  );
