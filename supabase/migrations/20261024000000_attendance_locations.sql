-- ============================================================================
-- Attendance: geo-fence master.
--
-- Replaces the single office_lat/office_lng/radius on attendance_config with a
-- CRUDable table of locations. The punch RPC accepts a punch at ANY active
-- location (its own radius wins). Deployments without rows fall back to the
-- legacy config fields, so existing data keeps working during rollout.
-- ============================================================================

create table if not exists public.attendance_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  latitude numeric not null,
  longitude numeric not null,
  radius_meters integer not null default 50 check (radius_meters > 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_attendance_locations_active
  on public.attendance_locations(is_active, sort_order);

create trigger trg_attendance_locations_updated
  before update on public.attendance_locations
  for each row execute function public.set_updated_at();

-- Seed from the legacy config so nothing changes on deploy.
insert into public.attendance_locations (name, latitude, longitude, radius_meters, sort_order)
select 'Head office', c.office_lat, c.office_lng, c.radius_meters, 0
from public.attendance_config c where c.id
  and not exists (select 1 from public.attendance_locations);

alter table public.attendance_punches
  add column if not exists location_id uuid references public.attendance_locations(id) on delete set null,
  add column if not exists location_name text;

-- Nearest active location in metres, with the matching id/name/radius. ---------
-- Falls back to the legacy office_* fields when no active locations exist.
create or replace function public.nearest_attendance_location(p_lat numeric, p_lng numeric)
returns table(location_id uuid, name text, distance_m numeric, radius_m integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  cfg public.attendance_config;
begin
  return query
  select l.id, l.name,
         public.haversine_m(l.latitude, l.longitude, p_lat, p_lng),
         l.radius_meters
  from public.attendance_locations l
  where l.is_active
  order by public.haversine_m(l.latitude, l.longitude, p_lat, p_lng) asc
  limit 1;

  if not found then
    select * into cfg from public.attendance_config where id;
    return query select null::uuid, 'Office'::text,
                        public.haversine_m(cfg.office_lat, cfg.office_lng, p_lat, p_lng),
                        cfg.radius_meters;
  end if;
end;
$$;
grant execute on function public.nearest_attendance_location(numeric, numeric) to authenticated;

-- Punch RPC: pick the nearest active location, apply its own radius. ------------
drop function if exists public.attendance_punch(text, numeric, numeric, text, text, numeric);
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
  v_loc record;
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
  select * into v_loc from public.nearest_attendance_location(p_lat, p_lng);

  v_allow := least(greatest(coalesce(p_accuracy, 0), 0), cfg.location_accuracy_cap_m);
  if v_loc.distance_m > v_loc.radius_m + v_allow then
    return jsonb_build_object('ok', false, 'reason', 'out_of_radius',
      'distance_m', round(v_loc.distance_m),
      'radius_m', v_loc.radius_m,
      'location', v_loc.name);
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

  if p_type = 'in' then
    v_lock := public.punch_in_locked_for(v_user, v_date);
    if coalesce((v_lock ->> 'locked')::boolean, false) then
      return jsonb_build_object('ok', false, 'reason', 'previous_day_planning_incomplete',
        'prev_date', v_lock ->> 'prev_date');
    end if;
  end if;

  insert into public.attendance_punches (
    user_id, punch_type, punched_at, work_date, latitude, longitude,
    distance_meters, within_radius, selfie_path, ip_address, accuracy_meters,
    location_id, location_name
  )
  values (v_user, p_type, now(), v_date, p_lat, p_lng, round(v_loc.distance_m, 2),
          v_loc.distance_m <= v_loc.radius_m, p_selfie_path, p_ip, round(p_accuracy, 1),
          v_loc.location_id, v_loc.name);

  perform public.close_stale_attendance(v_user);
  perform public.recompute_attendance_day(v_user, v_date);
  select * into v_day from public.attendance_days where user_id = v_user and work_date = v_date;

  return jsonb_build_object(
    'ok', true, 'punch_type', p_type,
    'distance_m', round(v_loc.distance_m), 'location', v_loc.name,
    'work_date', v_date,
    'status', v_day.status, 'worked_minutes', v_day.worked_minutes,
    'is_late', v_day.is_late, 'late_minutes', v_day.late_minutes,
    'overtime_minutes', v_day.overtime_minutes
  );
end;
$$;
grant execute on function public.attendance_punch(text, numeric, numeric, text, text, numeric) to authenticated;

-- RLS: anyone reads active locations (needed by the punch page); admins CRUD. --
alter table public.attendance_locations enable row level security;

create policy attendance_locations_select on public.attendance_locations
  for select to authenticated using (true);

create policy attendance_locations_insert on public.attendance_locations
  for insert to authenticated
  with check (public.has_module_action('attendance', 'add')
              or public.has_permission('attendance.manage'));

create policy attendance_locations_update on public.attendance_locations
  for update to authenticated
  using (public.has_module_action('attendance', 'edit')
         or public.has_permission('attendance.manage'))
  with check (public.has_module_action('attendance', 'edit')
              or public.has_permission('attendance.manage'));

create policy attendance_locations_delete on public.attendance_locations
  for delete to authenticated
  using (public.has_module_action('attendance', 'delete')
         or public.has_permission('attendance.manage'));
