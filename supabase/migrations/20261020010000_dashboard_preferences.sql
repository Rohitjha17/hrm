-- Requirements 21, 22 and 58: per-user dashboard widget layout.
create table if not exists public.dashboard_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  view_mode text not null check (view_mode in ('admin', 'employee')),
  item_order text[] not null default '{}',
  hidden_items text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, view_mode)
);

alter table public.dashboard_preferences enable row level security;
create policy dashboard_preferences_select_own on public.dashboard_preferences
  for select to authenticated using (user_id = auth.uid());
create policy dashboard_preferences_insert_own on public.dashboard_preferences
  for insert to authenticated with check (user_id = auth.uid());
create policy dashboard_preferences_update_own on public.dashboard_preferences
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy dashboard_preferences_delete_own on public.dashboard_preferences
  for delete to authenticated using (user_id = auth.uid());

create trigger trg_dashboard_preferences_updated before update on public.dashboard_preferences
  for each row execute function public.set_updated_at();
