-- ============================================================================
-- Policy enhancements:
--   1. Attachments — files (PDFs, etc.) attached to a policy, stored in the
--      private `documents` bucket under a `policies/<policy_id>/` prefix. The
--      reference list lives in policies.attachments = [{ path, name }].
--   2. Delete — already permitted: policies_write is `for all` gated by
--      policy.manage, so admins can DELETE policies (versions cascade). No new
--      table policy needed for delete.
-- ============================================================================

alter table public.policies
  add column if not exists attachments jsonb not null default '[]'::jsonb;

-- Storage RLS for policy attachments in the shared private `documents` bucket.
-- Uploads/deletes require policy.manage; any authenticated user may read (policy
-- documents are company-wide, matching policies_select using(true)).
drop policy if exists policy_attach_insert on storage.objects;
create policy policy_attach_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'policies'
    and public.has_permission('policy.manage')
  );

drop policy if exists policy_attach_select on storage.objects;
create policy policy_attach_select on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = 'policies');

drop policy if exists policy_attach_delete on storage.objects;
create policy policy_attach_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'policies'
    and public.has_permission('policy.manage')
  );
