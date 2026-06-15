-- ============================================================================
-- Phase 13 — Employee document management
-- Versioned, access-controlled private document repository (documents bucket).
-- ============================================================================

insert into public.permissions (key, description, category) values
  ('documents.view_own', 'View own documents', 'documents'),
  ('documents.view', 'View all employee documents', 'documents'),
  ('documents.manage', 'Upload & manage employee documents', 'documents')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key in ('documents.view', 'documents.manage')
where r.slug = 'hr'
on conflict do nothing;
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key = 'documents.view_own'
where r.slug in ('employee', 'intern')
on conflict do nothing;

create table if not exists public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles(id) on delete cascade,
  doc_type text not null,
  title text not null,
  storage_path text not null,
  version integer not null default 0,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_emp_docs on public.employee_documents(employee_id, doc_type);

-- Auto-version per (employee, doc_type) --------------------------------------
create or replace function public.set_document_version()
returns trigger language plpgsql as $$
begin
  if new.version is null or new.version = 0 then
    select coalesce(max(version), 0) + 1 into new.version
    from public.employee_documents where employee_id = new.employee_id and doc_type = new.doc_type;
  end if;
  return new;
end;
$$;
create trigger trg_doc_version before insert on public.employee_documents
  for each row execute function public.set_document_version();

-- RLS -------------------------------------------------------------------------
alter table public.employee_documents enable row level security;

create policy emp_docs_select on public.employee_documents for select to authenticated
  using (
    (employee_id = auth.uid() and public.has_permission('documents.view_own'))
    or public.has_permission('documents.view')
    or public.has_permission('documents.manage')
  );
create policy emp_docs_write on public.employee_documents for all to authenticated
  using (public.has_permission('documents.manage')) with check (public.has_permission('documents.manage'));

-- Storage: employee docs under <employee_id>/... in the documents bucket -----
create policy emp_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.has_permission('documents.manage'));
create policy emp_docs_select_obj on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.has_permission('documents.view')
      or public.has_permission('documents.manage')
    )
  );
