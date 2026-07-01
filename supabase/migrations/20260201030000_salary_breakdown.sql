-- ============================================================================
-- Salary enhancement: let admins define a full salary BREAKDOWN (Basic, HRA,
-- allowances, deductions, …) instead of a single monthly CTC figure.
--
-- `components` is an array of { label, kind: 'earning'|'deduction', amount }.
-- monthly_ctc is kept (the salary engine prorates it by attendance) and is
-- maintained as the sum of the earning components on save, so existing payroll
-- computation is unaffected.
-- ============================================================================

alter table public.salary_profiles
  add column if not exists components jsonb not null default '[]'::jsonb;
