-- ============================================================================
-- Per-user workflows.
--
-- Every user documents their own workflows ("My Workflows" in the employee
-- view). A definition belongs to its creator (owner_id); workflow managers
-- see and manage everyone's. Legacy rows keep owner_id null and stay visible
-- to managers only.
-- ============================================================================

alter table public.workflow_definitions
  add column if not exists owner_id uuid references public.profiles(id) on delete cascade;

-- Definitions: owners get full control of their own; managers of all.
drop policy if exists wf_def_select on public.workflow_definitions;
drop policy if exists wf_def_write on public.workflow_definitions;

create policy wf_def_select on public.workflow_definitions for select to authenticated
  using (owner_id = auth.uid() or public.has_permission('workflow.manage'));
create policy wf_def_insert on public.workflow_definitions for insert to authenticated
  with check (owner_id = auth.uid() or public.has_permission('workflow.manage'));
create policy wf_def_update on public.workflow_definitions for update to authenticated
  using (owner_id = auth.uid() or public.has_permission('workflow.manage'))
  with check (owner_id = auth.uid() or public.has_permission('workflow.manage'));
create policy wf_def_delete on public.workflow_definitions for delete to authenticated
  using (owner_id = auth.uid() or public.has_permission('workflow.manage'));

-- Steps follow their definition's visibility.
drop policy if exists wf_step_select on public.workflow_steps;
drop policy if exists wf_step_write on public.workflow_steps;

create policy wf_step_select on public.workflow_steps for select to authenticated
  using (
    exists (
      select 1 from public.workflow_definitions d
      where d.id = definition_id
        and (d.owner_id = auth.uid() or public.has_permission('workflow.manage'))
    )
  );
create policy wf_step_write on public.workflow_steps for all to authenticated
  using (
    exists (
      select 1 from public.workflow_definitions d
      where d.id = definition_id
        and (d.owner_id = auth.uid() or public.has_permission('workflow.manage'))
    )
  )
  with check (
    exists (
      select 1 from public.workflow_definitions d
      where d.id = definition_id
        and (d.owner_id = auth.uid() or public.has_permission('workflow.manage'))
    )
  );
