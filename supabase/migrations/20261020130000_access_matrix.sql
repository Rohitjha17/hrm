-- Requirements 79–82: configurable module actions and role/user field access.
insert into public.permissions (key, description, category)
select module || '.' || action,
       initcap(action) || ' ' || initcap(replace(module, '_', ' ')),
       module
from unnest(array[
  'attendance','tasks','planning','leave','salary','appraisal','reports','documents','helpdesk',
  'recruitment','policy','workflow','onboarding','lifecycle','training','visitors','announcements',
  'recognition','assets','monitoring','users','roles','hierarchy','holidays'
]) module,
     unnest(array['view','add','edit','delete']) action
on conflict (key) do nothing;

create table if not exists public.role_field_access (
  role_id uuid not null references public.roles(id) on delete cascade,
  module text not null,
  field_key text not null,
  is_visible boolean not null default true,
  primary key (role_id, module, field_key)
);
create table if not exists public.user_field_access (
  user_id uuid not null references public.profiles(id) on delete cascade,
  module text not null,
  field_key text not null,
  is_visible boolean not null default true,
  primary key (user_id, module, field_key)
);
alter table public.role_field_access enable row level security;
alter table public.user_field_access enable row level security;
create policy role_field_select on public.role_field_access for select to authenticated using (true);
create policy role_field_write on public.role_field_access for all to authenticated
  using (public.has_permission('roles.manage')) with check (public.has_permission('roles.manage'));
create policy user_field_select on public.user_field_access for select to authenticated
  using (user_id = auth.uid() or public.has_permission('users.manage'));
create policy user_field_write on public.user_field_access for all to authenticated
  using (public.has_permission('users.manage')) with check (public.has_permission('users.manage'));

create or replace function public.my_allowed_fields(p_module text)
returns table(field_key text, is_visible boolean)
language sql stable security definer set search_path = public as $$
  with user_rules as (
    select ufa.field_key, ufa.is_visible from public.user_field_access ufa
    where ufa.user_id = auth.uid() and ufa.module = p_module
  ), role_rules as (
    select rfa.field_key, bool_or(rfa.is_visible) as is_visible
    from public.role_field_access rfa join public.user_roles ur on ur.role_id = rfa.role_id
    where ur.user_id = auth.uid() and rfa.module = p_module
      and not exists (select 1 from user_rules u where u.field_key = rfa.field_key)
    group by rfa.field_key
  )
  select * from user_rules union all select * from role_rules;
$$;
grant execute on function public.my_allowed_fields(text) to authenticated;

