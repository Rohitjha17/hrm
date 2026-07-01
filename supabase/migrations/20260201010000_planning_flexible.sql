-- ============================================================================
-- Planning enhancements:
--   1. Flexible slots — each slot is a fixed-length window (slot_interval_hours)
--      but may start at ANY time chosen by the employee. Store the chosen start.
--   2. Current-day only — next-day planning is retired, so it is no longer
--      required for punch-out/compliance.
-- Employees already own INSERT/UPDATE/DELETE on their own slots via existing RLS
-- (planning_slots_*), so no policy changes are needed for self-service editing.
-- ============================================================================

alter table public.planning_slots add column if not exists start_time time;

-- Retire the next-day requirement everywhere it is enforced (punch gate +
-- compliance calc read this flag).
alter table public.planning_config alter column require_next_day set default false;
insert into public.planning_config (id) values (true) on conflict (id) do nothing;
update public.planning_config set require_next_day = false;
