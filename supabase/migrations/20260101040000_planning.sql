-- ============================================================================
-- Phase 4 — Planning & updates + mandatory planning policy
--
-- 2-hourly planning slots (configurable cadence/window), edit history, day-end
-- updates and next-day planning. A mandatory-policy engine gates Punch Out (or
-- next-day Punch In) until planning is complete; only an admin can unlock.
-- ============================================================================

create table if not exists public.planning_config (
  id boolean primary key default true,
  constraint planning_config_singleton check (id),
  slot_interval_hours numeric not null default 2,
  day_start time not null default '10:00',
  day_end time not null default '18:30',
  policy text not null default 'block_punch_out'
    check (policy in ('block_punch_out', 'block_next_day_in', 'off')),
  require_day_end boolean not null default true,
  require_next_day boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.planning_config (id) values (true) on conflict (id) do nothing;

create table if not exists public.planning_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_date date not null,
  kind text not null default 'day' check (kind in ('day', 'next_day')),
  slot_index integer not null,
  slot_label text not null,
  task_name text not null default '',
  progress integer not null default 0 check (progress between 0 and 100),
  challenges text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, plan_date, kind, slot_index)
);
create index if not exists idx_planning_user_date on public.planning_slots(user_id, plan_date);

create table if not exists public.planning_history (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.planning_slots(id) on delete cascade,
  changed_by uuid references public.profiles(id) on delete set null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.planning_compliance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null,
  day_end_submitted boolean not null default false,
  next_day_submitted boolean not null default false,
  unlocked boolean not null default false,
  unlocked_by uuid references public.profiles(id) on delete set null,
  unlocked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, work_date)
);

create trigger trg_planning_config_updated before update on public.planning_config
  for each row execute function public.set_updated_at();
create trigger trg_planning_slots_updated before update on public.planning_slots
  for each row execute function public.set_updated_at();
create trigger trg_planning_compliance_updated before update on public.planning_compliance
  for each row execute function public.set_updated_at();

-- Edit history for planning slots --------------------------------------------
create or replace function public.planning_slot_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.planning_history (slot_id, changed_by, before_data, after_data)
  values (new.id, auth.uid(), to_jsonb(old), to_jsonb(new));
  return new;
end;
$$;

create trigger trg_planning_history after update on public.planning_slots
  for each row execute function public.planning_slot_history();

-- Compliance: employee submits day-end update / next-day plan ----------------
create or replace function public.submit_planning_compliance(p_date date, p_part text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_part not in ('day_end', 'next_day') then raise exception 'invalid part'; end if;

  insert into public.planning_compliance (user_id, work_date, day_end_submitted, next_day_submitted)
  values (v_user, p_date, p_part = 'day_end', p_part = 'next_day')
  on conflict (user_id, work_date) do update set
    day_end_submitted = public.planning_compliance.day_end_submitted or (p_part = 'day_end'),
    next_day_submitted = public.planning_compliance.next_day_submitted or (p_part = 'next_day'),
    updated_at = now();

  return (select to_jsonb(c) from public.planning_compliance c where c.user_id = v_user and c.work_date = p_date);
end;
$$;
grant execute on function public.submit_planning_compliance(date, text) to authenticated;

-- Admin unlock ---------------------------------------------------------------
create or replace function public.unlock_planning(p_user uuid, p_date date)
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
  insert into public.planning_compliance (user_id, work_date, unlocked, unlocked_by, unlocked_at)
  values (p_user, p_date, true, v_user, now())
  on conflict (user_id, work_date) do update set
    unlocked = true, unlocked_by = v_user, unlocked_at = now(), updated_at = now();
  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.unlock_planning(uuid, date) to authenticated;

-- Redefine the punch RPC to enforce the mandatory planning policy ------------
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
  v_prev date;
  v_last text;
  v_open boolean;
  v_day public.attendance_days;
  v_compliant boolean;
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

  -- Mandatory planning policy ------------------------------------------------
  if p_type = 'out' and pcfg.policy = 'block_punch_out' then
    select * into comp from public.planning_compliance where user_id = v_user and work_date = v_date;
    v_compliant := coalesce(comp.unlocked, false)
      or ((not pcfg.require_day_end or coalesce(comp.day_end_submitted, false))
          and (not pcfg.require_next_day or coalesce(comp.next_day_submitted, false)));
    if not v_compliant then
      return jsonb_build_object('ok', false, 'reason', 'planning_incomplete');
    end if;
  end if;

  if p_type = 'in' and pcfg.policy = 'block_next_day_in' then
    select work_date into v_prev from public.attendance_days
      where user_id = v_user and work_date < v_date order by work_date desc limit 1;
    if v_prev is not null then
      select * into comp from public.planning_compliance where user_id = v_user and work_date = v_prev;
      v_compliant := coalesce(comp.unlocked, false)
        or ((not pcfg.require_day_end or coalesce(comp.day_end_submitted, false))
            and (not pcfg.require_next_day or coalesce(comp.next_day_submitted, false)));
      if not v_compliant then
        return jsonb_build_object('ok', false, 'reason', 'previous_day_planning_incomplete');
      end if;
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

-- RLS -------------------------------------------------------------------------
alter table public.planning_config enable row level security;
alter table public.planning_slots enable row level security;
alter table public.planning_history enable row level security;
alter table public.planning_compliance enable row level security;

create policy planning_config_select on public.planning_config for select to authenticated using (true);
create policy planning_config_write on public.planning_config for all to authenticated
  using (public.has_permission('planning.config'))
  with check (public.has_permission('planning.config'));

create policy planning_slots_select on public.planning_slots for select to authenticated
  using (user_id = auth.uid() or public.has_permission('planning.view_all'));
create policy planning_slots_insert on public.planning_slots for insert to authenticated
  with check (user_id = auth.uid() or public.has_permission('planning.manage'));
create policy planning_slots_update on public.planning_slots for update to authenticated
  using (user_id = auth.uid() or public.has_permission('planning.manage'))
  with check (user_id = auth.uid() or public.has_permission('planning.manage'));
create policy planning_slots_delete on public.planning_slots for delete to authenticated
  using (user_id = auth.uid() or public.has_permission('planning.manage'));

create policy planning_history_select on public.planning_history for select to authenticated
  using (
    exists (
      select 1 from public.planning_slots s
      where s.id = slot_id and (s.user_id = auth.uid() or public.has_permission('planning.view_all'))
    )
  );

create policy planning_compliance_select on public.planning_compliance for select to authenticated
  using (user_id = auth.uid() or public.has_permission('planning.view_all'));

-- Realtime for the admin planning monitor
alter publication supabase_realtime add table public.planning_compliance;
alter publication supabase_realtime add table public.planning_slots;
