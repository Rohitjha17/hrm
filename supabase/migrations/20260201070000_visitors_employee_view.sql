-- ============================================================================
-- Visitors: employee self-service view. Previously only visitors.manage holders
-- could see/register visitors. Now an employee can see the visitors they host
-- and register their own expected visitors (host = themselves). Admin policies
-- (visitors.manage) remain and are OR'd with these, so admins keep full access.
-- ============================================================================

drop policy if exists visitors_select_own on public.visitors;
create policy visitors_select_own on public.visitors for select to authenticated
  using (host_id = auth.uid());

drop policy if exists visitors_insert_own on public.visitors;
create policy visitors_insert_own on public.visitors for insert to authenticated
  with check (host_id = auth.uid());
