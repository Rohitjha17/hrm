-- ============================================================================
-- Lifecycle: exit document templates
-- Reuse the onboarding_templates model for exit letters (experience, relieving,
-- no-due, other). Lifecycle managers get template access without needing the
-- onboarding permission.
-- ============================================================================

alter table public.onboarding_templates drop constraint if exists onboarding_templates_doc_type_check;
alter table public.onboarding_templates add constraint onboarding_templates_doc_type_check
  check (doc_type in (
    'offer', 'appointment', 'joining', 'nda', 'contract', 'confidentiality', 'welcome',
    'experience', 'relieving', 'no_due', 'exit_other'
  ));

drop policy if exists onb_tpl_select on public.onboarding_templates;
create policy onb_tpl_select on public.onboarding_templates for select to authenticated
  using (public.has_permission('onboarding.manage') or public.has_permission('lifecycle.manage'));

drop policy if exists onb_tpl_write on public.onboarding_templates;
create policy onb_tpl_write on public.onboarding_templates for all to authenticated
  using (public.has_permission('onboarding.manage') or public.has_permission('lifecycle.manage'))
  with check (public.has_permission('onboarding.manage') or public.has_permission('lifecycle.manage'));
