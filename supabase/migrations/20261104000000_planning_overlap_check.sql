-- Prevent multiple planning slots on the same date from overlapping in time
-- for the same user. Null start/end (open slots) are not constrained.

create or replace function public.check_planning_no_overlap()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.start_time is null or new.end_time is null then
    return new;
  end if;
  if exists (
    select 1 from public.planning_slots
    where user_id = new.user_id
      and plan_date = new.plan_date
      and id is distinct from new.id
      and start_time is not null and end_time is not null
      and new.start_time < end_time
      and new.end_time > start_time
  ) then
    raise exception 'planning_overlap: this time range overlaps with another slot on the same day'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_planning_no_overlap on public.planning_slots;
create trigger trg_planning_no_overlap
  before insert or update of user_id, plan_date, start_time, end_time
  on public.planning_slots
  for each row execute function public.check_planning_no_overlap();
