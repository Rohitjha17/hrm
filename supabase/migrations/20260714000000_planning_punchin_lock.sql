-- ============================================================================
-- Planning: next-day punch-in lock + unlock remarks
--
-- 1. To punch IN today, yesterday (if worked) must have COMPLETE planning:
--    day-end update submitted AND slots covering the full configured working
--    window (day_start → day_end) with no gaps. Otherwise the user is locked
--    and only an admin can unlock — now with a mandatory remark.
-- 2. unlock_planning requires a non-empty remark, stored on the compliance row.
-- 3. punch_in_lock_status() lets the employee UI show the lock proactively.
-- ============================================================================

alter table public.planning_compliance add column if not exists unlock_remarks text;

-- Full-hours check: do the user's day slots cover day_start → day_end? --------
create or replace function public.planning_day_fully_planned(p_user uuid, p_date date)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  pcfg public.planning_config;
  cur time;
  r record;
begin
  select * into pcfg from public.planning_config where id;
  if not found then return true; end if;
  cur := pcfg.day_start;
  for r in
    select start_time, end_time from public.planning_slots
    where user_id = p_user and plan_date = p_date and kind = 'day'
      and start_time is not null and end_time is not null and end_time > start_time
    order by start_time
  loop
    if r.start_time > cur then return false; end if; -- gap in coverage
    if r.end_time > cur then cur := r.end_time; end if;
    if cur >= pcfg.day_end then return true; end if;
  end loop;
  return cur >= pcfg.day_end;
end;
$$;
grant execute on function public.planning_day_fully_planned(uuid, date) to authenticated;

-- Unlock now requires a remark -------------------------------------------------
drop function if exists public.unlock_planning(uuid, date);
create or replace function public.unlock_planning(p_user uuid, p_date date, p_remarks text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if not public.has_permission('attendance.unlock') then
    raise exception 'not allowed to unlock';
  end if;
  if p_remarks is null or length(trim(p_remarks)) = 0 then
    raise exception 'a remark is required to unlock';
  end if;
  insert into public.planning_compliance (user_id, work_date, unlocked, unlocked_by, unlocked_at, unlock_remarks)
  values (p_user, p_date, true, v_user, now(), trim(p_remarks))
  on conflict (user_id, work_date) do update set
    unlocked = true, unlocked_by = v_user, unlocked_at = now(),
    unlock_remarks = trim(p_remarks), updated_at = now();
  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.unlock_planning(uuid, date, text) to authenticated;

-- Shared lock predicate: is the user's previous day blocking punch-in? --------
create or replace function public.punch_in_locked_for(p_user uuid, p_today date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pcfg public.planning_config;
  comp public.planning_compliance;
  v_prev date := p_today - 1;
  v_worked boolean;
  v_ok boolean;
begin
  select * into pcfg from public.planning_config where id;
  if pcfg.policy = 'off' then
    return jsonb_build_object('locked', false);
  end if;
  select exists (
    select 1 from public.attendance_days where user_id = p_user and work_date = v_prev
  ) into v_worked;
  if not v_worked then
    return jsonb_build_object('locked', false);
  end if;
  select * into comp from public.planning_compliance where user_id = p_user and work_date = v_prev;
  v_ok := coalesce(comp.unlocked, false)
    or (coalesce(comp.day_end_submitted, false)
        and public.planning_day_fully_planned(p_user, v_prev));
  return jsonb_build_object('locked', not v_ok, 'prev_date', v_prev);
end;
$$;
grant execute on function public.punch_in_locked_for(uuid, date) to authenticated;

-- Employee-facing status so the UI can show the lock before a punch attempt ---
create or replace function public.punch_in_lock_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.attendance_config;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select * into cfg from public.attendance_config where id;
  return public.punch_in_locked_for(v_user, (now() at time zone cfg.timezone)::date);
end;
$$;
grant execute on function public.punch_in_lock_status() to authenticated;

-- Punch RPC: enforce the previous-day planning lock on punch IN ----------------
create or replace function public.attendance_punch(
  p_type text,
  p_lat numeric,
  p_lng numeric,
  p_selfie_path text default null,
  p_ip text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.attendance_config;
  pcfg public.planning_config;
  comp public.planning_compliance;
  v_user uuid := auth.uid();
  v_dist numeric;
  v_date date;
  v_last text;
  v_open boolean;
  v_day public.attendance_days;
  v_compliant boolean;
  v_lock jsonb;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_type not in ('in', 'out') then raise exception 'invalid punch type'; end if;

  select * into cfg from public.attendance_config where id;
  select * into pcfg from public.planning_config where id;

  v_dist := public.haversine_m(cfg.office_lat, cfg.office_lng, p_lat, p_lng);
  if v_dist > cfg.radius_meters then
    return jsonb_build_object('ok', false, 'reason', 'out_of_radius',
      'distance_m', round(v_dist), 'radius_m', cfg.radius_meters);
  end if;

  if array_length(cfg.ip_allowlist, 1) is not null and p_ip is not null
     and not (p_ip = any (cfg.ip_allowlist)) then
    return jsonb_build_object('ok', false, 'reason', 'ip_not_allowed');
  end if;

  v_date := (now() at time zone cfg.timezone)::date;

  -- Sequence check (before the planning gate, so the reason is accurate) ------
  select punch_type into v_last from public.attendance_punches
    where user_id = v_user and work_date = v_date order by punched_at desc limit 1;
  v_open := (v_last = 'in');
  if p_type = 'in' and v_open then
    return jsonb_build_object('ok', false, 'reason', 'already_punched_in');
  end if;
  if p_type = 'out' and (v_last is null or not v_open) then
    return jsonb_build_object('ok', false, 'reason', 'not_punched_in');
  end if;

  -- Mandatory planning policy: punch-out gate ---------------------------------
  if p_type = 'out' and pcfg.policy = 'block_punch_out' then
    select * into comp from public.planning_compliance where user_id = v_user and work_date = v_date;
    v_compliant := coalesce(comp.unlocked, false)
      or ((not pcfg.require_day_end or coalesce(comp.day_end_submitted, false))
          and (not pcfg.require_next_day or coalesce(comp.next_day_submitted, false)));
    if not v_compliant then
      return jsonb_build_object('ok', false, 'reason', 'planning_incomplete');
    end if;
  end if;

  -- Punch-in lock: yesterday (if worked) must be fully planned or unlocked ----
  if p_type = 'in' then
    v_lock := public.punch_in_locked_for(v_user, v_date);
    if coalesce((v_lock ->> 'locked')::boolean, false) then
      return jsonb_build_object('ok', false, 'reason', 'previous_day_planning_incomplete',
        'prev_date', v_lock ->> 'prev_date');
    end if;
  end if;

  insert into public.attendance_punches (
    user_id, punch_type, punched_at, work_date, latitude, longitude,
    distance_meters, within_radius, selfie_path, ip_address
  )
  values (v_user, p_type, now(), v_date, p_lat, p_lng, round(v_dist, 2), true, p_selfie_path, p_ip);

  perform public.recompute_attendance_day(v_user, v_date);
  select * into v_day from public.attendance_days where user_id = v_user and work_date = v_date;

  return jsonb_build_object(
    'ok', true, 'punch_type', p_type, 'distance_m', round(v_dist), 'work_date', v_date,
    'status', v_day.status, 'worked_minutes', v_day.worked_minutes,
    'is_late', v_day.is_late, 'overtime_minutes', v_day.overtime_minutes
  );
end;
$$;
grant execute on function public.attendance_punch(text, numeric, numeric, text, text) to authenticated;
