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

**Leave (Phase 5)**

```
leave_types (Paid/Casual/Sick/Unpaid)   holidays (master)
leave_requests >── user_id ─> profiles   leave_balances (user/type/year):
  type, start/end, days (trigger),          allocated, used
  status (pending|approved|rejected|cancelled), decided_by
```

- `decide_leave()` (SECURITY DEFINER) approves/rejects (approver or reporting
  manager) and updates the balance. RLS: requests visible to owner / reports /
  `leave.view_all`. Realtime on `leave_requests`.

**Salary (Phase 6)**

```
salary_policy (singleton)        salary_profiles (user → monthly_ctc)
  working_days_per_month,        salary_adjustments (user/month, kind:
  half/quarter factors,            incentive|penalty|increment, amount)
  late/overtime/planning rates   salary_runs (user/month): counts + gross/net
                                   + breakdown jsonb (written by Edge Function)
```

- Computed by the `calculate-salary` Edge Function (service role). RLS: salary is
  visible only with `salary.view` (all) or `salary.view_own` (self) — the latter
  is **removed from Employee/Intern by default**, so salary is hidden unless an
  admin grants it.

**Appraisal (Phase 7)**

```
appraisal_cycles (monthly|quarterly|half_yearly|annual, period)
appraisals >── cycle_id, user_id ─> profiles
  attendance/task/planning/overall scores, performance_rating,
  manager/hr feedback, increment_recommendation, promotion_recommended
```

- `compute_appraisal_scores()` (SECURITY DEFINER) scores from attendance/task/
  planning data in the cycle period and derives recommendations.

## Extended modules (Phases 10–19)

All RLS-enabled (default-deny) with their own permission keys; mutations that need
atomicity or the Admin API go through SECURITY DEFINER RPCs / Edge Functions.

| Phase | Tables |
| --- | --- |
| 10 Policies & workflow | `policies`, `policy_versions`, `policy_acknowledgements`, `workflow_definitions`, `workflow_steps`, `workflow_instances`, `workflow_actions` |
| 11 Recruitment | `job_openings`, `candidates`, `interviews` (offer approval via the workflow engine) |
| 12 Onboarding | `onboarding_templates`, `onboarding`, `onboarding_items` |
| 13 Documents | `employee_documents` (auto-versioned, in the private `documents` bucket) |
| 14 Assets | `assets`, `asset_assignments` |
| 15 Payroll | `salary_policy` (+PF/ESIC/PT/TDS), `salary_runs` (+statutory), `loans_advances`, `fnf_settlements` |
| 16 Lifecycle | `lifecycle_events`, `resignations`, `exit_clearances` |
| 17 Helpdesk | `tickets`, `ticket_updates` |
| 18 Engagement | `announcements`, `recognitions`, `visitors` |
| 19 Monitoring | `monitoring_config`, `screenshots` (private `screenshots` bucket) |

## Notes

- **AI analytics** is deferred (Future Version) — no tables; a `src/services/ai`
  boundary exists for later, behind a feature flag.
- The full schema rebuilds from `supabase/migrations/*` + `seed.sql` via a single
  `supabase db reset`; named users come from `scripts/seed.mjs`.
