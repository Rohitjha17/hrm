-- ============================================================================
-- Tasks: approval gates + per-user capacity.
--
--   1. Assigned tasks (assignee != creator) now flow through:
--        pending → accepted → in_progress → awaiting_approval → completed
--      with branches:
--        pending → rejected (assignee declines, reason required)
--        awaiting_approval → rework → in_progress (assignee re-submits)
--      Self-tasks (assignee == creator) stay on the direct Pending → Completed
--      path; the legacy update_task_status RPC still works for them.
--
--   2. Approver = assignee's reporting manager, with fallback to the task
--      creator, with override for anyone holding `tasks.manage`.
--
--   3. Each user has a task_capacity (admin-editable, falls back to a global
--      default). A planning slot save is BLOCKED when the user's open-task
--      count exceeds their cap. The approval RPCs expose warnings so the UI
--      can show them in the New-task and Accept dialogs.
--
--   4. Legacy update_task_status is NOT dropped — tightened: it refuses to
--      jump an assigned task to a terminal status (that must go through
--      submit_task + approve_task). Everything else keeps working.
-- ============================================================================

-- 1. New lifecycle statuses ----------------------------------------------------
insert into public.task_statuses (slug, name, sort_order, is_terminal, is_system) values
  ('accepted',           'Accepted',           2, false, true),
  ('awaiting_approval',  'Awaiting Approval',  5, false, true),
  ('rework',             'Rework',             6, false, true),
  ('rejected',           'Rejected',           7, true,  true)
on conflict (slug) do update
  set name = excluded.name,
      sort_order = excluded.sort_order,
      is_terminal = excluded.is_terminal,
      is_system = excluded.is_system;

update public.task_statuses set sort_order = 1 where slug = 'pending';
update public.task_statuses set sort_order = 3 where slug = 'in_progress';
update public.task_statuses set sort_order = 4 where slug = 'on_hold';
update public.task_statuses set sort_order = 8 where slug = 'completed';

-- 2. Extra timestamp + approver columns ---------------------------------------
alter table public.tasks
  add column if not exists accepted_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists submitted_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists rejection_reason text,
  add column if not exists rework_reason text;

-- 3. Per-user capacity + global default ---------------------------------------
alter table public.profiles
  add column if not exists task_capacity integer check (task_capacity is null or task_capacity > 0);

create table if not exists public.task_policy (
  id boolean primary key default true,
  constraint task_policy_singleton check (id),
  default_task_capacity integer not null default 25 check (default_task_capacity > 0),
  updated_at timestamptz not null default now()
);
insert into public.task_policy (id) values (true) on conflict (id) do nothing;
create trigger trg_task_policy_updated before update on public.task_policy
  for each row execute function public.set_updated_at();

alter table public.task_policy enable row level security;
create policy task_policy_select on public.task_policy for select to authenticated using (true);
create policy task_policy_update on public.task_policy for update to authenticated
  using (public.has_module_action('tasks', 'edit') or public.has_permission('tasks.manage'))
  with check (public.has_module_action('tasks', 'edit') or public.has_permission('tasks.manage'));

-- 4. Helpers ------------------------------------------------------------------
-- Effective capacity for a user (per-user override, else global default).
create or replace function public.effective_task_capacity(p_user uuid)
returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select task_capacity from public.profiles where id = p_user),
    (select default_task_capacity from public.task_policy where id)
  );
$$;
grant execute on function public.effective_task_capacity(uuid) to authenticated;

-- Count a user's active tasks (= tasks against their capacity).
create or replace function public.open_task_count(p_user uuid)
returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int
  from public.tasks t
  join public.task_statuses s on s.id = t.status_id
  where t.assignee_id = p_user and not s.is_terminal;
$$;
grant execute on function public.open_task_count(uuid) to authenticated;

-- Can p_user approve/rework p_task? Reporting manager, creator, or tasks.manage.
create or replace function public.is_task_approver_for(p_task uuid, p_user uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.tasks t
    left join public.profiles a on a.id = t.assignee_id
    where t.id = p_task
      and (
        a.reporting_manager_id = p_user
        or t.created_by = p_user
        or public.has_permission('tasks.manage')
      )
  );
$$;
grant execute on function public.is_task_approver_for(uuid, uuid) to authenticated;

-- Resolve status slug → id (used by the RPCs below).
create or replace function public._task_status_id(p_slug text)
returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.task_statuses where slug = p_slug;
$$;

-- 5. Lifecycle RPCs -----------------------------------------------------------

