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

## Current schema

**Foundation (Phase 0)**

| Object | Type | Purpose |
| --- | --- | --- |
| `public.health_check()` | function | Returns `'ok'`; connectivity probe (anon + authenticated). |
| `public.set_updated_at()` | trigger fn | Sets `updated_at = now()` on UPDATE. |
| `storage.buckets` rows | data | Private buckets `selfies`, `documents`, `screenshots`. |

**RBAC & hierarchy (Phase 1)**

```
companies ──< departments ──< teams
                  │              │ reporting_manager_id ─┐
                  │                                       ▼
profiles >── department_id, team_id, reporting_manager_id (self-ref) ─> profiles
profiles 1──< user_roles >──1 roles 1──< role_permissions >──1 permissions
audit_log (append-only)
```

- `profiles.id` = `auth.users.id` (1:1). Status `active|inactive`.
- RBAC is permission-based. `roles`↔`permissions` via `role_permissions`;
  users get roles via `user_roles` (many-to-many → multiple roles per user).
- **RLS helpers (SECURITY DEFINER, bypass RLS to avoid recursion):**
  `has_permission(perm)`, `my_permissions() → text[]`, `my_roles() → text[]`.
  Super Admin holds the `'*'` permission ⇒ `has_permission` returns true for all.
- **Policy summary:** org chart readable by any authenticated user, mutated with
  `hierarchy.manage`; `profiles` readable for self / direct reports / `users.view`,
  mutated with `users.manage`; roles & catalog readable by all, mutated with
  `roles.manage`; `user_roles` self/`users.manage`; `audit_log` read with
  `audit.view`, written only by the audit trigger.

## Planned entities (by phase)

- **Phase 2** — `attendance_punches`, `attendance_days`, `attendance_config`.
- **Phase 3** — `tasks`, `task_status_history`, `task_statuses`.
- **Phase 4** — `planning_slots`, `planning_updates`, `planning_config`,
  `planning_compliance`.
- **Phase 5** — `leave_types`, `leave_requests`, `leave_balances`, `holidays`.
- **Phase 6** — `salary_components`, `salary_runs`, `payslips`.
- **Phase 7** — `appraisal_cycles`, `appraisals`.
- **Phases 9+** — employee lifecycle, plus the Extended-module entities.

An ER diagram will be added once the relational core (Phases 1–7) lands.
