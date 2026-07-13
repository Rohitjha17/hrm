-- ============================================================================
-- 1. Employees can see the assets assigned to them (My Assets view) — the
--    assets table was previously readable only with assets.view.
-- 2. Document managers can delete stored files (Doc Vault delete) — the
--    documents bucket had no DELETE policy, so removing a document's file
--    from storage was impossible.
-- ============================================================================

create policy assets_select_own on public.assets for select to authenticated
  using (
    exists (
      select 1 from public.asset_assignments aa
      where aa.asset_id = assets.id and aa.assignee_id = auth.uid()
    )
  );

create policy emp_docs_delete_obj on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.has_permission('documents.manage'));
