-- ============================================================================
-- Enhancement: per-task remarks (editable by creator, assignee or task manager).
-- The existing tasks_update RLS policy already grants those actors UPDATE, so no
-- new policy is required — this only adds the column.
-- ============================================================================

alter table public.tasks add column if not exists remarks text;
