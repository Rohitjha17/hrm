-- ============================================================================
-- Appraisal enhancement: capture KRAs (Key Result Areas) and KPIs (Key
-- Performance Indicators) alongside the existing computed scores, performance
-- rating and manager/HR feedback, so admins have the full picture to decide an
-- appraisal. RLS on appraisals is unchanged (managed by appraisal.manage).
-- ============================================================================

alter table public.appraisals add column if not exists kra text;
alter table public.appraisals add column if not exists kpi text;
