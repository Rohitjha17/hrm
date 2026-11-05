-- Requirements 76–77: editable notices with a dashboard display period.
alter table public.announcements
  add column if not exists starts_at timestamptz not null default now(),
  add column if not exists expires_at timestamptz;

