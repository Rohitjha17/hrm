-- Requirement 80: make View/Add/Edit/Delete grants operational at the RLS layer.
-- Existing `<module>.manage` grants remain a backward-compatible superset.
create or replace function public.has_module_action(p_module text, p_action text)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_permission(p_module || '.' || p_action)
      or public.has_permission(p_module || '.manage');
$$;
grant execute on function public.has_module_action(text, text) to authenticated;

-- Attendance configuration. Historical attendance itself is written through
-- audited SECURITY DEFINER RPCs, whose legacy manage grant remains supported.
drop policy if exists attendance_config_write on public.attendance_config;
create policy attendance_config_insert on public.attendance_config for insert to authenticated
  with check (public.has_module_action('attendance', 'add'));
create policy attendance_config_update on public.attendance_config for update to authenticated
  using (public.has_module_action('attendance', 'edit'))
  with check (public.has_module_action('attendance', 'edit'));
create policy attendance_config_delete on public.attendance_config for delete to authenticated
  using (public.has_module_action('attendance', 'delete'));

-- Task status master and task records.
drop policy if exists task_statuses_write on public.task_statuses;
create policy task_statuses_insert on public.task_statuses for insert to authenticated
  with check (public.has_module_action('tasks', 'add'));
create policy task_statuses_update on public.task_statuses for update to authenticated
  using (public.has_module_action('tasks', 'edit'))
  with check (public.has_module_action('tasks', 'edit'));
create policy task_statuses_delete on public.task_statuses for delete to authenticated
  using (public.has_module_action('tasks', 'delete'));
drop policy if exists tasks_update on public.tasks;
drop policy if exists tasks_delete on public.tasks;
create policy tasks_update on public.tasks for update to authenticated
  using (created_by = auth.uid() or assignee_id = auth.uid() or public.has_module_action('tasks', 'edit'))
  with check (created_by = auth.uid() or assignee_id = auth.uid() or public.has_module_action('tasks', 'edit'));
create policy tasks_delete on public.tasks for delete to authenticated
  using (created_by = auth.uid() or public.has_module_action('tasks', 'delete'));

-- Planning retains employee self-service while splitting elevated actions.
drop policy if exists planning_slots_insert on public.planning_slots;
drop policy if exists planning_slots_update on public.planning_slots;
drop policy if exists planning_slots_delete on public.planning_slots;
create policy planning_slots_insert on public.planning_slots for insert to authenticated
  with check (user_id = auth.uid() or public.has_module_action('planning', 'add'));
create policy planning_slots_update on public.planning_slots for update to authenticated
  using (user_id = auth.uid() or public.has_module_action('planning', 'edit'))
  with check (user_id = auth.uid() or public.has_module_action('planning', 'edit'));
create policy planning_slots_delete on public.planning_slots for delete to authenticated
  using (user_id = auth.uid() or public.has_module_action('planning', 'delete'));

-- Leave masters and balances.
drop policy if exists leave_types_write on public.leave_types;
create policy leave_types_insert on public.leave_types for insert to authenticated
  with check (public.has_module_action('leave', 'add'));
create policy leave_types_update on public.leave_types for update to authenticated
  using (public.has_module_action('leave', 'edit'))
  with check (public.has_module_action('leave', 'edit'));
create policy leave_types_delete on public.leave_types for delete to authenticated
  using (public.has_module_action('leave', 'delete'));
drop policy if exists leave_balances_write on public.leave_balances;
create policy leave_balances_insert on public.leave_balances for insert to authenticated
  with check (public.has_module_action('leave', 'add'));
create policy leave_balances_update on public.leave_balances for update to authenticated
  using (public.has_module_action('leave', 'edit'))
  with check (public.has_module_action('leave', 'edit'));
create policy leave_balances_delete on public.leave_balances for delete to authenticated
  using (public.has_module_action('leave', 'delete'));

-- Salary setup and adjustments.
drop policy if exists salary_policy_write on public.salary_policy;
drop policy if exists salary_profiles_write on public.salary_profiles;
drop policy if exists salary_adjustments_write on public.salary_adjustments;
create policy salary_policy_insert on public.salary_policy for insert to authenticated
  with check (public.has_module_action('salary', 'add'));
create policy salary_policy_update on public.salary_policy for update to authenticated
  using (public.has_module_action('salary', 'edit')) with check (public.has_module_action('salary', 'edit'));
create policy salary_policy_delete on public.salary_policy for delete to authenticated
  using (public.has_module_action('salary', 'delete'));
create policy salary_profiles_insert on public.salary_profiles for insert to authenticated
  with check (public.has_module_action('salary', 'add'));
create policy salary_profiles_update on public.salary_profiles for update to authenticated
  using (public.has_module_action('salary', 'edit')) with check (public.has_module_action('salary', 'edit'));
create policy salary_profiles_delete on public.salary_profiles for delete to authenticated
  using (public.has_module_action('salary', 'delete'));
create policy salary_adjustments_insert on public.salary_adjustments for insert to authenticated
  with check (public.has_module_action('salary', 'add'));
