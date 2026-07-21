-- ============================================================================
-- Punch lock simplification — one lock, one unlock
--
-- 1. The punch-OUT planning gate is removed: planning never blocks punch-out.
-- 2. One simple lock remains. If the user's LAST WORKED day has incomplete
--    planning (day-end update not submitted, or working hours not fully
--    covered by slots), punch-in is blocked EVERY day — not just the next
--    day — until the lock is lifted.
-- 3. The lock lifts when that day's planning is completed, or when an admin
--    unlocks with a mandatory remark. unlock_planning no longer takes a
--    date: it unlocks whatever day is currently blocking the user.
-- 4. Every admin unlock is recorded in planning_unlock_history.
-- ============================================================================

-- Unlock audit trail ----------------------------------------------------------
create table if not exists public.planning_unlock_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null,
  unlocked_by uuid references public.profiles(id) on delete set null,
  remarks text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_unlock_history_created
  on public.planning_unlock_history(created_at desc);

alter table public.planning_unlock_history enable row level security;
create policy unlock_history_select on public.planning_unlock_history
  for select to authenticated
  using (user_id = auth.uid() or public.has_permission('planning.view_all'));
-- No insert/update/delete policies: rows are written only by the
-- security-definer unlock_planning function.

-- Lock predicate: the LAST worked day before today must be fully planned ------
-- (Previously only yesterday was checked, so skipping a day silently cleared
-- the lock. Now the lock persists until the blocking day is planned/unlocked.)
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
    or (coalesce(comp.day_end_submitted, false)
        and public.planning_day_fully_planned(p_user, v_prev));
  return jsonb_build_object('locked', not v_ok, 'prev_date', v_prev);
end;
$$;
grant execute on function public.punch_in_locked_for(uuid, date) to authenticated;

-- Date-less unlock: lifts whatever day currently blocks the user --------------
drop function if exists public.unlock_planning(uuid, date, text);
create or replace function public.unlock_planning(p_user uuid, p_remarks text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.attendance_config;
  v_admin uuid := auth.uid();
  v_today date;
  v_lock jsonb;
  v_prev date;
begin
  if not public.has_permission('attendance.unlock') then
    raise exception 'not allowed to unlock';
  end if;
  if p_remarks is null or length(trim(p_remarks)) = 0 then
    raise exception 'a remark is required to unlock';
  end if;

  select * into cfg from public.attendance_config where id;
  v_today := (now() at time zone cfg.timezone)::date;
  v_lock := public.punch_in_locked_for(p_user, v_today);
  if not coalesce((v_lock ->> 'locked')::boolean, false) then
    return jsonb_build_object('ok', true, 'already_unlocked', true);
  end if;

  v_prev := (v_lock ->> 'prev_date')::date;
  insert into public.planning_compliance
    (user_id, work_date, unlocked, unlocked_by, unlocked_at, unlock_remarks)
  values (p_user, v_prev, true, v_admin, now(), trim(p_remarks))
  on conflict (user_id, work_date) do update set
    unlocked = true, unlocked_by = v_admin, unlocked_at = now(),
    unlock_remarks = trim(p_remarks), updated_at = now();

  insert into public.planning_unlock_history (user_id, work_date, unlocked_by, remarks)
  values (p_user, v_prev, v_admin, trim(p_remarks));

  return jsonb_build_object('ok', true, 'work_date', v_prev);
end;
$$;
grant execute on function public.unlock_planning(uuid, text) to authenticated;

-- Admin overview: current lock state for every active employee ----------------
create or replace function public.punch_lock_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.attendance_config;
  v_today date;
begin
  if not (public.has_permission('attendance.unlock')
          or public.has_permission('planning.view_all')) then
    raise exception 'not allowed';
  end if;
  select * into cfg from public.attendance_config where id;
  v_today := (now() at time zone cfg.timezone)::date;
  return coalesce(
    (select jsonb_agg(
        public.punch_in_locked_for(p.id, v_today) || jsonb_build_object('user_id', p.id))
     from public.profiles p
     where p.status = 'active'),
    '[]'::jsonb
  );
end;
$$;
grant execute on function public.punch_lock_overview() to authenticated;

-- Punch RPC: punch-out gate removed; only the punch-in lock remains ------------
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
  v_user uuid := auth.uid();
  v_dist numeric;
  v_date date;
  v_last text;
  v_open boolean;
  v_day public.attendance_days;
  v_lock jsonb;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_type not in ('in', 'out') then raise exception 'invalid punch type'; end if;

  select * into cfg from public.attendance_config where id;

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

-- Grandfather old data ---------------------------------------------------------
-- The lock used to look only at yesterday; now it looks at the LAST worked day,
-- however far back. Without a backfill, deploying this would instantly lock
-- everyone whose older history predates full planning. Mark each user's last
-- worked day (before yesterday) as unlocked if it isn't compliant, so the
-- stricter rule starts fresh from deployment. Users locked under the old rule
-- (yesterday incomplete) stay locked.
do $$
declare
  v_today date;
begin
  select (now() at time zone timezone)::date into v_today from public.attendance_config where id;
  if v_today is null then return; end if;

  insert into public.planning_compliance (user_id, work_date, unlocked, unlocked_at, unlock_remarks)
  select l.user_id, l.work_date, true, now(),
         'Policy migration: persistent punch lock starts fresh from deployment'
  from (
    select user_id, max(work_date) as work_date
    from public.attendance_days
    where work_date < v_today - 1
    group by user_id
  ) l
  where not exists (
    select 1 from public.planning_compliance c
    where c.user_id = l.user_id and c.work_date = l.work_date
      and (c.unlocked
           or (c.day_end_submitted and public.planning_day_fully_planned(l.user_id, l.work_date)))
  )
  on conflict (user_id, work_date) do update set
    unlocked = true, unlocked_at = now(),
    unlock_remarks = coalesce(public.planning_compliance.unlock_remarks, excluded.unlock_remarks),
    updated_at = now();
end;
$$;
