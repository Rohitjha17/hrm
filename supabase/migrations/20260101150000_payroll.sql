-- ============================================================================
-- Phase 15 — Payroll enhancements
-- Statutory components (PF/ESIC/PT/TDS), loans/advances, and a Full & Final
-- settlement. Statutory defaults are 0 so existing salary results are unchanged.
-- ============================================================================

alter table public.salary_policy
  add column if not exists pf_percent numeric not null default 0,
  add column if not exists esic_percent numeric not null default 0,
  add column if not exists professional_tax numeric not null default 0,
  add column if not exists tds_percent numeric not null default 0;

alter table public.salary_runs
  add column if not exists pf numeric not null default 0,
  add column if not exists esic numeric not null default 0,
  add column if not exists professional_tax numeric not null default 0,
  add column if not exists tds numeric not null default 0;

create table if not exists public.loans_advances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('loan', 'advance')),
  amount numeric not null,
  outstanding numeric not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.fnf_settlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  last_working_date date not null,
  final_salary numeric not null default 0,
  leave_encashment numeric not null default 0,
  dues numeric not null default 0,
  net_payable numeric not null default 0,
  breakdown jsonb,
  computed_by uuid references public.profiles(id) on delete set null,
  computed_at timestamptz not null default now()
);

alter table public.loans_advances enable row level security;
alter table public.fnf_settlements enable row level security;

create policy loans_select on public.loans_advances for select to authenticated
  using ((user_id = auth.uid() and public.has_permission('salary.view_own')) or public.has_permission('salary.view'));
create policy loans_write on public.loans_advances for all to authenticated
  using (public.has_permission('salary.manage')) with check (public.has_permission('salary.manage'));

create policy fnf_select on public.fnf_settlements for select to authenticated
  using ((user_id = auth.uid() and public.has_permission('salary.view_own')) or public.has_permission('salary.view'));
-- fnf rows are written by the Edge Function (service role).
