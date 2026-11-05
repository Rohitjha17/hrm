-- Requirements 29–34: employee remarks complete the two-sided appraisal record.
alter table public.appraisals add column if not exists employee_feedback text;

create or replace function public.update_employee_appraisal_feedback(p_appraisal uuid, p_feedback text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old text;
begin
  select employee_feedback into v_old
  from public.appraisals
  where id = p_appraisal and user_id = auth.uid();
  if not found then raise exception 'appraisal not found or not allowed'; end if;

  update public.appraisals set employee_feedback = nullif(btrim(p_feedback), '') where id = p_appraisal;
  insert into public.appraisal_history (appraisal_id, changed_by, field, old_value, new_value)
  values (p_appraisal, auth.uid(), 'employee_feedback', v_old, nullif(btrim(p_feedback), ''));
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.update_employee_appraisal_feedback(uuid, text) to authenticated;
