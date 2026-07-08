-- ============================================================================
-- Planning: fully flexible slots
-- Slots can start AND end at any time (any duration). end_time complements the
-- existing start_time; slot_label is derived client-side from the pair.
-- Planning any date is a UI change (plan_date already supports it).
-- ============================================================================

alter table public.planning_slots add column if not exists end_time time;
