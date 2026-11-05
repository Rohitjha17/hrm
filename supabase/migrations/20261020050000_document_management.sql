-- Requirements 37–40: file activity reporting, version history, and managed document types.
create table if not exists public.document_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.document_types (code, name) values
  ('aadhaar', 'Aadhaar'), ('pan', 'PAN'), ('passport', 'Passport'),
  ('driving_license', 'Driving licence'), ('resume', 'Resume'), ('offer', 'Offer letter'),
  ('appointment', 'Appointment letter'), ('salary_revision', 'Salary revision'),
  ('warning', 'Warning letter'), ('promotion', 'Promotion letter'),
  ('experience', 'Experience letter'), ('relieving', 'Relieving letter')
on conflict (code) do nothing;

create trigger trg_document_types_updated before update on public.document_types
  for each row execute function public.set_updated_at();

alter table public.document_types enable row level security;
create policy document_types_select on public.document_types for select to authenticated using (true);
create policy document_types_write on public.document_types for all to authenticated
  using (public.has_permission('documents.manage'))
  with check (public.has_permission('documents.manage'));

create table if not exists public.document_file_activity (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.employee_documents(id) on delete set null,
  employee_id uuid not null references public.profiles(id) on delete cascade,
  file_title text not null,
  doc_type text not null,
  action text not null check (action in ('uploaded', 'downloaded')),
  actor_id uuid references public.profiles(id) on delete set null,
  occurred_at timestamptz not null default now()
);
create index if not exists idx_document_activity_occurred on public.document_file_activity(occurred_at desc);

create or replace function public.log_document_upload()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.document_file_activity
    (document_id, employee_id, file_title, doc_type, action, actor_id, occurred_at)
  values (new.id, new.employee_id, new.title, new.doc_type, 'uploaded', new.uploaded_by, new.created_at);
  return new;
end;
$$;
drop trigger if exists trg_log_document_upload on public.employee_documents;
create trigger trg_log_document_upload after insert on public.employee_documents
  for each row execute function public.log_document_upload();

insert into public.document_file_activity
  (document_id, employee_id, file_title, doc_type, action, actor_id, occurred_at)
select d.id, d.employee_id, d.title, d.doc_type, 'uploaded', d.uploaded_by, d.created_at
from public.employee_documents d
where not exists (
  select 1 from public.document_file_activity a
  where a.document_id = d.id and a.action = 'uploaded'
);

create or replace function public.log_document_download(p_document uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_doc public.employee_documents%rowtype;
begin
  select * into v_doc from public.employee_documents where id = p_document;
  if not found then raise exception 'document not found'; end if;
  if not (
    (v_doc.employee_id = auth.uid() and public.has_permission('documents.view_own'))
    or public.has_permission('documents.view') or public.has_permission('documents.manage')
  ) then raise exception 'not allowed'; end if;
  insert into public.document_file_activity
    (document_id, employee_id, file_title, doc_type, action, actor_id)
  values (v_doc.id, v_doc.employee_id, v_doc.title, v_doc.doc_type, 'downloaded', auth.uid());
  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.log_document_download(uuid) to authenticated;

alter table public.document_file_activity enable row level security;
create policy document_activity_select on public.document_file_activity for select to authenticated
  using (employee_id = auth.uid() or public.has_permission('documents.view') or public.has_permission('documents.manage'));

