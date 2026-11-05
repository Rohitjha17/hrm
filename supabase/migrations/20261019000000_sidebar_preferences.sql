-- Per-user sidebar layout, stored separately for Admin and Employee views.
create table if not exists public.sidebar_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  view_mode text not null check (view_mode in ('admin', 'employee')),
  item_order text[] not null default '{}',
  hidden_items text[] not null default '{}',
  collapsed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, view_mode)
);

alter table public.sidebar_preferences enable row level security;

create policy sidebar_preferences_select_own on public.sidebar_preferences
  for select to authenticated using (user_id = auth.uid());
create policy sidebar_preferences_insert_own on public.sidebar_preferences
  for insert to authenticated with check (user_id = auth.uid());
create policy sidebar_preferences_update_own on public.sidebar_preferences
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy sidebar_preferences_delete_own on public.sidebar_preferences
  for delete to authenticated using (user_id = auth.uid());

drop trigger if exists trg_sidebar_preferences_updated on public.sidebar_preferences;
create trigger trg_sidebar_preferences_updated before update on public.sidebar_preferences
  for each row execute function public.set_updated_at();
