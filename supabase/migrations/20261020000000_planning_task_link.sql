-- Requirement 18: categories and a durable pending-task link from planning slots.
create table if not exists public.task_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) > 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_task_categories_updated before update on public.task_categories
  for each row execute function public.set_updated_at();

alter table public.task_categories enable row level security;
create policy task_categories_select on public.task_categories
  for select to authenticated using (true);
create policy task_categories_insert on public.task_categories
  for insert to authenticated with check (created_by = auth.uid());
create policy task_categories_update on public.task_categories
  for update to authenticated using (public.has_permission('tasks.manage'))
  with check (public.has_permission('tasks.manage'));
create policy task_categories_delete on public.task_categories
  for delete to authenticated using (public.has_permission('tasks.manage'));

insert into public.task_categories (name, sort_order)
values ('General', 0)
on conflict (name) do nothing;

alter table public.tasks
  add column if not exists category_id uuid references public.task_categories(id) on delete set null;

update public.tasks
set category_id = (select id from public.task_categories where name = 'General')
where category_id is null;

create index if not exists idx_tasks_category on public.tasks(category_id);

alter table public.planning_slots
  add column if not exists task_id uuid references public.tasks(id) on delete set null;
create index if not exists idx_planning_slots_task on public.planning_slots(task_id);

alter publication supabase_realtime add table public.task_categories;
