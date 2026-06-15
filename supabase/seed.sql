-- ============================================================================
-- Database seed — runs automatically on `supabase db reset`.
--
-- Reference / sample org structure. Named auth users (Sunil, Riya, Aarti, Raj)
-- are created separately by `npm run seed` (scripts/seed.mjs) via the Auth Admin
-- API so passwords are securely hashed — their credentials are printed only to
-- the developer's console, never stored in the app or rendered in the UI.
--
-- The permission catalog + system roles live in the migration (so RLS keys
-- always exist). This file seeds an example company / departments / teams.
-- All of it is editable later through the UI (no code changes needed).
-- ============================================================================

insert into public.companies (id, name) values
  ('00000000-0000-0000-0000-000000000001', 'HRMS Demo Company')
on conflict (id) do nothing;

insert into public.departments (id, company_id, name) values
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Engineering'),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Human Resources'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'Sales')
on conflict (id) do nothing;

insert into public.teams (id, department_id, name) values
  ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000010', 'Platform'),
  ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000011', 'HR Ops'),
  ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000012', 'Field Sales')
on conflict (id) do nothing;
