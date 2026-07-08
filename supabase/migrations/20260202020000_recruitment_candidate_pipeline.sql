-- ============================================================================
-- Recruitment: candidate documents + communication checklist
-- - candidate_documents: multiple attachments per candidate (stored in the
--   private `documents` bucket under candidates/<candidate_id>/...).
-- - candidate_checklist_items: onboarding-style checklist to track documents
--   sent to / received from candidates (pre-hire communication).
-- ============================================================================

create table if not exists public.candidate_documents (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  title text not null,
  storage_path text not null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_candidate_docs_candidate on public.candidate_documents(candidate_id);

create table if not exists public.candidate_checklist_items (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  item_key text not null,
  label text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'received', 'verified')),
  note text,
  updated_at timestamptz not null default now(),
  unique (candidate_id, item_key)
);
create index if not exists idx_candidate_checklist_candidate on public.candidate_checklist_items(candidate_id);

create trigger trg_candidate_checklist_updated before update on public.candidate_checklist_items
  for each row execute function public.set_updated_at();

-- Start a candidate communication checklist (mirrors start_onboarding) --------
create or replace function public.start_candidate_checklist(p_candidate uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('recruitment.manage') then raise exception 'not allowed'; end if;
  if not exists (select 1 from public.candidates where id = p_candidate) then
    raise exception 'candidate not found';
  end if;

  insert into public.candidate_checklist_items (candidate_id, item_key, label)
  select p_candidate, d.k, d.l from (values
    ('resume', 'Resume / CV received'),
    ('id_proof', 'ID proof received'),
    ('education', 'Education documents received'),
    ('experience', 'Experience letters received'),
    ('offer_letter', 'Offer letter sent'),
    ('offer_acceptance', 'Offer acceptance received'),
    ('joining_confirmation', 'Joining date confirmed')
  ) as d(k, l)
  on conflict (candidate_id, item_key) do nothing;

  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.start_candidate_checklist(uuid) to authenticated;

-- RLS -------------------------------------------------------------------------
alter table public.candidate_documents enable row level security;
alter table public.candidate_checklist_items enable row level security;

create policy candidate_docs_select on public.candidate_documents for select to authenticated
  using (public.has_permission('recruitment.view'));
create policy candidate_docs_write on public.candidate_documents for all to authenticated
  using (public.has_permission('recruitment.manage')) with check (public.has_permission('recruitment.manage'));

create policy candidate_checklist_select on public.candidate_checklist_items for select to authenticated
  using (public.has_permission('recruitment.view'));
create policy candidate_checklist_write on public.candidate_checklist_items for all to authenticated
  using (public.has_permission('recruitment.manage')) with check (public.has_permission('recruitment.manage'));
