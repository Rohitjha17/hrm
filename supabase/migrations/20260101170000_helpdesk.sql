-- ============================================================================
-- Phase 17 — Helpdesk / ticketing
-- Tickets by category, status updates, SLA tracking + escalation.
-- ============================================================================

insert into public.permissions (key, description, category) values
  ('helpdesk.manage', 'Manage & resolve tickets', 'helpdesk')
on conflict (key) do nothing;
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key = 'helpdesk.manage'
where r.slug = 'hr'
on conflict do nothing;

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  raised_by uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('it', 'hr', 'salary', 'leave', 'asset')),
  subject text not null,
  description text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  assigned_to uuid references public.profiles(id) on delete set null,
  sla_due_at timestamptz,
  escalated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tickets_raised on public.tickets(raised_by);

create table if not exists public.ticket_updates (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  message text,
  status text,
  created_at timestamptz not null default now()
);

-- SLA due date by priority ----------------------------------------------------
create or replace function public.set_ticket_sla()
returns trigger language plpgsql as $$
begin
  if new.sla_due_at is null then
    new.sla_due_at := now() + case new.priority
      when 'high' then interval '4 hours'
      when 'low' then interval '72 hours'
      else interval '24 hours' end;
  end if;
  return new;
end;
$$;
create trigger trg_ticket_sla before insert on public.tickets
  for each row execute function public.set_ticket_sla();

create trigger trg_tickets_updated before update on public.tickets
  for each row execute function public.set_updated_at();

-- RLS -------------------------------------------------------------------------
alter table public.tickets enable row level security;
alter table public.ticket_updates enable row level security;

create policy tickets_select on public.tickets for select to authenticated
  using (raised_by = auth.uid() or assigned_to = auth.uid() or public.has_permission('helpdesk.manage'));
create policy tickets_insert on public.tickets for insert to authenticated
  with check (raised_by = auth.uid());
create policy tickets_update on public.tickets for update to authenticated
  using (public.has_permission('helpdesk.manage')) with check (public.has_permission('helpdesk.manage'));

create policy ticket_updates_select on public.ticket_updates for select to authenticated
  using (
    exists (select 1 from public.tickets t where t.id = ticket_updates.ticket_id
      and (t.raised_by = auth.uid() or public.has_permission('helpdesk.manage')))
  );
create policy ticket_updates_insert on public.ticket_updates for insert to authenticated
  with check (
    exists (select 1 from public.tickets t where t.id = ticket_updates.ticket_id
      and (t.raised_by = auth.uid() or public.has_permission('helpdesk.manage')))
  );
