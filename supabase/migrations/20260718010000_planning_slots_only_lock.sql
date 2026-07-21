-- ============================================================================
-- Planning simplification: the day-end attestation is gone
--
-- 1. "Submit Day-End Update" (and the never-enforced next-day flag) are
--    removed. Compliance is now purely objective: do the user's day slots
--    cover the configured working window (day_start → day_end)?
-- 2. The punch lock therefore checks only slot coverage (or an admin unlock).
-- 3. Salary needs the same definition: planning_compliant_days() returns the
--    worked days in a range that were fully planned or unlocked, replacing
--    the calculate-salary function's direct read of the dropped flags.
-- ============================================================================

drop function if exists public.submit_planning_compliance(date, text);

-- Lock predicate: slot coverage or unlock — no attestation flag ----------------
create or replace function public.punch_in_locked_for(p_user uuid, p_today date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pcfg public.planning_config;
  comp public.planning_compliance;
  v_prev date;
  v_ok boolean;
begin
  select * into pcfg from public.planning_config where id;
  if pcfg.policy = 'off' then
    return jsonb_build_object('locked', false);
  end if;
  select max(work_date) into v_prev from public.attendance_days
    where user_id = p_user and work_date < p_today;
  if v_prev is null then
    return jsonb_build_object('locked', false);
  end if;
  select * into comp from public.planning_compliance
    where user_id = p_user and work_date = v_prev;
  v_ok := coalesce(comp.unlocked, false)
    or public.planning_day_fully_planned(p_user, v_prev);
  return jsonb_build_object('locked', not v_ok, 'prev_date', v_prev);
end;
$$;
grant execute on function public.punch_in_locked_for(uuid, date) to authenticated;

-- Salary: compliant worked days in [p_from, p_to) ------------------------------
create or replace function public.planning_compliant_days(p_user uuid, p_from date, p_to date)
returns setof date
language sql
security definer
set search_path = public
as $$
  select d.work_date
  from public.attendance_days d
  left join public.planning_compliance c
    on c.user_id = d.user_id and c.work_date = d.work_date
  where d.user_id = p_user
    and d.work_date >= p_from
    and d.work_date < p_to
    and (coalesce(c.unlocked, false)
         or public.planning_day_fully_planned(p_user, d.work_date));
$$;
revoke execute on function public.planning_compliant_days(uuid, date, date) from public, anon, authenticated;
grant execute on function public.planning_compliant_days(uuid, date, date) to service_role;

-- Drop the attestation flags and their config switches -------------------------
alter table public.planning_compliance
  drop column if exists day_end_submitted,
  drop column if exists next_day_submitted;

alter table public.planning_config
  drop column if exists require_day_end,
  drop column if exists require_next_day;

-- Appraisal: planning score now uses the same slot-coverage definition ---------
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

  -- Planning: fully-planned (or unlocked) working days / working days.
  select count(*) into v_workdays from public.attendance_days
    where user_id = a.user_id and work_date between c.period_start and c.period_end
      and status in ('full_day', 'present', 'half_day', 'quarter_day');
  select count(*) into v_compliant
    from public.planning_compliant_days(a.user_id, c.period_start, c.period_end + 1);
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
