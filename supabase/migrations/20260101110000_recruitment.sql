-- ============================================================================
-- Phase 11 — Recruitment & hiring
-- Openings, candidates, interviews + feedback, offer approval routed through the
-- Phase 10 workflow engine, and candidate status pipeline.
-- ============================================================================

insert into public.permissions (key, description, category) values
  ('recruitment.view', 'View recruitment', 'recruitment'),
  ('recruitment.manage', 'Manage openings, candidates & offers', 'recruitment')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key in ('recruitment.view', 'recruitment.manage')
where r.slug = 'hr'
on conflict do nothing;

create table if not exists public.job_openings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  designation text not null,
  department_id uuid references public.departments(id) on delete set null,
  description text,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  opening_id uuid not null references public.job_openings(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  resume_path text,
  status text not null default 'applied'
    check (status in ('applied', 'shortlisted', 'interview_scheduled', 'selected', 'rejected', 'joined')),
  offer_status text not null default 'none' check (offer_status in ('none', 'pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_candidates_opening on public.candidates(opening_id);

create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  scheduled_at timestamptz not null,
  interviewer_id uuid references public.profiles(id) on delete set null,
  mode text not null default 'video' check (mode in ('onsite', 'video', 'phone')),
  feedback text,
  rating integer check (rating between 1 and 5),
  recommendation text check (recommendation in ('proceed', 'hold', 'reject')),
  created_at timestamptz not null default now()
);
create index if not exists idx_interviews_candidate on public.interviews(candidate_id);

create trigger trg_candidates_updated before update on public.candidates
  for each row execute function public.set_updated_at();

-- Seed a default Offer Approval workflow (uses the Phase 10 engine) ----------
insert into public.workflow_definitions (id, name, entity_type)
values ('00000000-0000-0000-0000-0000000000a1', 'Offer Approval', 'recruitment_offer')
on conflict (id) do nothing;
insert into public.workflow_steps (definition_id, step_order, name, approver_permission)
values ('00000000-0000-0000-0000-0000000000a1', 1, 'HR Approval', 'recruitment.manage')
on conflict (definition_id, step_order) do nothing;

-- When an offer-approval instance is decided, reflect it on the candidate ----
create or replace function public.on_offer_workflow_decided()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.entity_type = 'recruitment_offer' and new.entity_id is not null
     and old.status = 'pending' and new.status in ('approved', 'rejected') then
    update public.candidates
      set offer_status = case when new.status = 'approved' then 'approved' else 'rejected' end,
          updated_at = now()
      where id = new.entity_id;
  end if;
  return new;
end;
$$;
create trigger trg_offer_workflow_decided after update on public.workflow_instances
  for each row execute function public.on_offer_workflow_decided();

-- RLS -------------------------------------------------------------------------
alter table public.job_openings enable row level security;
alter table public.candidates enable row level security;
alter table public.interviews enable row level security;

create policy openings_select on public.job_openings for select to authenticated
  using (public.has_permission('recruitment.view'));
create policy openings_write on public.job_openings for all to authenticated
  using (public.has_permission('recruitment.manage')) with check (public.has_permission('recruitment.manage'));

create policy candidates_select on public.candidates for select to authenticated
  using (public.has_permission('recruitment.view'));
create policy candidates_write on public.candidates for all to authenticated
  using (public.has_permission('recruitment.manage')) with check (public.has_permission('recruitment.manage'));

create policy interviews_select on public.interviews for select to authenticated
  using (public.has_permission('recruitment.view'));
create policy interviews_write on public.interviews for all to authenticated
  using (public.has_permission('recruitment.manage')) with check (public.has_permission('recruitment.manage'));

-- Resume storage (documents bucket) ------------------------------------------
create policy documents_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (public.has_permission('recruitment.manage') or public.has_permission('users.manage')));
create policy documents_select on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (public.has_permission('recruitment.view') or public.has_permission('users.manage')));