create policy salary_adjustments_update on public.salary_adjustments for update to authenticated
  using (public.has_module_action('salary', 'edit')) with check (public.has_module_action('salary', 'edit'));
create policy salary_adjustments_delete on public.salary_adjustments for delete to authenticated
  using (public.has_module_action('salary', 'delete'));

-- Appraisal cycles and employee appraisals.
drop policy if exists appraisal_cycles_write on public.appraisal_cycles;
drop policy if exists appraisals_write on public.appraisals;
create policy appraisal_cycles_insert on public.appraisal_cycles for insert to authenticated
  with check (public.has_module_action('appraisal', 'add'));
create policy appraisal_cycles_update on public.appraisal_cycles for update to authenticated
  using (public.has_module_action('appraisal', 'edit')) with check (public.has_module_action('appraisal', 'edit'));
create policy appraisal_cycles_delete on public.appraisal_cycles for delete to authenticated
  using (public.has_module_action('appraisal', 'delete'));
create policy appraisals_insert on public.appraisals for insert to authenticated
  with check (public.has_module_action('appraisal', 'add'));
create policy appraisals_update on public.appraisals for update to authenticated
  using (public.has_module_action('appraisal', 'edit')) with check (public.has_module_action('appraisal', 'edit'));
create policy appraisals_delete on public.appraisals for delete to authenticated
  using (public.has_module_action('appraisal', 'delete'));

-- Employee documents. Read policies are unchanged and remain owner-aware.
drop policy if exists emp_docs_write on public.employee_documents;
create policy emp_docs_insert_row on public.employee_documents for insert to authenticated
  with check (public.has_module_action('documents', 'add'));
create policy emp_docs_update_row on public.employee_documents for update to authenticated
  using (public.has_module_action('documents', 'edit'))
  with check (public.has_module_action('documents', 'edit'));
create policy emp_docs_delete_row on public.employee_documents for delete to authenticated
  using (public.has_module_action('documents', 'delete'));

-- Helpdesk tickets: raising one's own ticket remains employee self-service;
-- elevated editing and deletion are now independent.
drop policy if exists tickets_update on public.tickets;
drop policy if exists tickets_delete on public.tickets;
create policy tickets_update on public.tickets for update to authenticated
  using (public.has_module_action('helpdesk', 'edit'))
  with check (public.has_module_action('helpdesk', 'edit'));
create policy tickets_delete on public.tickets for delete to authenticated
  using (public.has_module_action('helpdesk', 'delete'));

-- Master tables and payslip templates use the same action boundaries.
drop policy if exists document_types_write on public.document_types;
create policy document_types_insert on public.document_types for insert to authenticated
  with check (public.has_module_action('documents', 'add'));
create policy document_types_update on public.document_types for update to authenticated
  using (public.has_module_action('documents', 'edit')) with check (public.has_module_action('documents', 'edit'));
create policy document_types_delete on public.document_types for delete to authenticated
  using (public.has_module_action('documents', 'delete'));

drop policy if exists appraisal_types_write on public.appraisal_types;
create policy appraisal_types_insert on public.appraisal_types for insert to authenticated
  with check (public.has_module_action('appraisal', 'add'));
create policy appraisal_types_update on public.appraisal_types for update to authenticated
  using (public.has_module_action('appraisal', 'edit')) with check (public.has_module_action('appraisal', 'edit'));
create policy appraisal_types_delete on public.appraisal_types for delete to authenticated
  using (public.has_module_action('appraisal', 'delete'));

drop policy if exists policy_categories_write on public.policy_categories;
create policy policy_categories_insert on public.policy_categories for insert to authenticated
  with check (public.has_module_action('policy', 'add'));
create policy policy_categories_update on public.policy_categories for update to authenticated
  using (public.has_module_action('policy', 'edit')) with check (public.has_module_action('policy', 'edit'));
create policy policy_categories_delete on public.policy_categories for delete to authenticated
  using (public.has_module_action('policy', 'delete'));

drop policy if exists helpdesk_categories_write on public.helpdesk_categories;
create policy helpdesk_categories_insert on public.helpdesk_categories for insert to authenticated
  with check (public.has_module_action('helpdesk', 'add'));
create policy helpdesk_categories_update on public.helpdesk_categories for update to authenticated
  using (public.has_module_action('helpdesk', 'edit')) with check (public.has_module_action('helpdesk', 'edit'));
create policy helpdesk_categories_delete on public.helpdesk_categories for delete to authenticated
  using (public.has_module_action('helpdesk', 'delete'));

drop policy if exists payslip_templates_write on public.payslip_templates;
create policy payslip_templates_insert on public.payslip_templates for insert to authenticated
  with check (public.has_module_action('salary', 'add'));
create policy payslip_templates_update on public.payslip_templates for update to authenticated
  using (public.has_module_action('salary', 'edit')) with check (public.has_module_action('salary', 'edit'));
create policy payslip_templates_delete on public.payslip_templates for delete to authenticated
  using (public.has_module_action('salary', 'delete'));

