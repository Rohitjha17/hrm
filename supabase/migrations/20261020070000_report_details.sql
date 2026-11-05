-- Requirements 47–51: meeting attendance, training results and workflow descriptions.
update public.meeting_invitees set status = 'rejected' where status = 'declined';
alter table public.meeting_invitees drop constraint if exists meeting_invitees_status_check;
alter table public.meeting_invitees add constraint meeting_invitees_status_check
  check (status in ('invited', 'accepted', 'rejected', 'attended'));

alter table public.training_assignments
  add column if not exists certificate_issued boolean not null default false,
  add column if not exists assessment_score numeric,
  add column if not exists assessment_result text;
alter table public.training_assignments drop constraint if exists training_assessment_score_check;
alter table public.training_assignments add constraint training_assessment_score_check
  check (assessment_score is null or (assessment_score >= 0 and assessment_score <= 100));

alter table public.workflow_definitions add column if not exists description text;

