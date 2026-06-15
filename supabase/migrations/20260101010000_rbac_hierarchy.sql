-- ============================================================================
-- Phase 1 — Auth, Roles, RBAC, Users & Hierarchy
--
-- Tables: companies → departments → teams; profiles; roles, permissions,
-- role_permissions, user_roles; audit_log.
-- RBAC is permission-based and unlimited. RLS is enforced at the DB layer via
-- SECURITY DEFINER helper functions (which bypass RLS to avoid policy
-- recursion). Default-deny: anon gets nothing; authenticated gets only what a
-- policy explicitly allows.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  employee_code text unique,
  phone text,
  department_id uuid references public.departments(id) on delete set null,
  reporting_manager_id uuid references public.profiles(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  name text not null,
  reporting_manager_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, name)
);

-- Team membership for a profile (a profile belongs to at most one team here).
alter table public.profiles
  add column if not exists team_id uuid references public.teams(id) on delete set null;

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text,
  category text not null default 'general',
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (role_id, permission_id)
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, role_id)
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists idx_departments_company on public.departments(company_id);
create index if not exists idx_teams_department on public.teams(department_id);
create index if not exists idx_profiles_department on public.profiles(department_id);
create index if not exists idx_profiles_team on public.profiles(team_id);
create index if not exists idx_profiles_manager on public.profiles(reporting_manager_id);
create index if not exists idx_role_permissions_role on public.role_permissions(role_id);
create index if not exists idx_user_roles_user on public.user_roles(user_id);
create index if not exists idx_audit_entity on public.audit_log(entity_type, entity_id);

-- ─────────────────────────────────────────────────────────────────────────
-- RBAC helper functions (SECURITY DEFINER → bypass RLS, prevent recursion)
-- ─────────────────────────────────────────────────────────────────────────

-- True if the current user has `perm` (or the '*' wildcard via Super Admin).
create or replace function public.has_permission(perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from user_roles ur
    join role_permissions rp on rp.role_id = ur.role_id
    join permissions p on p.id = rp.permission_id
    where ur.user_id = auth.uid()
      and (p.key = perm or p.key = '*')
  );
$$;

-- All effective permission keys for the current user.
create or replace function public.my_permissions()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct p.key), '{}')
  from user_roles ur
  join role_permissions rp on rp.role_id = ur.role_id
  join permissions p on p.id = rp.permission_id
  where ur.user_id = auth.uid();
$$;

-- Role slugs held by the current user.
create or replace function public.my_roles()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct r.slug), '{}')
  from user_roles ur
  join roles r on r.id = ur.role_id
  where ur.user_id = auth.uid();
$$;

grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.my_permissions() to authenticated;
grant execute on function public.my_roles() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- updated_at triggers
-- ─────────────────────────────────────────────────────────────────────────
create trigger trg_companies_updated before update on public.companies
  for each row execute function public.set_updated_at();
create trigger trg_departments_updated before update on public.departments
  for each row execute function public.set_updated_at();
create trigger trg_teams_updated before update on public.teams
  for each row execute function public.set_updated_at();
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger trg_roles_updated before update on public.roles
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- Generic audit trigger — append-only trail for sensitive mutations
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_log (actor_id, action, entity_type, entity_id, before_data, after_data)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce((case when tg_op = 'DELETE' then old.id else new.id end), null),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

create trigger trg_audit_roles after insert or update or delete on public.roles
  for each row execute function public.audit_trigger();
create trigger trg_audit_role_permissions after insert or update or delete on public.role_permissions
  for each row execute function public.audit_trigger();
create trigger trg_audit_user_roles after insert or update or delete on public.user_roles
  for each row execute function public.audit_trigger();
create trigger trg_audit_departments after insert or update or delete on public.departments
  for each row execute function public.audit_trigger();
create trigger trg_audit_teams after insert or update or delete on public.teams
  for each row execute function public.audit_trigger();
create trigger trg_audit_profiles after insert or update or delete on public.profiles
  for each row execute function public.audit_trigger();

-- ─────────────────────────────────────────────────────────────────────────
-- Enable RLS (default-deny) on every table
-- ─────────────────────────────────────────────────────────────────────────
alter table public.companies enable row level security;
alter table public.departments enable row level security;
alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.audit_log enable row level security;

-- ─────────────────────────────────────────────────────────────────────────
-- Policies
-- ─────────────────────────────────────────────────────────────────────────

-- Companies / departments / teams: the org chart is readable by any
-- authenticated user; mutations require hierarchy.manage.
create policy companies_select on public.companies for select to authenticated using (true);
create policy companies_write on public.companies for all to authenticated
  using (public.has_permission('hierarchy.manage'))
  with check (public.has_permission('hierarchy.manage'));

create policy departments_select on public.departments for select to authenticated using (true);
create policy departments_write on public.departments for all to authenticated
  using (public.has_permission('hierarchy.manage'))
  with check (public.has_permission('hierarchy.manage'));

create policy teams_select on public.teams for select to authenticated using (true);
create policy teams_write on public.teams for all to authenticated
  using (public.has_permission('hierarchy.manage'))
  with check (public.has_permission('hierarchy.manage'));

-- Profiles: read self, your direct reports, or all (with users.view).
-- Mutations require users.manage.
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or reporting_manager_id = auth.uid()
    or public.has_permission('users.view')
  );
create policy profiles_insert on public.profiles for insert to authenticated
  with check (public.has_permission('users.manage'));
create policy profiles_update on public.profiles for update to authenticated
  using (public.has_permission('users.manage'))
  with check (public.has_permission('users.manage'));
create policy profiles_delete on public.profiles for delete to authenticated
  using (public.has_permission('users.manage'));

