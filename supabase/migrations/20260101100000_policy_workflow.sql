-- ============================================================================
-- Phase 10 — Policy management + configurable workflow engine
-- Versioned policies with acknowledgement tracking + change history, and a
-- no-code multi-level approval engine (definitions → steps → instances → actions).
-- ============================================================================

-- New permissions ------------------------------------------------------------
insert into public.permissions (key, description, category) values
  ('policy.manage', 'Create & publish policies', 'policy'),
  ('workflow.manage', 'Build & manage approval workflows', 'workflow')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key in ('policy.manage', 'workflow.manage')
where r.slug = 'hr'
on conflict do nothing;

-- ── Policies ───────────────────────────────────────────────────────────────
create table if not exists public.policies (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('attendance', 'leave', 'salary', 'planning', 'wfh', 'appraisal', 'general')),
  title text not null,
  current_version integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.policy_versions (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.policies(id) on delete cascade,
  version integer not null,
  content text not null,
  change_note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (policy_id, version)
);

create table if not exists public.policy_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  policy_version_id uuid not null references public.policy_versions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  unique (policy_version_id, user_id)
);

create trigger trg_policies_updated before update on public.policies
  for each row execute function public.set_updated_at();

-- Publish a new policy version (version control + change history) -------------
create or replace function public.publish_policy_version(p_policy uuid, p_content text, p_change_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next int;
begin
  if not public.has_permission('policy.manage') then raise exception 'not allowed'; end if;
  select current_version + 1 into v_next from public.policies where id = p_policy;
  if v_next is null then raise exception 'policy not found'; end if;
  insert into public.policy_versions (policy_id, version, content, change_note, created_by)
  values (p_policy, v_next, p_content, p_change_note, auth.uid());
  update public.policies set current_version = v_next, updated_at = now() where id = p_policy;
  return jsonb_build_object('ok', true, 'version', v_next);
end;
$$;
grant execute on function public.publish_policy_version(uuid, text, text) to authenticated;

-- Acknowledge a policy version ------------------------------------------------
create or replace function public.acknowledge_policy(p_version uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.policy_acknowledgements (policy_version_id, user_id)
  values (p_version, auth.uid())
  on conflict (policy_version_id, user_id) do nothing;
  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.acknowledge_policy(uuid) to authenticated;

-- ── Workflow engine ──────────────────────────────────────────────────────────
create table if not exists public.workflow_definitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  entity_type text not null default 'generic',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.workflow_steps (
  id uuid primary key default gen_random_uuid(),
  definition_id uuid not null references public.workflow_definitions(id) on delete cascade,
  step_order integer not null,
  name text not null,
  approver_permission text not null,
  unique (definition_id, step_order)
);

create table if not exists public.workflow_instances (
  id uuid primary key default gen_random_uuid(),
  definition_id uuid not null references public.workflow_definitions(id) on delete cascade,
  entity_type text not null default 'generic',
  entity_id uuid,
  title text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  current_step integer not null default 1,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workflow_actions (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.workflow_instances(id) on delete cascade,
  step_order integer not null,
  actor_id uuid references public.profiles(id) on delete set null,
  decision text not null check (decision in ('approved', 'rejected')),
  remarks text,
  created_at timestamptz not null default now()
);

create trigger trg_workflow_instances_updated before update on public.workflow_instances
  for each row execute function public.set_updated_at();

-- Start an instance at step 1 -------------------------------------------------
create or replace function public.start_workflow(p_definition uuid, p_title text, p_entity_type text default 'generic', p_entity_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.workflow_instances (definition_id, entity_type, entity_id, title, created_by)
  values (p_definition, p_entity_type, p_entity_id, p_title, auth.uid())
  returning id into v_id;
  return jsonb_build_object('ok', true, 'instance_id', v_id);
end;
$$;
grant execute on function public.start_workflow(uuid, text, text, uuid) to authenticated;

-- Act on the current step; advance or finalize -------------------------------
create or replace function public.act_on_workflow(p_instance uuid, p_decision text, p_remarks text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inst public.workflow_instances;
  step public.workflow_steps;
  v_has_next boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_decision not in ('approved', 'rejected') then raise exception 'invalid decision'; end if;
  select * into inst from public.workflow_instances where id = p_instance;
  if not found then raise exception 'instance not found'; end if;
  if inst.status <> 'pending' then raise exception 'instance already %', inst.status; end if;

  select * into step from public.workflow_steps
    where definition_id = inst.definition_id and step_order = inst.current_step;
  if not found then raise exception 'no step configured'; end if;
  if not public.has_permission(step.approver_permission) then
    raise exception 'not authorized for this step';
  end if;

  insert into public.workflow_actions (instance_id, step_order, actor_id, decision, remarks)
  values (p_instance, inst.current_step, auth.uid(), p_decision, p_remarks);

  if p_decision = 'rejected' then
    update public.workflow_instances set status = 'rejected', updated_at = now() where id = p_instance;
    return jsonb_build_object('ok', true, 'status', 'rejected');
  end if;

  select exists (
    select 1 from public.workflow_steps
    where definition_id = inst.definition_id and step_order = inst.current_step + 1
  ) into v_has_next;

  if v_has_next then
    update public.workflow_instances set current_step = current_step + 1, updated_at = now() where id = p_instance;
    return jsonb_build_object('ok', true, 'status', 'pending', 'current_step', inst.current_step + 1);
  else
    update public.workflow_instances set status = 'approved', updated_at = now() where id = p_instance;
    return jsonb_build_object('ok', true, 'status', 'approved');
  end if;
end;
$$;
grant execute on function public.act_on_workflow(uuid, text, text) to authenticated;

-- RLS -------------------------------------------------------------------------
alter table public.policies enable row level security;
alter table public.policy_versions enable row level security;
alter table public.policy_acknowledgements enable row level security;
alter table public.workflow_definitions enable row level security;
alter table public.workflow_steps enable row level security;
alter table public.workflow_instances enable row level security;
alter table public.workflow_actions enable row level security;

create policy policies_select on public.policies for select to authenticated using (true);
create policy policies_write on public.policies for all to authenticated
  using (public.has_permission('policy.manage')) with check (public.has_permission('policy.manage'));
create policy policy_versions_select on public.policy_versions for select to authenticated using (true);
create policy policy_versions_write on public.policy_versions for all to authenticated
  using (public.has_permission('policy.manage')) with check (public.has_permission('policy.manage'));
create policy policy_ack_select on public.policy_acknowledgements for select to authenticated
  using (user_id = auth.uid() or public.has_permission('policy.manage'));

create policy wf_def_select on public.workflow_definitions for select to authenticated using (true);
create policy wf_def_write on public.workflow_definitions for all to authenticated
  using (public.has_permission('workflow.manage')) with check (public.has_permission('workflow.manage'));
create policy wf_step_select on public.workflow_steps for select to authenticated using (true);
create policy wf_step_write on public.workflow_steps for all to authenticated
  using (public.has_permission('workflow.manage')) with check (public.has_permission('workflow.manage'));

-- Instances visible to the creator, workflow managers, or whoever can act on
-- the current step. Actions/transitions go only through the RPCs.
create policy wf_inst_select on public.workflow_instances for select to authenticated
  using (
    created_by = auth.uid()
    or public.has_permission('workflow.manage')
    or exists (
      select 1 from public.workflow_steps s
      where s.definition_id = workflow_instances.definition_id
        and s.step_order = workflow_instances.current_step
        and public.has_permission(s.approver_permission)
    )
  );
create policy wf_action_select on public.workflow_actions for select to authenticated
  using (
    exists (
      select 1 from public.workflow_instances i
      where i.id = workflow_actions.instance_id
        and (i.created_by = auth.uid() or public.has_permission('workflow.manage'))
    )
  );
