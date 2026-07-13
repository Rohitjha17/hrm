-- ============================================================================
-- Leave: per-request duration (full / half / quarter day)
-- The day counter multiplies the inclusive date span by the duration factor,
-- so decide_leave() keeps deducting the correct amount from balances.
-- ============================================================================

alter table public.leave_requests add column if not exists duration text not null default 'full_day'
  check (duration in ('full_day', 'half_day', 'quarter_day'));

create or replace function public.set_leave_days()
returns trigger language plpgsql as $$
declare
  v_factor numeric := case new.duration
    when 'half_day' then 0.5
    when 'quarter_day' then 0.25
    else 1
  end;
begin
  new.days := ((new.end_date - new.start_date) + 1) * v_factor;
  return new;
end;
$$;

drop trigger if exists trg_leave_days on public.leave_requests;
create trigger trg_leave_days
  before insert or update of start_date, end_date, duration on public.leave_requests
  for each row execute function public.set_leave_days();
