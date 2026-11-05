-- Sidebar: remember which groups a user has collapsed.
alter table public.sidebar_preferences
  add column if not exists collapsed_groups text[] not null default '{}';
