# Database Design

The database is the system of record. Everything is reproducible from
`supabase/migrations/*.sql` (ordered, idempotent) + `supabase/seed.sql`. A single
`supabase db reset` rebuilds the entire schema and reference data from scratch.

## Conventions

- **RLS default-deny.** Every table in `public` enables Row Level Security and
  adds explicit policies. No permissive policy ⇒ no access (except service-role,
  which bypasses RLS and is used only by Edge Functions / seed scripts).
- **Timestamps.** Tables carry `created_at timestamptz default now()` and, where
  mutable, `updated_at` maintained by the `public.set_updated_at()` trigger.
- **Keys.** UUID primary keys via `gen_random_uuid()` (pgcrypto).
- **Audit.** Sensitive mutations write to an append-only audit log (from Phase 1):
  actor, action, entity, before/after, timestamp.
- **Types.** `src/types/database.types.ts` is regenerated each phase via
  `supabase gen types typescript --local`.

## Current schema (Phase 0)

No domain tables yet. Foundation objects:

| Object | Type | Purpose |
| --- | --- | --- |
| `public.health_check()` | function | Returns `'ok'`; connectivity probe. Granted to `anon`, `authenticated`. |
| `public.set_updated_at()` | trigger fn | Sets `updated_at = now()` on UPDATE. |
| `storage.buckets` rows | data | Private buckets `selfies`, `documents`, `screenshots`. |

## Planned entities (by phase)

- **Phase 1** — `profiles`, `roles`, `permissions`, `role_permissions`,
  `user_roles`, `companies`, `departments`, `teams`, `audit_log`.
- **Phase 2** — `attendance_punches`, `attendance_days`, `attendance_config`.
- **Phase 3** — `tasks`, `task_status_history`, `task_statuses`.
- **Phase 4** — `planning_slots`, `planning_updates`, `planning_config`,
  `planning_compliance`.
- **Phase 5** — `leave_types`, `leave_requests`, `leave_balances`, `holidays`.
- **Phase 6** — `salary_components`, `salary_runs`, `payslips`.
- **Phase 7** — `appraisal_cycles`, `appraisals`.
- **Phases 9+** — employee lifecycle, plus the Extended-module entities.

An ER diagram will be added once the relational core (Phases 1–7) lands.
