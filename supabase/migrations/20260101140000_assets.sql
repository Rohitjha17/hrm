-- ============================================================================
-- Phase 14 — Asset management
-- Assets + assignment history (assign / transfer / return), condition tracking.
-- ============================================================================

insert into public.permissions (key, description, category) values
  ('assets.view', 'View assets', 'assets'),
  ('assets.manage', 'Manage & assign assets', 'assets')
on conflict (key) do nothing;
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key in ('assets.view', 'assets.manage')
where r.slug = 'hr'
on conflict do nothing;

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  asset_type text not null check (asset_type in ('laptop', 'desktop', 'mobile', 'sim', 'id_card', 'headset', 'other')),
  name text not null,
  serial text,
  condition text not null default 'good',
  status text not null default 'available' check (status in ('available', 'assigned', 'retired')),
  created_at timestamptz not null default now()
);

create table if not exists public.asset_assignments (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  assignee_id uuid not null references public.profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  returned_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_asset_assignments on public.asset_assignments(asset_id, assigned_at);

create or replace function public.assign_asset(p_asset uuid, p_assignee uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.has_permission('assets.manage') then raise exception 'not allowed'; end if;
  if exists (select 1 from public.asset_assignments where asset_id = p_asset and returned_at is null) then
    raise exception 'asset already assigned';
  end if;
  insert into public.asset_assignments (asset_id, assignee_id) values (p_asset, p_assignee);
  update public.assets set status = 'assigned' where id = p_asset;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.transfer_asset(p_asset uuid, p_new_assignee uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.has_permission('assets.manage') then raise exception 'not allowed'; end if;
  update public.asset_assignments set returned_at = now()
    where asset_id = p_asset and returned_at is null;
  insert into public.asset_assignments (asset_id, assignee_id) values (p_asset, p_new_assignee);
  update public.assets set status = 'assigned' where id = p_asset;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.return_asset(p_asset uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.has_permission('assets.manage') then raise exception 'not allowed'; end if;
  update public.asset_assignments set returned_at = now()
    where asset_id = p_asset and returned_at is null;
  update public.assets set status = 'available' where id = p_asset;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.assign_asset(uuid, uuid) to authenticated;
grant execute on function public.transfer_asset(uuid, uuid) to authenticated;
grant execute on function public.return_asset(uuid) to authenticated;

alter table public.assets enable row level security;
alter table public.asset_assignments enable row level security;

create policy assets_select on public.assets for select to authenticated
  using (public.has_permission('assets.view'));
create policy assets_write on public.assets for all to authenticated
  using (public.has_permission('assets.manage')) with check (public.has_permission('assets.manage'));

create policy asset_assign_select on public.asset_assignments for select to authenticated
  using (assignee_id = auth.uid() or public.has_permission('assets.view'));
-- Assignment rows are written only through the RPCs (SECURITY DEFINER).
