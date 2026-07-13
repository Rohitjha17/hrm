-- ============================================================================
-- Workflows: retire the execution engine — keep only the read-only rulebook.
--
-- Workflows are now pure documentation: named definitions with ordered steps.
-- No routing, no per-step approver permissions, no running instances, no
-- Approvals inbox. Recruitment offers are approved directly on the candidate
-- (offer_status), not through a workflow instance.
-- ============================================================================

-- Recruitment sync trigger lived on workflow_instances — goes with the engine.
drop trigger if exists trg_offer_workflow_decided on public.workflow_instances;
drop function if exists public.on_offer_workflow_decided();

drop function if exists public.act_on_workflow(uuid, text, text);
drop function if exists public.start_workflow(uuid, text, text, uuid);

drop table if exists public.workflow_actions;
drop table if exists public.workflow_instances;

-- Steps are just named entries in an ordered plan now.
alter table public.workflow_steps drop column if exists approver_permission;
