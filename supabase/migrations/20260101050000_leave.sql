-- ============================================================================
-- Phase 5 — Leave management
-- Leave types + balances, holiday master, and an apply → approve/reject flow
-- (reporting manager or leave.approve), with realtime status visibility.
-- ============================================================================

create table if not exists public.leave_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  is_paid boolean not null default true,
  default_annual_quota numeric not null default 0,
  sort_order integer not null default 0,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  holiday_date date not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  leave_type_id uuid not null references public.leave_types(id),
  start_date date not null,
  end_date date not null,
  days numeric not null default 0,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  decision_remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index if not exists idx_leave_user on public.leave_requests(user_id);
create index if not exists idx_leave_status on public.leave_requests(status);

create table if not exists public.leave_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  leave_type_id uuid not null references public.leave_types(id) on delete cascade,
  year integer not null,
  allocated numeric not null default 0,
  used numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, leave_type_id, year)
);

create trigger trg_leave_requests_updated before update on public.leave_requests
  for each row execute function public.set_updated_at();
create trigger trg_leave_balances_updated before update on public.leave_balances
  for each row execute function public.set_updated_at();

-- Inclusive day count -------------------------------------------------------
create or replace function public.set_leave_days()
returns trigger language plpgsql as $$
begin
  new.days := (new.end_date - new.start_date) + 1;
  return new;
end;
$$;
create trigger trg_leave_days before insert or update of start_date, end_date on public.leave_requests
  for each row execute function public.set_leave_days();

-- Decision RPC: approve/reject + balance update ------------------------------
create or replace function public.decide_leave(p_request uuid, p_decision text, p_remarks text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  r public.leave_requests;
  v_manager uuid;
  v_year int;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_decision not in ('approved', 'rejected') then raise exception 'invalid decision'; end if;

  select * into r from public.leave_requests where id = p_request;
  if not found then raise exception 'request not found'; end if;
  select reporting_manager_id into v_manager from public.profiles where id = r.user_id;
  if not (public.has_permission('leave.approve') or v_manager = v_user) then
    raise exception 'not allowed to decide this request';
  end if;
  if r.status <> 'pending' then raise exception 'request already decided'; end if;

  update public.leave_requests
    set status = p_decision, decided_by = v_user, decided_at = now(), decision_remarks = p_remarks
    where id = p_request;

  if p_decision = 'approved' then
    v_year := extract(year from r.start_date);
    insert into public.leave_balances (user_id, leave_type_id, year, allocated, used)
    values (r.user_id, r.leave_type_id, v_year, 0, r.days)
    on conflict (user_id, leave_type_id, year)
      do update set used = public.leave_balances.used + r.days, updated_at = now();
  end if;

  return jsonb_build_object('ok', true, 'status', p_decision);
end;
$$;
grant execute on function public.decide_leave(uuid, text, text) to authenticated;

-- Seed leave types (editable master) ----------------------------------------
insert into public.leave_types (slug, name, is_paid, default_annual_quota, sort_order, is_system) values
  ('paid', 'Paid', true, 12, 1, true),
  ('casual', 'Casual', true, 6, 2, true),
  ('sick', 'Sick', true, 6, 3, true),
  ('unpaid', 'Unpaid', false, 0, 4, true)
on conflict (slug) do nothing;

-- Seed a few fixed holidays --------------------------------------------------
insert into public.holidays (name, holiday_date) values
  ('New Year''s Day', '2026-01-01'),
  ('Republic Day', '2026-01-26'),
  ('Independence Day', '2026-08-15'),
  ('Diwali', '2026-11-08')
on conflict (holiday_date) do nothing;

-- RLS -------------------------------------------------------------------------
alter table public.leave_types enable row level security;
alter table public.holidays enable row level security;
alter table public.leave_requests enable row level security;
alter table public.leave_balances enable row level security;

create policy leave_types_select on public.leave_types for select to authenticated using (true);
create policy leave_types_write on public.leave_types for all to authenticated
  using (public.has_permission('leave.manage')) with check (public.has_permission('leave.manage'));

create policy holidays_select on public.holidays for select to authenticated using (true);
create policy holidays_write on public.holidays for all to authenticated
  using (public.has_permission('holidays.manage')) with check (public.has_permission('holidays.manage'));

-- Requests: own / your reports / leave.view_all.
create policy leave_requests_select on public.leave_requests for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_permission('leave.view_all')
    or exists (select 1 from public.profiles p where p.id = leave_requests.user_id and p.reporting_manager_id = auth.uid())
  );
-- Apply for your own leave.
create policy leave_requests_insert on public.leave_requests for insert to authenticated
  with check (user_id = auth.uid() and public.has_permission('leave.apply'));
-- Employee may cancel own pending; approvers/managers update via decide_leave().
create policy leave_requests_update on public.leave_requests for update to authenticated
  using (user_id = auth.uid() or public.has_permission('leave.approve'))
  with check (user_id = auth.uid() or public.has_permission('leave.approve'));

create policy leave_balances_select on public.leave_balances for select to authenticated
  using (user_id = auth.uid() or public.has_permission('leave.view_all'));
create policy leave_balances_write on public.leave_balances for all to authenticated
  using (public.has_permission('leave.manage')) with check (public.has_permission('leave.manage'));

-- Realtime status visibility
alter publication supabase_realtime add table public.leave_requests;
