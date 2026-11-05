-- Requirement 78: profile pictures assigned by user administrators.
alter table public.profiles add column if not exists avatar_url text;

create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = 'avatars' and public.has_permission('users.manage'));
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = 'avatars' and public.has_permission('users.manage'));
create policy avatars_select on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = 'avatars');