-- Assignee accepts an assigned task. Returns a warning if they're already over cap.
create or replace function public.accept_task(p_task uuid, p_remarks text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  t public.tasks;
  v_from text;
  v_to uuid := public._task_status_id('accepted');
  v_count int;
  v_cap int;
  v_warning text;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select * into t from public.tasks where id = p_task;
  if not found then raise exception 'task not found'; end if;
  if t.assignee_id <> v_user then raise exception 'only the assignee can accept this task'; end if;

  select slug into v_from from public.task_statuses where id = t.status_id;
  if v_from not in ('pending') then
    raise exception 'task cannot be accepted from status %', v_from;
  end if;

  v_count := public.open_task_count(v_user);
  v_cap := public.effective_task_capacity(v_user);
  if v_count > v_cap then
    v_warning := format('You already have %s open tasks (capacity %s). Clear some before planning.', v_count, v_cap);
  end if;

  update public.tasks set
    status_id = v_to,
    accepted_at = now()
  where id = p_task;

  insert into public.task_status_history (task_id, from_status_id, to_status_id, changed_by, remarks)
  values (p_task, t.status_id, v_to, v_user, coalesce(p_remarks, 'Task accepted'));

  return jsonb_build_object('ok', true, 'warning', v_warning,
                            'open_count', v_count, 'capacity', v_cap);
end;
$$;
grant execute on function public.accept_task(uuid, text) to authenticated;

-- Assignee rejects an assigned task. Reason required.
create or replace function public.reject_task(p_task uuid, p_reason text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  t public.tasks;
  v_from text;
  v_to uuid := public._task_status_id('rejected');
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'a reason is required to reject';
  end if;
  select * into t from public.tasks where id = p_task;
  if not found then raise exception 'task not found'; end if;
  if t.assignee_id <> v_user then raise exception 'only the assignee can reject this task'; end if;

  select slug into v_from from public.task_statuses where id = t.status_id;
  if v_from <> 'pending' then
    raise exception 'task cannot be rejected from status %', v_from;
  end if;

  update public.tasks set
    status_id = v_to,
    rejected_at = now(),
    rejection_reason = trim(p_reason)
  where id = p_task;

  insert into public.task_status_history (task_id, from_status_id, to_status_id, changed_by, remarks)
  values (p_task, t.status_id, v_to, v_user, trim(p_reason));

  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.reject_task(uuid, text) to authenticated;

-- Assignee starts work (accepted → in_progress). Optional helper; UI can skip
-- straight to submit_task if the assignee hasn't bothered with "Start".
create or replace function public.start_task(p_task uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  t public.tasks;
  v_from text;
  v_to uuid := public._task_status_id('in_progress');
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select * into t from public.tasks where id = p_task;
  if not found then raise exception 'task not found'; end if;
  if t.assignee_id <> v_user then raise exception 'only the assignee can start this task'; end if;

  select slug into v_from from public.task_statuses where id = t.status_id;
  if v_from not in ('accepted', 'rework', 'on_hold') then
    raise exception 'task cannot be started from status %', v_from;
  end if;

  update public.tasks set status_id = v_to where id = p_task;
  insert into public.task_status_history (task_id, from_status_id, to_status_id, changed_by, remarks)
  values (p_task, t.status_id, v_to, v_user, 'Started');
  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.start_task(uuid) to authenticated;

-- Assignee submits for approval. Self-tasks skip approval and go straight to
-- completed (preserves the single-user workflow).
create or replace function public.submit_task(p_task uuid, p_remarks text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  t public.tasks;
  v_from text;
  v_target text;
  v_to uuid;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select * into t from public.tasks where id = p_task;
  if not found then raise exception 'task not found'; end if;
  if t.assignee_id <> v_user then raise exception 'only the assignee can submit this task'; end if;

  select slug into v_from from public.task_statuses where id = t.status_id;
  if v_from not in ('accepted', 'in_progress', 'rework', 'on_hold') then
    raise exception 'task cannot be submitted from status %', v_from;
  end if;

  -- Self-tasks: no approver needed → close directly.
  if t.created_by = t.assignee_id then
    v_target := 'completed';
  else
    v_target := 'awaiting_approval';
  end if;
  v_to := public._task_status_id(v_target);

  update public.tasks set
    status_id = v_to,
    submitted_at = now(),
    approved_at = case when v_target = 'completed' then now() else approved_at end,
    approved_by = case when v_target = 'completed' then v_user else approved_by end
  where id = p_task;

  insert into public.task_status_history (task_id, from_status_id, to_status_id, changed_by, remarks)
  values (p_task, t.status_id, v_to, v_user,
          coalesce(nullif(trim(coalesce(p_remarks, '')), ''),
                   case when v_target = 'completed' then 'Self-task completed' else 'Submitted for approval' end));

  return jsonb_build_object('ok', true, 'status', v_target);
end;
$$;
grant execute on function public.submit_task(uuid, text) to authenticated;

-- Approver approves → completed.
create or replace function public.approve_task(p_task uuid, p_remarks text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  t public.tasks;
  v_from text;
  v_to uuid := public._task_status_id('completed');
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select * into t from public.tasks where id = p_task;
  if not found then raise exception 'task not found'; end if;
  if not public.is_task_approver_for(p_task, v_user) then
    raise exception 'only the reporting manager, task creator or an admin can approve';
  end if;

  select slug into v_from from public.task_statuses where id = t.status_id;
  if v_from <> 'awaiting_approval' then
    raise exception 'task is not awaiting approval (current: %)', v_from;
  end if;

  update public.tasks set
    status_id = v_to,
    approved_at = now(),
    approved_by = v_user
  where id = p_task;

  insert into public.task_status_history (task_id, from_status_id, to_status_id, changed_by, remarks)
  values (p_task, t.status_id, v_to, v_user, coalesce(nullif(trim(coalesce(p_remarks, '')), ''), 'Approved'));

  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.approve_task(uuid, text) to authenticated;

-- Approver sends back → rework. Reason required.
create or replace function public.rework_task(p_task uuid, p_reason text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  t public.tasks;
  v_from text;
  v_to uuid := public._task_status_id('rework');
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'a reason is required to send a task back for rework';
  end if;
  select * into t from public.tasks where id = p_task;
  if not found then raise exception 'task not found'; end if;
  if not public.is_task_approver_for(p_task, v_user) then
    raise exception 'only the reporting manager, task creator or an admin can rework';
  end if;

  select slug into v_from from public.task_statuses where id = t.status_id;
  if v_from <> 'awaiting_approval' then
    raise exception 'task is not awaiting approval (current: %)', v_from;
  end if;

  update public.tasks set
    status_id = v_to,
    rework_reason = trim(p_reason),
    submitted_at = null
  where id = p_task;

  insert into public.task_status_history (task_id, from_status_id, to_status_id, changed_by, remarks)
  values (p_task, t.status_id, v_to, v_user, trim(p_reason));

  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.rework_task(uuid, text) to authenticated;

-- 6. Legacy update_task_status: refuse the bypass -----------------------------
-- If a task has a distinct assignee (not a self-task), block jumping it to a
-- terminal status directly. Everyone must go through submit_task+approve_task.
create or replace function public.update_task_status(p_task uuid, p_status uuid, p_remarks text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  t public.tasks;
  v_target_slug text;
  v_target_terminal boolean;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select * into t from public.tasks where id = p_task;
  if not found then raise exception 'task not found'; end if;
  if not (t.created_by = v_user or t.assignee_id = v_user or public.has_permission('tasks.manage')) then
    raise exception 'not allowed to update this task';
  end if;

  select slug, is_terminal into v_target_slug, v_target_terminal
    from public.task_statuses where id = p_status;

  -- Self-tasks keep the old shortcut. Assigned tasks must use the lifecycle RPCs.
  if t.created_by is distinct from t.assignee_id
     and v_target_terminal
     and v_target_slug = 'completed' then
    raise exception 'use submit_task / approve_task for an assigned task';
  end if;

  update public.tasks set status_id = p_status where id = p_task;
  insert into public.task_status_history (task_id, from_status_id, to_status_id, changed_by, remarks)
  values (p_task, t.status_id, p_status, v_user, p_remarks);

  return jsonb_build_object('ok', true);
end;
$$;

-- 7. Planning capacity gate ---------------------------------------------------
-- A user over their capacity cannot add or edit planning slots until they
-- clear enough tasks (submit for approval or close). Admins / planning
-- managers are not blocked when editing someone else's plan.
create or replace function public.planning_slot_capacity_check()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
  v_cap int;
begin
  if new.user_id <> auth.uid() then return new; end if;    -- admin editing another user
  if public.has_permission('planning.manage_all') then return new; end if;
  v_count := public.open_task_count(new.user_id);
  v_cap := public.effective_task_capacity(new.user_id);
  if v_count > v_cap then
    raise exception
      'planning_capacity_exceeded: % open tasks, capacity %', v_count, v_cap
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_planning_slot_capacity on public.planning_slots;
create trigger trg_planning_slot_capacity
  before insert or update of task_id, task_name, start_time, end_time, plan_date
  on public.planning_slots
  for each row execute function public.planning_slot_capacity_check();

-- 8. Backfill ------------------------------------------------------------------
-- Existing tasks assigned to another user that are still pending → leave as-is
-- (they can be accepted / rejected normally). Nothing else to migrate.

-- Grant the admin-wide tasks.manage default to super_admin only; the other
-- role grants were set in the initial RBAC migration. No change needed.
