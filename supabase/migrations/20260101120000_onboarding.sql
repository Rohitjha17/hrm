-- ============================================================================
-- Phase 12 — Onboarding
-- Designation-based document templates + a per-employee joining checklist.
-- ============================================================================

insert into public.permissions (key, description, category) values
  ('onboarding.manage', 'Manage onboarding & templates', 'onboarding')
on conflict (key) do nothing;
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key = 'onboarding.manage'
where r.slug = 'hr'
on conflict do nothing;

create table if not exists public.onboarding_templates (
  id uuid primary key default gen_random_uuid(),
  doc_type text not null check (doc_type in ('offer', 'appointment', 'joining', 'nda', 'contract', 'confidentiality', 'welcome')),
  title text not null,
  designation text,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.onboarding (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null unique references public.profiles(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.onboarding_items (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references public.onboarding(id) on delete cascade,
  item_key text not null,
  label text not null,
  status text not null default 'pending' check (status in ('pending', 'submitted', 'verified')),
  document_path text,
  updated_at timestamptz not null default now(),
  unique (onboarding_id, item_key)
);

create trigger trg_onboarding_updated before update on public.onboarding
  for each row execute function public.set_updated_at();
create trigger trg_onboarding_items_updated before update on public.onboarding_items
  for each row execute function public.set_updated_at();

-- Start onboarding + seed the default joining checklist ----------------------
create or replace function public.start_onboarding(p_employee uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.has_permission('onboarding.manage') then raise exception 'not allowed'; end if;
  insert into public.onboarding (employee_id) values (p_employee)
  on conflict (employee_id) do update set status = 'in_progress', updated_at = now()
  returning id into v_id;

  insert into public.onboarding_items (onboarding_id, item_key, label)
  select v_id, d.k, d.l from (values
    ('aadhaar', 'Aadhaar card'),
    ('pan', 'PAN card'),
    ('bank', 'Bank details'),
    ('education', 'Education documents'),
    ('previous_company', 'Previous-company documents'),
    ('emergency', 'Emergency contact'),
    ('photograph', 'Photograph')
  ) as d(k, l)
  on conflict (onboarding_id, item_key) do nothing;

  return jsonb_build_object('ok', true, 'onboarding_id', v_id);
end;
$$;
grant execute on function public.start_onboarding(uuid) to authenticated;

-- RLS -------------------------------------------------------------------------
alter table public.onboarding_templates enable row level security;
alter table public.onboarding enable row level security;
alter table public.onboarding_items enable row level security;

create policy onb_tpl_select on public.onboarding_templates for select to authenticated
  using (public.has_permission('onboarding.manage'));
create policy onb_tpl_write on public.onboarding_templates for all to authenticated
  using (public.has_permission('onboarding.manage')) with check (public.has_permission('onboarding.manage'));

create policy onb_select on public.onboarding for select to authenticated
  using (employee_id = auth.uid() or public.has_permission('onboarding.manage'));
create policy onb_write on public.onboarding for all to authenticated
  using (public.has_permission('onboarding.manage')) with check (public.has_permission('onboarding.manage'));

create policy onb_item_select on public.onboarding_items for select to authenticated
  using (
    public.has_permission('onboarding.manage')
    or exists (select 1 from public.onboarding o where o.id = onboarding_items.onboarding_id and o.employee_id = auth.uid())
  );
create policy onb_item_write on public.onboarding_items for all to authenticated
  using (public.has_permission('onboarding.manage')) with check (public.has_permission('onboarding.manage'));
