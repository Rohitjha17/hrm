-- ============================================================================
-- Phase 16 — Employee lifecycle + exit management
-- Lifecycle event timeline; resignation → clearances → exit documents.
-- ============================================================================

insert into public.permissions (key, description, category) values
  ('lifecycle.view_own', 'View own lifecycle timeline', 'lifecycle'),
  ('lifecycle.manage', 'Manage lifecycle events & exits', 'lifecycle')
on conflict (key) do nothing;
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key = 'lifecycle.manage'
where r.slug = 'hr'
on conflict do nothing;
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key = 'lifecycle.view_own'
where r.slug in ('employee', 'intern')
on conflict do nothing;

create table if not exists public.lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('joining', 'confirmation', 'promotion', 'transfer', 'department_change', 'salary_revision', 'exit')),
  event_date date not null,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_lifecycle_emp on public.lifecycle_events(employee_id, event_date);

create table if not exists public.resignations (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null unique references public.profiles(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  last_working_date date not null,
  reason text,
  exit_interview_notes text,
  status text not null default 'pending' check (status in ('pending', 'in_clearance', 'completed')),
  updated_at timestamptz not null default now()
);

create table if not exists public.exit_clearances (
  id uuid primary key default gen_random_uuid(),
  resignation_id uuid not null references public.resignations(id) on delete cascade,
  clearance_type text not null,
  status text not null default 'pending' check (status in ('pending', 'cleared')),
  cleared_by uuid references public.profiles(id) on delete set null,
  cleared_at timestamptz,
  unique (resignation_id, clearance_type)
);

create trigger trg_resignations_updated before update on public.resignations
  for each row execute function public.set_updated_at();

-- Audit trail on lifecycle events
create trigger trg_audit_lifecycle after insert or update or delete on public.lifecycle_events
  for each row execute function public.audit_trigger();

-- Start an exit: resignation + lifecycle event + default clearances ----------
create or replace function public.start_exit(p_employee uuid, p_last_working_date date, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not public.has_permission('lifecycle.manage') then raise exception 'not allowed'; end if;
  insert into public.resignations (employee_id, last_working_date, reason, status)
  values (p_employee, p_last_working_date, p_reason, 'in_clearance')
  on conflict (employee_id) do update set last_working_date = excluded.last_working_date,
    reason = excluded.reason, status = 'in_clearance', updated_at = now()
  returning id into v_id;

  insert into public.lifecycle_events (employee_id, event_type, event_date, note, created_by)
  values (p_employee, 'exit', p_last_working_date, 'Exit initiated', auth.uid());

  insert into public.exit_clearances (resignation_id, clearance_type)
  select v_id, t from (values ('asset'), ('hr'), ('accounts'), ('it')) as c(t)
  on conflict (resignation_id, clearance_type) do nothing;

  return jsonb_build_object('ok', true, 'resignation_id', v_id);
end;
$$;
grant execute on function public.start_exit(uuid, date, text) to authenticated;

create or replace function public.clear_exit_item(p_clearance uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.has_permission('lifecycle.manage') then raise exception 'not allowed'; end if;
  update public.exit_clearances set status = 'cleared', cleared_by = auth.uid(), cleared_at = now()
  where id = p_clearance;
  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.clear_exit_item(uuid) to authenticated;

-- RLS -------------------------------------------------------------------------
alter table public.lifecycle_events enable row level security;
alter table public.resignations enable row level security;
alter table public.exit_clearances enable row level security;

create policy lifecycle_select on public.lifecycle_events for select to authenticated
  using ((employee_id = auth.uid() and public.has_permission('lifecycle.view_own')) or public.has_permission('lifecycle.manage'));
create policy lifecycle_write on public.lifecycle_events for all to authenticated
  using (public.has_permission('lifecycle.manage')) with check (public.has_permission('lifecycle.manage'));

create policy resignations_select on public.resignations for select to authenticated
  using (employee_id = auth.uid() or public.has_permission('lifecycle.manage'));
create policy resignations_write on public.resignations for all to authenticated
  using (public.has_permission('lifecycle.manage')) with check (public.has_permission('lifecycle.manage'));

create policy clearances_select on public.exit_clearances for select to authenticated
  using (public.has_permission('lifecycle.manage'));
-- clearances written via the RPCs (SECURITY DEFINER).
