-- ============================================================================
-- Task remark history
-- Remarks become an append-only log (task_remarks). tasks.remarks is kept as a
-- denormalized "latest remark" for list previews; the RPC maintains both.
-- ============================================================================

create table if not exists public.task_remarks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_task_remarks_task on public.task_remarks(task_id);

-- Backfill: preserve the current single remark as the first history entry.
insert into public.task_remarks (task_id, author_id, body, created_at)
select t.id, t.created_by, t.remarks, t.updated_at
from public.tasks t
where t.remarks is not null and btrim(t.remarks) <> ''
  and not exists (select 1 from public.task_remarks r where r.task_id = t.id);

-- Append a remark: authorize like update_task_status, insert history and keep
-- tasks.remarks pointing at the latest entry.
create or replace function public.add_task_remark(p_task uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  t public.tasks;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_body is null or btrim(p_body) = '' then raise exception 'remark cannot be empty'; end if;
  select * into t from public.tasks where id = p_task;
  if not found then raise exception 'task not found'; end if;
  if not (t.created_by = v_user or t.assignee_id = v_user or public.has_permission('tasks.manage')) then
    raise exception 'not allowed to remark on this task';
  end if;

  insert into public.task_remarks (task_id, author_id, body) values (p_task, v_user, btrim(p_body));
  update public.tasks set remarks = btrim(p_body) where id = p_task;

  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.add_task_remark(uuid, text) to authenticated;

-- RLS: readable if you can see the task; written only via the RPC.
alter table public.task_remarks enable row level security;
create policy task_remarks_select on public.task_remarks for select to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id
        and (t.created_by = auth.uid() or t.assignee_id = auth.uid()
             or public.has_permission('tasks.view_all'))
    )
  );

alter publication supabase_realtime add table public.task_remarks;
