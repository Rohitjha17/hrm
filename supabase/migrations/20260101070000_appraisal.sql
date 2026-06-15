-- ============================================================================
-- Phase 7 — Appraisal management
-- Cycles (monthly/quarterly/half-yearly/annual) + appraisals scored from real
-- attendance/task/planning data, with increment & promotion recommendations.
-- ============================================================================

create table if not exists public.appraisal_cycles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cycle_type text not null check (cycle_type in ('monthly', 'quarterly', 'half_yearly', 'annual')),
  period_start date not null,
  period_end date not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create table if not exists public.appraisals (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.appraisal_cycles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  attendance_score numeric not null default 0,
  task_score numeric not null default 0,
  planning_score numeric not null default 0,
  performance_rating integer check (performance_rating between 1 and 5),
  manager_feedback text,
  hr_feedback text,
  overall_score numeric not null default 0,
  increment_recommendation numeric not null default 0,
  promotion_recommended boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, user_id)
);

create trigger trg_appraisals_updated before update on public.appraisals
  for each row execute function public.set_updated_at();

-- Scoring engine -------------------------------------------------------------
create or replace function public.compute_appraisal_scores(p_appraisal uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.appraisals;
  c public.appraisal_cycles;
  v_daycount int;
  v_weight numeric;
  v_workdays int;
  v_compliant int;
  v_total_tasks int;
  v_done_tasks int;
  v_att numeric;
  v_task numeric;
  v_plan numeric;
  v_overall numeric;
  v_incr numeric;
  v_promo boolean;
begin
  if not public.has_permission('appraisal.manage') then raise exception 'not allowed'; end if;
  select * into a from public.appraisals where id = p_appraisal;
  if not found then raise exception 'appraisal not found'; end if;
  select * into c from public.appraisal_cycles where id = a.cycle_id;

  -- Attendance: weighted day score (full=1, half=0.5, quarter=0.25, absent=0).
  select count(*),
         coalesce(sum(case status
           when 'full_day' then 1 when 'present' then 1
           when 'half_day' then 0.5 when 'quarter_day' then 0.25 else 0 end), 0)
    into v_daycount, v_weight
    from public.attendance_days
    where user_id = a.user_id and work_date between c.period_start and c.period_end;
  v_att := case when v_daycount > 0 then round(v_weight / v_daycount * 100, 1) else 0 end;

  -- Planning: compliant working days / working days.
  select count(*) into v_workdays from public.attendance_days
    where user_id = a.user_id and work_date between c.period_start and c.period_end
      and status in ('full_day', 'present', 'half_day', 'quarter_day');
  select count(*) into v_compliant from public.planning_compliance
    where user_id = a.user_id and work_date between c.period_start and c.period_end
      and (unlocked or (day_end_submitted and next_day_submitted));
  v_plan := case when v_workdays > 0 then round(v_compliant::numeric / v_workdays * 100, 1) else 0 end;

  -- Tasks: completed (terminal) / total, for tasks created in the period.
  select count(*) into v_total_tasks from public.tasks t
    where (t.assignee_id = a.user_id or t.created_by = a.user_id)
      and t.created_at::date between c.period_start and c.period_end;
  select count(*) into v_done_tasks from public.tasks t
    join public.task_statuses s on s.id = t.status_id
    where (t.assignee_id = a.user_id or t.created_by = a.user_id)
      and t.created_at::date between c.period_start and c.period_end
      and s.is_terminal;
  v_task := case when v_total_tasks > 0 then round(v_done_tasks::numeric / v_total_tasks * 100, 1) else 0 end;

  v_overall := round((v_att + v_task + v_plan) / 3, 1);
  v_incr := case when v_overall >= 90 then 15 when v_overall >= 75 then 10 when v_overall >= 60 then 5 else 0 end;
  v_promo := v_overall >= 85 and coalesce(a.performance_rating, 0) >= 4;

  update public.appraisals set
    attendance_score = v_att, task_score = v_task, planning_score = v_plan,
    overall_score = v_overall, increment_recommendation = v_incr,
    promotion_recommended = v_promo, updated_at = now()
  where id = p_appraisal;

  return jsonb_build_object(
    'attendance_score', v_att, 'task_score', v_task, 'planning_score', v_plan,
    'overall_score', v_overall, 'increment_recommendation', v_incr,
    'promotion_recommended', v_promo
  );
end;
$$;
grant execute on function public.compute_appraisal_scores(uuid) to authenticated;

-- RLS -------------------------------------------------------------------------
alter table public.appraisal_cycles enable row level security;
alter table public.appraisals enable row level security;

create policy appraisal_cycles_select on public.appraisal_cycles for select to authenticated using (true);
create policy appraisal_cycles_write on public.appraisal_cycles for all to authenticated
  using (public.has_permission('appraisal.manage')) with check (public.has_permission('appraisal.manage'));

create policy appraisals_select on public.appraisals for select to authenticated
  using ((user_id = auth.uid() and public.has_permission('appraisal.view_own')) or public.has_permission('appraisal.view'));
create policy appraisals_write on public.appraisals for all to authenticated
  using (public.has_permission('appraisal.manage')) with check (public.has_permission('appraisal.manage'));
