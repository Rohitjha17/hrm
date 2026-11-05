-- Requirements 68–69: editable policy and helpdesk category masters.
create table if not exists public.policy_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.helpdesk_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.policy_categories (name, sort_order) values
  ('attendance',1),('leave',2),('salary',3),('planning',4),('wfh',5),('appraisal',6),('general',7)
on conflict (name) do nothing;
insert into public.helpdesk_categories (name, sort_order) values
  ('it',1),('hr',2),('salary',3),('leave',4),('asset',5)
on conflict (name) do nothing;

alter table public.policies drop constraint if exists policies_category_check;
alter table public.tickets drop constraint if exists tickets_category_check;

create trigger trg_policy_categories_updated before update on public.policy_categories
  for each row execute function public.set_updated_at();
create trigger trg_helpdesk_categories_updated before update on public.helpdesk_categories
  for each row execute function public.set_updated_at();
create trigger trg_policy_categories_audit after insert or update or delete on public.policy_categories
  for each row execute function public.audit_master_change();
create trigger trg_helpdesk_categories_audit after insert or update or delete on public.helpdesk_categories
  for each row execute function public.audit_master_change();

alter table public.policy_categories enable row level security;
alter table public.helpdesk_categories enable row level security;
create policy policy_categories_select on public.policy_categories for select to authenticated using (true);
create policy policy_categories_write on public.policy_categories for all to authenticated
  using (public.has_permission('policy.manage')) with check (public.has_permission('policy.manage'));
create policy helpdesk_categories_select on public.helpdesk_categories for select to authenticated using (true);
create policy helpdesk_categories_write on public.helpdesk_categories for all to authenticated
  using (public.has_permission('helpdesk.manage')) with check (public.has_permission('helpdesk.manage'));

