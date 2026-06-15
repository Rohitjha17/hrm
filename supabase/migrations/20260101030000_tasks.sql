-- ============================================================================
-- Phase 3 — Task management
-- Self-created & assigned tasks, an editable status master, and a full per-task
-- status history (actor, timestamp, remarks). Task changes stream via Realtime.
-- ============================================================================

create table if not exists public.task_statuses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  sort_order integer not null default 0,
  is_terminal boolean not null default false,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  task_type text not null default 'self' check (task_type in ('self', 'assigned')),
  created_by uuid not null references public.profiles(id) on delete cascade,
  assignee_id uuid references public.profiles(id) on delete set null,
  status_id uuid not null references public.task_statuses(id),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tasks_assignee on public.tasks(assignee_id);
create index if not exists idx_tasks_creator on public.tasks(created_by);
create index if not exists idx_tasks_status on public.tasks(status_id);

create table if not exists public.task_status_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  from_status_id uuid references public.task_statuses(id),
  to_status_id uuid not null references public.task_statuses(id),
  changed_by uuid references public.profiles(id) on delete set null,
  remarks text,
  created_at timestamptz not null default now()
);
create index if not exists idx_task_history_task on public.task_status_history(task_id);

create trigger trg_tasks_updated before update on public.tasks
  for each row execute function public.set_updated_at();

-- Seed editable status master -------------------------------------------------
insert into public.task_statuses (slug, name, sort_order, is_terminal, is_system) values
  ('pending', 'Pending', 1, false, true),
  ('in_progress', 'In Progress', 2, false, true),
  ('on_hold', 'On Hold', 3, false, true),
  ('completed', 'Completed', 4, true, true)
on conflict (slug) do nothing;

-- History: record initial status on task creation -----------------------------
create or replace function public.task_created_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.task_status_history (task_id, from_status_id, to_status_id, changed_by, remarks)
  values (new.id, null, new.status_id, coalesce(auth.uid(), new.created_by), 'Task created');
  return new;
end;
$$;

create trigger trg_task_created after insert on public.tasks
  for each row execute function public.task_created_history();

-- Status-change RPC: authorize, update, and record history (with remarks) -----
create or replace function public.update_task_status(p_task uuid, p_status uuid, p_remarks text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  t public.tasks;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select * into t from public.tasks where id = p_task;
  if not found then raise exception 'task not found'; end if;
  if not (t.created_by = v_user or t.assignee_id = v_user or public.has_permission('tasks.manage')) then
    raise exception 'not allowed to update this task';
  end if;

  update public.tasks set status_id = p_status where id = p_task;
  insert into public.task_status_history (task_id, from_status_id, to_status_id, changed_by, remarks)
  values (p_task, t.status_id, p_status, v_user, p_remarks);

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.update_task_status(uuid, uuid, text) to authenticated;

-- RLS -------------------------------------------------------------------------
alter table public.task_statuses enable row level security;
alter table public.tasks enable row level security;
alter table public.task_status_history enable row level security;

create policy task_statuses_select on public.task_statuses for select to authenticated using (true);
create policy task_statuses_write on public.task_statuses for all to authenticated
  using (public.has_permission('tasks.manage'))
  with check (public.has_permission('tasks.manage'));

-- Tasks: see your own (created or assigned) or all (tasks.view_all).
create policy tasks_select on public.tasks for select to authenticated
  using (
    created_by = auth.uid()
    or assignee_id = auth.uid()
    or public.has_permission('tasks.view_all')
  );
-- Create your own; assigning to someone else requires tasks.assign.
create policy tasks_insert on public.tasks for insert to authenticated
  with check (
    created_by = auth.uid()
    and (assignee_id = auth.uid() or assignee_id is null or public.has_permission('tasks.assign'))
  );
create policy tasks_update on public.tasks for update to authenticated
  using (created_by = auth.uid() or assignee_id = auth.uid() or public.has_permission('tasks.manage'))
  with check (created_by = auth.uid() or assignee_id = auth.uid() or public.has_permission('tasks.manage'));
create policy tasks_delete on public.tasks for delete to authenticated
  using (created_by = auth.uid() or public.has_permission('tasks.manage'));

-- History readable if you can see the task; written only by trigger/RPC.
create policy task_history_select on public.task_status_history for select to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id
        and (t.created_by = auth.uid() or t.assignee_id = auth.uid()
             or public.has_permission('tasks.view_all'))
    )
  );

-- Realtime for live task updates ---------------------------------------------
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.task_status_history;
