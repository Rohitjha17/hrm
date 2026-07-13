-- ============================================================================
-- Appraisal: simplify cycles into plain periods + field-change history
--
-- 1. cycle_type never drove any behaviour (no recurrence engine) — it becomes
--    optional legacy metadata; a cycle is now just a named period (name+dates).
-- 2. appraisal_history logs every change to the qualitative fields (rating,
--    KRA, KPI, manager/HR feedback) as old→new rows, so edits never lose the
--    previous value. Score recomputes are not logged (derived data).
-- ============================================================================

alter table public.appraisal_cycles alter column cycle_type drop not null;

create table if not exists public.appraisal_history (
  id uuid primary key default gen_random_uuid(),
  appraisal_id uuid not null references public.appraisals(id) on delete cascade,
  changed_by uuid references public.profiles(id) on delete set null,
  field text not null,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);
create index if not exists idx_appraisal_history_appraisal on public.appraisal_history(appraisal_id);

create or replace function public.appraisal_field_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.performance_rating is distinct from old.performance_rating then
    insert into public.appraisal_history (appraisal_id, changed_by, field, old_value, new_value)
    values (new.id, auth.uid(), 'performance_rating', old.performance_rating::text, new.performance_rating::text);
  end if;
  if new.kra is distinct from old.kra then
    insert into public.appraisal_history (appraisal_id, changed_by, field, old_value, new_value)
    values (new.id, auth.uid(), 'kra', old.kra, new.kra);
  end if;
  if new.kpi is distinct from old.kpi then
    insert into public.appraisal_history (appraisal_id, changed_by, field, old_value, new_value)
    values (new.id, auth.uid(), 'kpi', old.kpi, new.kpi);
  end if;
  if new.manager_feedback is distinct from old.manager_feedback then
    insert into public.appraisal_history (appraisal_id, changed_by, field, old_value, new_value)
    values (new.id, auth.uid(), 'manager_feedback', old.manager_feedback, new.manager_feedback);
  end if;
  if new.hr_feedback is distinct from old.hr_feedback then
    insert into public.appraisal_history (appraisal_id, changed_by, field, old_value, new_value)
    values (new.id, auth.uid(), 'hr_feedback', old.hr_feedback, new.hr_feedback);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_appraisal_history on public.appraisals;
create trigger trg_appraisal_history after update on public.appraisals
  for each row execute function public.appraisal_field_history();

-- History readable by whoever can see the appraisal; written only by trigger.
alter table public.appraisal_history enable row level security;
create policy appraisal_history_select on public.appraisal_history for select to authenticated
  using (
    exists (
      select 1 from public.appraisals a
      where a.id = appraisal_id
        and ((a.user_id = auth.uid() and public.has_permission('appraisal.view_own'))
             or public.has_permission('appraisal.view'))
    )
  );
