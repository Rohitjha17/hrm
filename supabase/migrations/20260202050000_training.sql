-- ============================================================================
-- Training
-- Text training modules with attachments, assignable to users. Assignees mark
-- the module completed and then acknowledge it, closing the training loop.
-- ============================================================================

insert into public.permissions (key, description, category) values
  ('training.manage', 'Create training modules & assign them to users', 'training')
on conflict (key) do nothing;
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key = 'training.manage'
where r.slug = 'hr'
on conflict do nothing;

create table if not exists public.training_modules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_attachments (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.training_modules(id) on delete cascade,
  title text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_training_attachments_module on public.training_attachments(module_id);

create table if not exists public.training_assignments (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.training_modules(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'assigned' check (status in ('assigned', 'completed', 'acknowledged')),
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  completed_at timestamptz,
  acknowledged_at timestamptz,
  unique (module_id, user_id)
);
create index if not exists idx_training_assignments_user on public.training_assignments(user_id);
create index if not exists idx_training_assignments_module on public.training_assignments(module_id);

create trigger trg_training_modules_updated before update on public.training_modules
  for each row execute function public.set_updated_at();

-- RLS -------------------------------------------------------------------------
alter table public.training_modules enable row level security;
alter table public.training_attachments enable row level security;
alter table public.training_assignments enable row level security;

-- Modules readable by managers and by anyone the module is assigned to.
create policy training_modules_select on public.training_modules for select to authenticated
  using (
    public.has_permission('training.manage')
    or exists (select 1 from public.training_assignments a where a.module_id = training_modules.id and a.user_id = auth.uid())
  );
create policy training_modules_write on public.training_modules for all to authenticated
  using (public.has_permission('training.manage')) with check (public.has_permission('training.manage'));

create policy training_attachments_select on public.training_attachments for select to authenticated
  using (
    public.has_permission('training.manage')
    or exists (select 1 from public.training_assignments a where a.module_id = training_attachments.module_id and a.user_id = auth.uid())
  );
create policy training_attachments_write on public.training_attachments for all to authenticated
  using (public.has_permission('training.manage')) with check (public.has_permission('training.manage'));

-- Assignees see their own assignments; managers see all.
create policy training_assignments_select on public.training_assignments for select to authenticated
  using (user_id = auth.uid() or public.has_permission('training.manage'));
create policy training_assignments_insert on public.training_assignments for insert to authenticated
  with check (public.has_permission('training.manage'));
-- Assignees progress their own status; managers can correct anything.
create policy training_assignments_update on public.training_assignments for update to authenticated
  using (user_id = auth.uid() or public.has_permission('training.manage'))
  with check (user_id = auth.uid() or public.has_permission('training.manage'));
create policy training_assignments_delete on public.training_assignments for delete to authenticated
  using (public.has_permission('training.manage'));

-- Training material storage (documents bucket, training/ prefix) --------------
drop policy if exists training_attach_insert on storage.objects;
create policy training_attach_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'training'
    and public.has_permission('training.manage')
  );

drop policy if exists training_attach_select on storage.objects;
create policy training_attach_select on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = 'training');

drop policy if exists training_attach_delete on storage.objects;
create policy training_attach_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = 'training'
    and public.has_permission('training.manage')
  );
