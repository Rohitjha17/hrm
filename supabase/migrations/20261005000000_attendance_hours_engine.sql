-- ============================================================================
-- Attendance: client requirement sheet items 1–5 and 7–10
--
-- 1. Hours-based status everywhere: a past day left punched-in no longer stays
--    'present' (and paid as a full day) forever. It is closed at the office
--    end time and flagged missed_punch_out for admin review.
-- 2. Thresholds: Full 8.5 h, Half 4.25 h, Quarter 2.13 h — INCLUDING a 1 h
--    break, so a lunch punch-out of up to break_minutes still counts.
-- 3. One classifier (attendance_status_for) used by punches and manual entry.
-- 5. 5-minute consideration: grace_minutes = 5, applied to the late flag AND
--    to the hour thresholds (10:05–18:30 is still a full day).
-- 7/10. Admin can enter historical attendance or correct a day, with a
--    mandatory remark and an audit trail (attendance_corrections).
-- 8. Punch accepts the GPS accuracy so an imprecise fix taken at the office
--    isn't rejected as "outside radius" (allowance capped by config).
-- 9. late_minutes: how late, not just yes/no.
--
-- Already-closed historical days are NOT recomputed — only new punches, stale
-- open days and admin corrections use the new rules.
-- ============================================================================

-- Config ----------------------------------------------------------------------
alter table public.attendance_config
  add column if not exists break_minutes integer not null default 60,
  add column if not exists location_accuracy_cap_m integer not null default 100;

alter table public.attendance_config
  alter column full_day_hours set default 8.5,
  alter column half_day_hours set default 4.25,
  alter column quarter_day_hours set default 2.13,
  alter column grace_minutes set default 5;

update public.attendance_config set
  full_day_hours = 8.5,
  half_day_hours = 4.25,
  quarter_day_hours = 2.13,
  grace_minutes = 5
where id;

-- Day aggregate: lateness, credited time, manual-correction metadata ------------
alter table public.attendance_days
  add column if not exists late_minutes integer not null default 0,
  add column if not exists credited_minutes integer not null default 0,
  add column if not exists missed_punch_out boolean not null default false,
  add column if not exists is_manual boolean not null default false,
  add column if not exists remarks text,
  -- No FK on corrected_by: a second profiles FK would make every existing
  -- attendance_days → profiles embed ambiguous. attendance_corrections holds
  -- the referential audit record.
  add column if not exists corrected_by uuid,
  add column if not exists corrected_at timestamptz;

-- Existing rows: credited time = worked time (no break data to reconstruct).
update public.attendance_days set credited_minutes = worked_minutes
  where credited_minutes = 0 and worked_minutes > 0;

-- Existing late rows: backfill how late they were.
update public.attendance_days d set late_minutes = greatest(0, floor(extract(epoch from (
    (d.first_in_at at time zone c.timezone)::time - c.work_start)) / 60)::int)
  from public.attendance_config c
  where c.id and d.is_late and d.first_in_at is not null and d.late_minutes = 0;

alter table public.attendance_punches
  add column if not exists accuracy_meters numeric;

-- Correction audit trail --------------------------------------------------------
create table if not exists public.attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null,
  action text not null check (action in ('set', 'reset')),
  old_value jsonb,
  new_value jsonb,
  remarks text not null,
  corrected_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_att_corrections_user_date
  on public.attendance_corrections(user_id, work_date);

alter table public.attendance_corrections enable row level security;
create policy attendance_corrections_select on public.attendance_corrections
  for select to authenticated
  using (user_id = auth.uid() or public.has_permission('attendance.view_all'));
-- No write policies: rows are written only by the security-definer RPCs below.

-- Classifier: credited minutes → status (grace applies to each threshold) ------
create or replace function public.attendance_status_for(p_minutes integer)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_minutes + c.grace_minutes >= c.full_day_hours * 60 then 'full_day'
    when p_minutes + c.grace_minutes >= c.half_day_hours * 60 then 'half_day'
    when p_minutes + c.grace_minutes >= c.quarter_day_hours * 60 then 'quarter_day'
    else 'absent'
  end
  from public.attendance_config c where c.id;
$$;
grant execute on function public.attendance_status_for(integer) to authenticated, service_role;

