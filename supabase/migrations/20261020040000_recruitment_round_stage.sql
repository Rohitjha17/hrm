-- Requirements 35–36: interview round and a concise five-stage recruitment pipeline.
alter table public.interviews add column if not exists interview_round text;

update public.candidates set status = 'applied' where status = 'shortlisted';
update public.candidates set status = 'interview' where status = 'interview_scheduled';

alter table public.candidates drop constraint if exists candidates_status_check;
alter table public.candidates add constraint candidates_status_check
  check (status in ('applied', 'interview', 'selected', 'rejected', 'joined'));

