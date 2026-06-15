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

**Attendance (Phase 2)**

```
attendance_config (singleton)   attendance_punches >── user_id ─> profiles
  office_lat/lng, radius_meters       punch_type in|out, punched_at, work_date
  work_start/end, grace_minutes       lat/lng, distance_meters, within_radius
  full/half/quarter_day_hours         selfie_path (→ private selfies bucket)
  overtime_after_hours, timezone
  ip_allowlist[]                 attendance_days (one per user/day, unique)
                                      worked_minutes, status, is_late,
                                      overtime_minutes, first_in/last_out
```

- Writes go ONLY through SECURITY DEFINER RPCs: `attendance_punch()` (radius +
  sequence validation, haversine) and `recompute_attendance_day()` (the
  working-hours engine). Clients have read-only RLS (own rows or
  `attendance.view_all`).
- `attendance_days` + `attendance_punches` are in the `supabase_realtime`
  publication for live admin monitoring.
- Status is derived from **worked minutes** vs configurable thresholds, not
  fixed clock times.

**Tasks (Phase 3)**

```
task_statuses (master, editable)   tasks >── created_by / assignee_id ─> profiles
  Pending/In Progress/On Hold/        title, task_type (self|assigned),
  Completed (+ custom)                status_id, priority, due_date
                                   task_status_history >── task_id ─> tasks
                                      from/to status, changed_by, remarks
```

- `update_task_status()` RPC captures actor + remarks; an insert trigger logs
  the initial status. History is read-only to clients (written by trigger/RPC).
- `tasks` + `task_status_history` are in the realtime publication.

**Planning (Phase 4)**

```
planning_config (singleton)   planning_slots >── user_id ─> profiles
  slot_interval_hours,           plan_date, kind (day|next_day), slot_index,
  day_start/end, policy          task_name, progress, challenges, remarks
  (block_punch_out |          planning_history >── slot_id (before/after edits)
   block_next_day_in | off)   planning_compliance (user/day): day_end_submitted,
  require_day_end/next_day       next_day_submitted, unlocked, unlocked_by
```

- `attendance_punch` enforces the policy: Punch Out (or next-day Punch In) is
  blocked until compliance is met; `unlock_planning()` (admin) overrides;
  `submit_planning_compliance()` sets the flags.

## Planned entities (by phase)

- **Phase 5** — `leave_types`, `leave_requests`, `leave_balances`, `holidays`.
- **Phase 6** — `salary_components`, `salary_runs`, `payslips`.
- **Phase 7** — `appraisal_cycles`, `appraisals`.
- **Phases 9+** — employee lifecycle, plus the Extended-module entities.

An ER diagram will be added once the relational core (Phases 1–7) lands.