-- Working-hours engine ----------------------------------------------------------
create or replace function public.recompute_attendance_day(p_user uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.attendance_config;
  r record;
  v_today date;
  v_open timestamptz := null;
  v_first_in timestamptz := null;
  v_last_out timestamptz := null;
  v_prev_out timestamptz := null;
  v_close timestamptz;
  v_worked int := 0;
  v_gap int := 0;
  v_credited int := 0;
  v_count int := 0;
  v_status text;
  v_late boolean := false;
  v_late_min int := 0;
  v_missed boolean := false;
  v_ot int := 0;
  v_local_in time;
begin
  -- An admin-corrected day is authoritative until it is reset.
  if exists (select 1 from public.attendance_days
             where user_id = p_user and work_date = p_date and is_manual) then
    return;
  end if;

  select * into cfg from public.attendance_config where id;
  v_today := (now() at time zone cfg.timezone)::date;

  for r in
    select punch_type, punched_at
    from public.attendance_punches
    where user_id = p_user and work_date = p_date
    order by punched_at asc
  loop
    v_count := v_count + 1;
    if r.punch_type = 'in' then
      if v_first_in is null then v_first_in := r.punched_at; end if;
      if v_open is null then
        v_open := r.punched_at;
        -- Time between a punch-out and the next punch-in is a break.
        if v_prev_out is not null then
          v_gap := v_gap + floor(extract(epoch from (r.punched_at - v_prev_out)) / 60.0);
        end if;
      end if;
    else
      if v_open is not null then
        v_worked := v_worked + ceil(extract(epoch from (r.punched_at - v_open)) / 60.0);
        v_open := null;
      end if;
      v_last_out := r.punched_at;
      v_prev_out := r.punched_at;
    end if;
  end loop;

  if v_open is not null then
    if p_date >= v_today then
      -- Still punched in today: count the open segment up to now.
      v_worked := v_worked + ceil(extract(epoch from (now() - v_open)) / 60.0);
    else
      -- Past day never punched out: close it at the office end time.
      v_missed := true;
      v_close := (p_date + cfg.work_end) at time zone cfg.timezone;
      if v_close > v_open then
        v_worked := v_worked + ceil(extract(epoch from (v_close - v_open)) / 60.0);
      end if;
    end if;
  end if;

  -- Thresholds include the break: credit breaks up to the configured allowance.
  v_credited := v_worked + least(v_gap, cfg.break_minutes);

  if v_first_in is not null then
    v_local_in := (v_first_in at time zone cfg.timezone)::time;
    v_late := v_local_in > (cfg.work_start + make_interval(mins => cfg.grace_minutes));
    if v_late then
      v_late_min := floor(extract(epoch from (v_local_in - cfg.work_start)) / 60.0);
    end if;
  end if;

  v_status := public.attendance_status_for(v_credited);

  -- In progress (open punch today) and not yet a full day → 'present'.
  if v_open is not null and not v_missed and v_status <> 'full_day' then
    v_status := 'present';
  end if;

  v_ot := greatest(0, v_worked - (cfg.overtime_after_hours * 60)::int);

  insert into public.attendance_days (
    user_id, work_date, first_in_at, last_out_at, worked_minutes, credited_minutes, status,
    is_late, late_minutes, missed_punch_out, overtime_minutes, punch_count
  )
  values (p_user, p_date, v_first_in, v_last_out, v_worked, v_credited, v_status,
          v_late, v_late_min, v_missed, v_ot, v_count)
  on conflict (user_id, work_date) do update set
    first_in_at = excluded.first_in_at,
    last_out_at = excluded.last_out_at,
    worked_minutes = excluded.worked_minutes,
    credited_minutes = excluded.credited_minutes,
    status = excluded.status,
    is_late = excluded.is_late,
    late_minutes = excluded.late_minutes,
    missed_punch_out = excluded.missed_punch_out,
    overtime_minutes = excluded.overtime_minutes,
    punch_count = excluded.punch_count,
    updated_at = now();
end;
$$;

revoke all on function public.recompute_attendance_day(uuid, date) from public;
grant execute on function public.recompute_attendance_day(uuid, date) to service_role;

-- Close past days still marked 'present' (employee never punched out) ----------
-- Idempotent and deterministic, so any signed-in user may trigger it; it is
-- called on punch, before salary calculation and when admins open the
-- monitor/report, keeping all three views consistent.
create or replace function public.close_stale_attendance(p_user uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date;
  r record;
  v_n int := 0;
begin
  select (now() at time zone timezone)::date into v_today from public.attendance_config where id;
  for r in
    select d.user_id, d.work_date
    from public.attendance_days d
    where d.status = 'present'
      and d.work_date < v_today
      and not d.is_manual
      and (p_user is null or d.user_id = p_user)
      and exists (select 1 from public.attendance_punches p
                  where p.user_id = d.user_id and p.work_date = d.work_date)
  loop
    perform public.recompute_attendance_day(r.user_id, r.work_date);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
grant execute on function public.close_stale_attendance(uuid) to authenticated, service_role;

-- Punch RPC: accuracy-aware radius check ----------------------------------------
-- p_accuracy is appended with a default, so existing callers keep working.
drop function if exists public.attendance_punch(text, numeric, numeric, text, text);
create or replace function public.attendance_punch(
  p_type text,
  p_lat numeric,
  p_lng numeric,
  p_selfie_path text default null,
  p_ip text default null,
  p_accuracy numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.attendance_config;
  v_user uuid := auth.uid();
  v_dist numeric;
  v_allow numeric;
  v_date date;
  v_last text;
  v_open boolean;
  v_day public.attendance_days;
  v_lock jsonb;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_type not in ('in', 'out') then raise exception 'invalid punch type'; end if;

  select * into cfg from public.attendance_config where id;

  -- A device at the office can report a position off by its own accuracy
  -- radius; allow for that, capped so a wildly imprecise fix can't pass.
  v_dist := public.haversine_m(cfg.office_lat, cfg.office_lng, p_lat, p_lng);
  v_allow := least(greatest(coalesce(p_accuracy, 0), 0), cfg.location_accuracy_cap_m);
  if v_dist > cfg.radius_meters + v_allow then
    return jsonb_build_object('ok', false, 'reason', 'out_of_radius',
      'distance_m', round(v_dist), 'radius_m', cfg.radius_meters);
  end if;

  if array_length(cfg.ip_allowlist, 1) is not null and p_ip is not null
     and not (p_ip = any (cfg.ip_allowlist)) then
    return jsonb_build_object('ok', false, 'reason', 'ip_not_allowed');
  end if;

  v_date := (now() at time zone cfg.timezone)::date;

  select punch_type into v_last from public.attendance_punches
    where user_id = v_user and work_date = v_date order by punched_at desc limit 1;
  v_open := (v_last = 'in');
  if p_type = 'in' and v_open then
    return jsonb_build_object('ok', false, 'reason', 'already_punched_in');
  end if;
  if p_type = 'out' and (v_last is null or not v_open) then
    return jsonb_build_object('ok', false, 'reason', 'not_punched_in');
  end if;

  -- Punch-in lock: the last worked day must be fully planned or unlocked.
  if p_type = 'in' then
    v_lock := public.punch_in_locked_for(v_user, v_date);
    if coalesce((v_lock ->> 'locked')::boolean, false) then
      return jsonb_build_object('ok', false, 'reason', 'previous_day_planning_incomplete',
        'prev_date', v_lock ->> 'prev_date');
    end if;
  end if;

  insert into public.attendance_punches (
    user_id, punch_type, punched_at, work_date, latitude, longitude,
    distance_meters, within_radius, selfie_path, ip_address, accuracy_meters
  )
  values (v_user, p_type, now(), v_date, p_lat, p_lng, round(v_dist, 2),
          v_dist <= cfg.radius_meters, p_selfie_path, p_ip, round(p_accuracy, 1));

  -- Finalize any earlier day this user forgot to punch out of.
  perform public.close_stale_attendance(v_user);

  perform public.recompute_attendance_day(v_user, v_date);
  select * into v_day from public.attendance_days where user_id = v_user and work_date = v_date;

  return jsonb_build_object(
    'ok', true, 'punch_type', p_type, 'distance_m', round(v_dist), 'work_date', v_date,
    'status', v_day.status, 'worked_minutes', v_day.worked_minutes,
    'is_late', v_day.is_late, 'late_minutes', v_day.late_minutes,
    'overtime_minutes', v_day.overtime_minutes
  );
end;
$$;
grant execute on function public.attendance_punch(text, numeric, numeric, text, text, numeric) to authenticated;

-- Admin: enter historical attendance / correct a day ----------------------------
-- p_status null = derive from the in/out times with the normal thresholds;
-- otherwise the admin's status wins. Times are office-local (config timezone).
create or replace function public.admin_set_attendance(
  p_user uuid,
  p_date date,
  p_in time,
  p_out time,
  p_status text,
  p_remarks text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.attendance_config;
  v_admin uuid := auth.uid();
  v_today date;
  v_old public.attendance_days;
  v_had_row boolean;
  v_worked int := 0;
  v_status text;
  v_late boolean := false;
  v_late_min int := 0;
  v_first_in timestamptz := null;
  v_last_out timestamptz := null;
  v_new public.attendance_days;
begin
  if not public.has_permission('attendance.manage') then
    raise exception 'not allowed to edit attendance';
  end if;
  if p_remarks is null or length(trim(p_remarks)) = 0 then
    raise exception 'a remark is required';
  end if;
  if p_status is not null
     and p_status not in ('full_day', 'half_day', 'quarter_day', 'absent') then
    raise exception 'invalid status';
  end if;

  select * into cfg from public.attendance_config where id;
  v_today := (now() at time zone cfg.timezone)::date;
  if p_date > v_today then raise exception 'cannot enter attendance for a future date'; end if;

  if p_in is not null and p_out is not null then
    if p_out <= p_in then raise exception 'punch-out must be after punch-in'; end if;
    v_worked := ceil(extract(epoch from (p_out - p_in)) / 60.0);
  elsif p_status is null then
    raise exception 'enter both punch-in and punch-out times, or choose a status';
  end if;

  if p_in is not null then
    v_first_in := (p_date + p_in) at time zone cfg.timezone;
    v_late := p_in > (cfg.work_start + make_interval(mins => cfg.grace_minutes));
    if v_late then
      v_late_min := floor(extract(epoch from (p_in - cfg.work_start)) / 60.0);
    end if;
  end if;
  if p_out is not null then
    v_last_out := (p_date + p_out) at time zone cfg.timezone;
  end if;

  v_status := coalesce(p_status, public.attendance_status_for(v_worked));

  select * into v_old from public.attendance_days where user_id = p_user and work_date = p_date;
  v_had_row := found;

  insert into public.attendance_days (
    user_id, work_date, first_in_at, last_out_at, worked_minutes, credited_minutes, status,
    is_late, late_minutes, missed_punch_out, overtime_minutes,
    is_manual, remarks, corrected_by, corrected_at
  )
  values (p_user, p_date, v_first_in, v_last_out, v_worked, v_worked, v_status,
          v_late, v_late_min, false,
          greatest(0, v_worked - (cfg.overtime_after_hours * 60)::int),
          true, trim(p_remarks), v_admin, now())
  on conflict (user_id, work_date) do update set
    first_in_at = excluded.first_in_at,
    last_out_at = excluded.last_out_at,
    worked_minutes = excluded.worked_minutes,
    credited_minutes = excluded.credited_minutes,
    status = excluded.status,
    is_late = excluded.is_late,
    late_minutes = excluded.late_minutes,
    missed_punch_out = false,
    overtime_minutes = excluded.overtime_minutes,
    is_manual = true,
    remarks = excluded.remarks,
    corrected_by = excluded.corrected_by,
    corrected_at = excluded.corrected_at,
    updated_at = now()
  returning * into v_new;

  insert into public.attendance_corrections
    (user_id, work_date, action, old_value, new_value, remarks, corrected_by)
  values (p_user, p_date, 'set',
          case when v_had_row then to_jsonb(v_old) end, to_jsonb(v_new), trim(p_remarks), v_admin);

  -- The punch-in lock follows the last day with an attendance row. A day the
  -- admin created from scratch must not start locking the employee out.
  if not v_had_row then
    insert into public.planning_compliance
      (user_id, work_date, unlocked, unlocked_by, unlocked_at, unlock_remarks)
    values (p_user, p_date, true, v_admin, now(), 'Manual attendance entry')
    on conflict (user_id, work_date) do nothing;
  end if;

  return jsonb_build_object('ok', true, 'status', v_status, 'worked_minutes', v_worked);
end;
$$;
grant execute on function public.admin_set_attendance(uuid, date, time, time, text, text) to authenticated;

-- Admin: drop a correction and go back to what the punches say ------------------
create or replace function public.admin_reset_attendance(p_user uuid, p_date date, p_remarks text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_old public.attendance_days;
begin
  if not public.has_permission('attendance.manage') then
    raise exception 'not allowed to edit attendance';
  end if;
  if p_remarks is null or length(trim(p_remarks)) = 0 then
    raise exception 'a remark is required';
  end if;

  select * into v_old from public.attendance_days
    where user_id = p_user and work_date = p_date and is_manual;
  if not found then
    return jsonb_build_object('ok', true, 'unchanged', true);
  end if;

  insert into public.attendance_corrections
    (user_id, work_date, action, old_value, new_value, remarks, corrected_by)
  values (p_user, p_date, 'reset', to_jsonb(v_old), null, trim(p_remarks), v_admin);

  if exists (select 1 from public.attendance_punches
             where user_id = p_user and work_date = p_date) then
    update public.attendance_days set
      is_manual = false, remarks = null, corrected_by = null, corrected_at = null
      where id = v_old.id;
    perform public.recompute_attendance_day(p_user, p_date);
  else
    delete from public.attendance_days where id = v_old.id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.admin_reset_attendance(uuid, date, text) to authenticated;
