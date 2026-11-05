-- Requirements 41–46: helpdesk deletion, closure date, assignee and reporting details.
alter table public.tickets add column if not exists closed_at timestamptz;

create or replace function public.set_ticket_closed_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'closed' and old.status is distinct from 'closed' then new.closed_at := now(); end if;
  if new.status <> 'closed' then new.closed_at := null; end if;
  return new;
end;
$$;
drop trigger if exists trg_ticket_closed_at on public.tickets;
create trigger trg_ticket_closed_at before update on public.tickets
  for each row execute function public.set_ticket_closed_at();

create policy tickets_delete on public.tickets for delete to authenticated
  using (public.has_permission('helpdesk.manage'));

