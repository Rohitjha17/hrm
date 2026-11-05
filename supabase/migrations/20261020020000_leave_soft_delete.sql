-- Requirement 23: recoverable leave deletion with balance-safe server logic.
alter table public.leave_requests
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null,
  add column if not exists deletion_reason text;

create or replace function public.delete_leave_request(p_request uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  r public.leave_requests;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select * into r from public.leave_requests where id = p_request and deleted_at is null for update;
  if not found then raise exception 'leave request not found'; end if;
  if not (public.has_permission('leave.approve') or
          (r.user_id = v_user and r.status in ('pending', 'cancelled'))) then
    raise exception 'not allowed to delete this leave request';
  end if;

  if r.status = 'approved' then
    update public.leave_balances
    set used = greatest(0, used - r.days), updated_at = now()
    where user_id = r.user_id
      and leave_type_id = r.leave_type_id
      and year = extract(year from r.start_date)::integer;
  end if;

  update public.leave_requests
  set deleted_at = now(), deleted_by = v_user, deletion_reason = nullif(btrim(p_reason), '')
  where id = p_request;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.delete_leave_request(uuid, text) to authenticated;