-- Roles & permissions catalog: readable by any authenticated user (needed to
-- render role-management UI); mutations require roles.manage.
create policy roles_select on public.roles for select to authenticated using (true);
create policy roles_write on public.roles for all to authenticated
  using (public.has_permission('roles.manage'))
  with check (public.has_permission('roles.manage'));

create policy permissions_select on public.permissions for select to authenticated using (true);
create policy permissions_write on public.permissions for all to authenticated
  using (public.has_permission('roles.manage'))
  with check (public.has_permission('roles.manage'));

create policy role_permissions_select on public.role_permissions for select to authenticated using (true);
create policy role_permissions_write on public.role_permissions for all to authenticated
  using (public.has_permission('roles.manage'))
  with check (public.has_permission('roles.manage'));

-- User-role assignments: read own; admins (users.manage) read/manage all.
create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_permission('users.manage'));
create policy user_roles_write on public.user_roles for all to authenticated
  using (public.has_permission('users.manage'))
  with check (public.has_permission('users.manage'));

-- Audit log: readable with audit.view; never written directly by clients
-- (the SECURITY DEFINER trigger inserts rows, bypassing RLS).
create policy audit_select on public.audit_log for select to authenticated
  using (public.has_permission('audit.view'));

-- ─────────────────────────────────────────────────────────────────────────
-- Permission catalog + system roles (always present so RLS keys exist).
-- These rows are editable via the UI; system roles cannot be deleted.
-- ─────────────────────────────────────────────────────────────────────────
insert into public.permissions (key, description, category) values
  ('*', 'Full access (Super Admin wildcard)', 'system'),
  ('admin.access', 'Access the Admin view', 'admin'),
  ('users.view', 'View all employees', 'users'),
  ('users.manage', 'Create/edit/deactivate employees', 'users'),
  ('roles.view', 'View roles & permissions', 'roles'),
  ('roles.manage', 'Create/edit roles & assign permissions', 'roles'),
  ('hierarchy.view', 'View company/departments/teams', 'hierarchy'),
  ('hierarchy.manage', 'Manage departments, teams & reporting lines', 'hierarchy'),
  ('attendance.view_own', 'View own attendance', 'attendance'),
  ('attendance.view_all', 'View everyone''s attendance', 'attendance'),
  ('attendance.manage', 'Edit attendance records', 'attendance'),
  ('attendance.unlock', 'Unlock a blocked punch-out', 'attendance'),
  ('tasks.view_own', 'View own tasks', 'tasks'),
  ('tasks.view_all', 'View all tasks', 'tasks'),
  ('tasks.assign', 'Assign tasks to others', 'tasks'),
  ('tasks.manage', 'Manage tasks & task statuses', 'tasks'),
  ('planning.view_own', 'View own planning', 'planning'),
  ('planning.view_all', 'View all planning', 'planning'),
  ('planning.manage', 'Create/edit planning & updates', 'planning'),
  ('planning.config', 'Configure planning cadence', 'planning'),
  ('leave.view_own', 'View own leave', 'leave'),
  ('leave.view_all', 'View all leave', 'leave'),
  ('leave.apply', 'Apply for leave', 'leave'),
  ('leave.approve', 'Approve/reject leave', 'leave'),
  ('leave.manage', 'Manage leave types & balances', 'leave'),
  ('holidays.manage', 'Manage the holiday calendar', 'leave'),
  ('salary.view_own', 'View own salary', 'salary'),
  ('salary.view', 'View all salaries', 'salary'),
  ('salary.manage', 'Configure & run salary', 'salary'),
  ('appraisal.view_own', 'View own appraisals', 'appraisal'),
  ('appraisal.view', 'View all appraisals', 'appraisal'),
  ('appraisal.manage', 'Manage appraisal cycles', 'appraisal'),
  ('reports.view', 'View & export reports', 'reports'),
  ('audit.view', 'View the audit trail', 'admin')
on conflict (key) do nothing;

insert into public.roles (slug, name, description, is_system) values
  ('super_admin', 'Super Admin', 'Unrestricted access', true),
  ('hr', 'HR', 'People operations', true),
  ('manager', 'Manager', 'Manages a team', true),
  ('team_leader', 'Team Leader', 'Leads a team', true),
  ('employee', 'Employee', 'Standard employee self-service', true),
  ('intern', 'Intern', 'Intern self-service', true)
on conflict (slug) do nothing;

-- Super Admin → wildcard
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.slug = 'super_admin' and p.key = '*'
on conflict do nothing;

-- HR
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key in (
  'admin.access','users.view','users.manage','roles.view','hierarchy.view','hierarchy.manage',
  'attendance.view_all','attendance.manage','attendance.unlock',
  'tasks.view_all','tasks.assign','planning.view_all','planning.config',
  'leave.view_all','leave.approve','leave.manage','holidays.manage',
  'salary.view','salary.manage','appraisal.view','appraisal.manage','reports.view','audit.view'
) where r.slug = 'hr'
on conflict do nothing;

-- Manager
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key in (
  'admin.access','users.view','attendance.view_all',
  'tasks.view_all','tasks.assign','planning.view_all',
  'leave.view_all','leave.approve','appraisal.view','reports.view'
) where r.slug = 'manager'
on conflict do nothing;

-- Team Leader
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key in (
  'admin.access','users.view','attendance.view_all',
  'tasks.view_all','tasks.assign','planning.view_all','leave.view_all'
) where r.slug = 'team_leader'
on conflict do nothing;

-- Employee & Intern (self-service)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key in (
  'attendance.view_own','tasks.view_own','planning.view_own','planning.manage',
  'leave.view_own','leave.apply','salary.view_own','appraisal.view_own'
) where r.slug in ('employee', 'intern')
on conflict do nothing;
