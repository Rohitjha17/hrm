-- Requirements 59–67: centralized, ordered and auditable masters.
create table if not exists public.appraisal_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.appraisal_types (name, sort_order) values
  ('Monthly', 1), ('Quarterly', 2), ('Half-yearly', 3), ('Annual', 4)
on conflict (name) do nothing;

alter table public.document_types add column if not exists sort_order integer not null default 0;
with ranked as (
  select id, row_number() over (order by name)::integer as position from public.document_types
)
update public.document_types d set sort_order = ranked.position from ranked
where d.id = ranked.id and d.sort_order = 0;

create table if not exists public.master_audit_log (
  id bigint generated always as identity primary key,
  master_type text not null,
  record_id uuid not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_value jsonb,
  new_value jsonb,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index if not exists idx_master_audit_changed on public.master_audit_log(changed_at desc);

create or replace function public.audit_master_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.master_audit_log
    (master_type, record_id, action, old_value, new_value, changed_by)
  values (
    tg_table_name,
    coalesce(new.id, old.id),
    tg_op,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end,
    auth.uid()
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_task_categories_audit on public.task_categories;
create trigger trg_task_categories_audit after insert or update or delete on public.task_categories
  for each row execute function public.audit_master_change();
drop trigger if exists trg_document_types_audit on public.document_types;
create trigger trg_document_types_audit after insert or update or delete on public.document_types
  for each row execute function public.audit_master_change();
drop trigger if exists trg_appraisal_types_audit on public.appraisal_types;
create trigger trg_appraisal_types_audit after insert or update or delete on public.appraisal_types
  for each row execute function public.audit_master_change();

create trigger trg_appraisal_types_updated before update on public.appraisal_types
  for each row execute function public.set_updated_at();

alter table public.appraisal_types enable row level security;
alter table public.master_audit_log enable row level security;
create policy appraisal_types_select on public.appraisal_types for select to authenticated using (true);
create policy appraisal_types_write on public.appraisal_types for all to authenticated
  using (public.has_permission('appraisal.manage')) with check (public.has_permission('appraisal.manage'));
create policy master_audit_select on public.master_audit_log for select to authenticated
  using (public.has_permission('audit.view') or public.has_permission('users.manage'));

