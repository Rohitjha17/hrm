-- ============================================================================
-- Phase 2 — Attendance (GPS + live selfie + working-hours engine + realtime)
--
-- Punch in/out is validated SERVER-SIDE (radius, sequence) via a SECURITY
-- DEFINER RPC. Attendance is computed from ACTUAL WORKED HOURS (not fixed clock
-- times) and is fully configurable. Changes stream to the admin monitor via
-- Supabase Realtime.
-- ============================================================================

-- Singleton config (one row enforced by a boolean PK) --------------------------
create table if not exists public.attendance_config (
  id boolean primary key default true,
  constraint attendance_config_singleton check (id),
  office_lat numeric not null default 22.745618,
  office_lng numeric not null default 75.8933851,
  radius_meters integer not null default 50,
  timezone text not null default 'Asia/Kolkata',
  work_start time not null default '10:00',
  work_end time not null default '18:30',
  grace_minutes integer not null default 10,
  full_day_hours numeric not null default 8.0,
  half_day_hours numeric not null default 4.0,
  quarter_day_hours numeric not null default 2.0,
  overtime_after_hours numeric not null default 9.0,
  ip_allowlist text[] not null default '{}',
  updated_at timestamptz not null default now()
);
insert into public.attendance_config (id) values (true) on conflict (id) do nothing;

create trigger trg_attendance_config_updated before update on public.attendance_config
  for each row execute function public.set_updated_at();

-- Raw punches -----------------------------------------------------------------
create table if not exists public.attendance_punches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  punch_type text not null check (punch_type in ('in', 'out')),
  punched_at timestamptz not null default now(),
  work_date date not null,
  latitude numeric,
  longitude numeric,
  distance_meters numeric,
  within_radius boolean not null default false,
  selfie_path text,
  ip_address text,
  created_at timestamptz not null default now()
);
create index if not exists idx_punches_user_date on public.attendance_punches(user_id, work_date);

-- Daily aggregate (one row per user per date) ---------------------------------
create table if not exists public.attendance_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null,
  first_in_at timestamptz,
  last_out_at timestamptz,
  worked_minutes integer not null default 0,
  status text not null default 'absent'
    check (status in ('present', 'full_day', 'half_day', 'quarter_day', 'absent')),
  is_late boolean not null default false,
  overtime_minutes integer not null default 0,
  punch_count integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, work_date)
);
create index if not exists idx_days_date on public.attendance_days(work_date);

create trigger trg_attendance_days_updated before update on public.attendance_days
  for each row execute function public.set_updated_at();

-- Distance helper (haversine, metres) -----------------------------------------
create or replace function public.haversine_m(lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric)
returns numeric
language sql
immutable
as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians((lat2 - lat1) / 2)), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians((lng2 - lng1) / 2)), 2)
  ));
$$;

-- Working-hours engine: recompute one user's day from its punches -------------
create or replace function public.recompute_attendance_day(p_user uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.attendance_config;
  r record;
  v_open timestamptz := null;
  v_first_in timestamptz := null;
  v_last_out timestamptz := null;
  v_worked int := 0;
  v_count int := 0;
  v_status text;
  v_late boolean := false;
  v_ot int := 0;
  v_local_in time;
begin
  select * into cfg from public.attendance_config where id;

  for r in
    select punch_type, punched_at
    from public.attendance_punches
    where user_id = p_user and work_date = p_date
    order by punched_at asc
  loop
    v_count := v_count + 1;
    if r.punch_type = 'in' then
      if v_first_in is null then v_first_in := r.punched_at; end if;
      if v_open is null then v_open := r.punched_at; end if;
    else
      if v_open is not null then
        v_worked := v_worked + ceil(extract(epoch from (r.punched_at - v_open)) / 60.0);
        v_open := null;
      end if;
      v_last_out := r.punched_at;
    end if;
  end loop;

  -- Still punched in: count the open segment up to now.
  if v_open is not null then
    v_worked := v_worked + ceil(extract(epoch from (now() - v_open)) / 60.0);
  end if;

  if v_first_in is not null then
    v_local_in := (v_first_in at time zone cfg.timezone)::time;
    v_late := v_local_in > (cfg.work_start + make_interval(mins => cfg.grace_minutes));
  end if;

  if v_worked >= cfg.full_day_hours * 60 then
    v_status := 'full_day';
  elsif v_worked >= cfg.half_day_hours * 60 then
    v_status := 'half_day';
  elsif v_worked >= cfg.quarter_day_hours * 60 then
    v_status := 'quarter_day';
  else
    v_status := 'absent';
  end if;

  -- In progress (open punch) and not yet a full day → 'present'.
  if v_open is not null and v_status <> 'full_day' then
    v_status := 'present';
  end if;

  v_ot := greatest(0, v_worked - (cfg.overtime_after_hours * 60)::int);

  insert into public.attendance_days (
    user_id, work_date, first_in_at, last_out_at, worked_minutes, status,
    is_late, overtime_minutes, punch_count
  )
  values (p_user, p_date, v_first_in, v_last_out, v_worked, v_status, v_late, v_ot, v_count)
  on conflict (user_id, work_date) do update set
    first_in_at = excluded.first_in_at,
    last_out_at = excluded.last_out_at,
    worked_minutes = excluded.worked_minutes,
    status = excluded.status,
    is_late = excluded.is_late,
    overtime_minutes = excluded.overtime_minutes,
    punch_count = excluded.punch_count,
    updated_at = now();
end;
$$;

revoke all on function public.recompute_attendance_day(uuid, date) from public;
grant execute on function public.recompute_attendance_day(uuid, date) to service_role;

-- Punch RPC: validates radius + sequence, records punch, recomputes the day ---
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

  select punch_type into v_last
  from public.attendance_punches
  where user_id = v_user and work_date = v_date
  order by punched_at desc
  limit 1;
  v_open := (v_last = 'in');

  if p_type = 'in' and v_open then
    return jsonb_build_object('ok', false, 'reason', 'already_punched_in');
  end if;
  if p_type = 'out' and (v_last is null or not v_open) then
    return jsonb_build_object('ok', false, 'reason', 'not_punched_in');
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

-- RLS -------------------------------------------------------------------------
alter table public.attendance_config enable row level security;
alter table public.attendance_punches enable row level security;
alter table public.attendance_days enable row level security;

create policy attendance_config_select on public.attendance_config for select to authenticated using (true);
create policy attendance_config_write on public.attendance_config for all to authenticated
  using (public.has_permission('attendance.manage'))
  with check (public.has_permission('attendance.manage'));

-- Punches/days are read by the owner or anyone with attendance.view_all.
-- Writes happen ONLY through the SECURITY DEFINER RPCs (no client write policy).
create policy punches_select on public.attendance_punches for select to authenticated
  using (user_id = auth.uid() or public.has_permission('attendance.view_all'));

create policy days_select on public.attendance_days for select to authenticated
  using (user_id = auth.uid() or public.has_permission('attendance.view_all'));

-- Realtime: stream attendance changes to authorized subscribers ---------------
alter publication supabase_realtime add table public.attendance_days;
alter publication supabase_realtime add table public.attendance_punches;

-- Storage policies for the private `selfies` bucket ---------------------------
create policy selfies_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'selfies' and (storage.foldername(name))[1] = auth.uid()::text);

create policy selfies_select on storage.objects for select to authenticated
  using (
    bucket_id = 'selfies'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.has_permission('attendance.view_all'))
  );
