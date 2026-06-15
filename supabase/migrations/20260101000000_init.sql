-- ============================================================================
-- Phase 0 — Foundation
-- Extensions, shared trigger helpers, health-check probe, private storage
-- buckets, and the default-deny RLS posture for the public schema.
--
-- Convention (enforced per-table in every later migration):
--   * Every table created in `public` MUST `enable row level security`.
--   * No permissive policy is added unless access is explicitly intended.
--   * Anon/authenticated get access ONLY through deliberate policies/grants.
-- ============================================================================

-- Extensions -----------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- Shared trigger helper: keep an `updated_at` column current on UPDATE. -------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Health check ---------------------------------------------------------------
-- Lightweight connectivity probe used by the app shell and the e2e smoke test
-- to confirm the centralized DB is reachable through the anon client.
create or replace function public.health_check()
returns text
language sql
stable
as $$
  select 'ok'::text;
$$;

grant execute on function public.health_check() to anon, authenticated;

-- Private storage buckets ----------------------------------------------------
-- All buckets are PRIVATE. Object-level access is granted through explicit
-- storage RLS policies added in the phases that use them (selfies → Phase 2,
-- documents → Phases 11+, screenshots → Phase 19).
insert into storage.buckets (id, name, public)
values
  ('selfies', 'selfies', false),
  ('documents', 'documents', false),
  ('screenshots', 'screenshots', false)
on conflict (id) do nothing;
