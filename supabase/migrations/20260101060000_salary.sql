-- ============================================================================
-- Phase 6 — Salary management
-- Policy-driven salary computed SERVER-SIDE by an Edge Function (calculate-salary).
-- Salary is hidden from employees by default (spec §6): the Employee/Intern roles
-- lose salary.view_own here; an admin grants it explicitly when needed.
-- ============================================================================

create table if not exists public.salary_policy (
  id boolean primary key default true,
  constraint salary_policy_singleton check (id),
  working_days_per_month numeric not null default 26,
  half_day_factor numeric not null default 0.5,
  quarter_day_factor numeric not null default 0.25,
  paid_leave_paid boolean not null default true,
  late_penalty_per_day numeric not null default 0,
  overtime_rate_per_hour numeric not null default 0,
  planning_penalty_per_day numeric not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.salary_policy (id) values (true) on conflict (id) do nothing;

create table if not exists public.salary_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  monthly_ctc numeric not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.salary_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  period_month date not null,
  kind text not null check (kind in ('incentive', 'penalty', 'increment')),
  amount numeric not null,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_salary_adj on public.salary_adjustments(user_id, period_month);

create table if not exists public.salary_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  period_month date not null,
  present_days numeric not null default 0,
  half_days numeric not null default 0,
  quarter_days numeric not null default 0,
  absent_days numeric not null default 0,
  paid_leave_days numeric not null default 0,
  late_count integer not null default 0,
  overtime_minutes integer not null default 0,
  planning_noncompliant_days integer not null default 0,
  base_earned numeric not null default 0,
  overtime_pay numeric not null default 0,
  incentives numeric not null default 0,
  increments numeric not null default 0,
  penalties numeric not null default 0,
  gross numeric not null default 0,
  net numeric not null default 0,
  breakdown jsonb,
  status text not null default 'finalized',
  computed_by uuid references public.profiles(id) on delete set null,
  computed_at timestamptz not null default now(),
  unique (user_id, period_month)
);

create trigger trg_salary_policy_updated before update on public.salary_policy
  for each row execute function public.set_updated_at();
create trigger trg_salary_profiles_updated before update on public.salary_profiles
  for each row execute function public.set_updated_at();

-- Hide salary from employees by default --------------------------------------
delete from public.role_permissions
where role_id in (select id from public.roles where slug in ('employee', 'intern'))
  and permission_id in (select id from public.permissions where key = 'salary.view_own');

-- RLS -------------------------------------------------------------------------
alter table public.salary_policy enable row level security;
alter table public.salary_profiles enable row level security;
alter table public.salary_adjustments enable row level security;
alter table public.salary_runs enable row level security;

create policy salary_policy_select on public.salary_policy for select to authenticated
  using (public.has_permission('salary.view') or public.has_permission('salary.manage'));
create policy salary_policy_write on public.salary_policy for all to authenticated
  using (public.has_permission('salary.manage')) with check (public.has_permission('salary.manage'));

-- Sensitive: own salary only with explicit salary.view_own, else salary.view.
create policy salary_profiles_select on public.salary_profiles for select to authenticated
  using ((user_id = auth.uid() and public.has_permission('salary.view_own')) or public.has_permission('salary.view'));
create policy salary_profiles_write on public.salary_profiles for all to authenticated
  using (public.has_permission('salary.manage')) with check (public.has_permission('salary.manage'));

create policy salary_adjustments_select on public.salary_adjustments for select to authenticated
  using ((user_id = auth.uid() and public.has_permission('salary.view_own')) or public.has_permission('salary.view'));
create policy salary_adjustments_write on public.salary_adjustments for all to authenticated
  using (public.has_permission('salary.manage')) with check (public.has_permission('salary.manage'));

create policy salary_runs_select on public.salary_runs for select to authenticated
  using ((user_id = auth.uid() and public.has_permission('salary.view_own')) or public.has_permission('salary.view'));
-- salary_runs are written only by the Edge Function (service role) — no client policy.
