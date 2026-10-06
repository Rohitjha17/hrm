-- ============================================================================
-- Tasks: client requirement sheet items 13–14
--
-- 13. completed_at — when a task reached a terminal status, so lists and the
--     Task Report can show Created and Completed dates.
-- 14. progress_percent — completion % the creator/assignee keeps up to date.
--
-- Both are maintained by a trigger on status changes, so every write path
-- (update_task_status RPC, direct updates, seeds) stays consistent.
-- ============================================================================

alter table public.tasks
  add column if not exists completed_at timestamptz,
  add column if not exists progress_percent integer not null default 0
    check (progress_percent between 0 and 100);

create or replace function public.task_sync_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_terminal boolean;
  v_was_terminal boolean := false;
begin
  select is_terminal into v_terminal from public.task_statuses where id = new.status_id;
  if tg_op = 'UPDATE' then
    select is_terminal into v_was_terminal from public.task_statuses where id = old.status_id;
  end if;

  if coalesce(v_terminal, false) then
    if not coalesce(v_was_terminal, false) then
      new.completed_at := coalesce(new.completed_at, now());
      new.progress_percent := 100;
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_task_sync_completion on public.tasks;
create trigger trg_task_sync_completion
  before insert or update of status_id on public.tasks
  for each row execute function public.task_sync_completion();

-- Backfill: completed tasks get the time they last moved to a terminal status.
update public.tasks t set
  completed_at = coalesce(
    (select max(h.created_at)
     from public.task_status_history h
     join public.task_statuses hs on hs.id = h.to_status_id
     where h.task_id = t.id and hs.is_terminal),
    t.updated_at),
  progress_percent = 100
from public.task_statuses s
where s.id = t.status_id and s.is_terminal and t.completed_at is null;

-- Progress update: authorize like update_task_status ----------------------------
create or replace function public.update_task_progress(p_task uuid, p_percent integer)
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
  if p_percent is null or p_percent < 0 or p_percent > 100 then
    raise exception 'completion must be between 0 and 100';
  end if;
  select * into t from public.tasks where id = p_task;
  if not found then raise exception 'task not found'; end if;
  if not (t.created_by = v_user or t.assignee_id = v_user or public.has_permission('tasks.manage')) then
    raise exception 'not allowed to update this task';
  end if;

  update public.tasks set progress_percent = p_percent where id = p_task;
  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.update_task_progress(uuid, integer) to authenticated;
