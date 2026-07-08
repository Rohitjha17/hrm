-- ============================================================================
-- Company directory
-- Profiles RLS hides colleagues from plain employees, but hosting a meeting
-- requires picking invitees and seeing host names. Expose a minimal directory
-- (id, name, email only) to all authenticated users via SECURITY DEFINER.
-- ============================================================================

create or replace function public.directory()
returns table (id uuid, full_name text, email text)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.full_name, p.email
  from public.profiles p
  where coalesce(p.status, 'active') <> 'deleted'
  order by p.full_name;
$$;

grant execute on function public.directory() to authenticated;
