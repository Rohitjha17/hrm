# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); one section per build phase.

## [1.8.0] — Phase 17: Helpdesk / ticketing

### Added
- Schema: `tickets` (IT/HR/Salary/Leave/Asset, priority, status, **SLA due**,
  escalation) + `ticket_updates`. SLA due date set by priority via trigger;
  SLA-breach computed (overdue & unresolved).
- Frontend: Helpdesk page — raise tickets (anyone), agent status updates +
  escalation, SLA-breach flag. New perm `helpdesk.manage` (HR); RLS scopes
  visibility to raiser/assignee/manager.
- E2E (1 spec): raise → update → escalate; SLA breach flagged.

## [1.7.0] — Phase 16: Employee lifecycle & exit management

### Added
- Schema: `lifecycle_events` (joining/confirmation/promotion/transfer/dept-change/
  salary-revision/exit, audited) + employee **timeline**; `resignations` and
  `exit_clearances`. `start_exit()` and `clear_exit_item()` RPCs.
- Frontend: Lifecycle page — record events + timeline; start exit → clearance
  checklist → generate Experience / Relieving / No-Due documents (PDF).
- New perms `lifecycle.view_own` (employee), `lifecycle.manage` (HR). RLS throughout.
- E2E (1 spec): record event + timeline; full exit clearance (4 items) + document.

## [1.6.0] — Phase 15: Payroll enhancements

### Added
- Statutory components on the salary policy + runs: **PF, ESIC, Professional Tax,
  TDS** (all default 0 → existing salary results unchanged). `calculate-salary`
  extended to deduct them; payslip breakdown + **Salary Slip PDF**.
- `loans_advances` + `fnf_settlements`; **`full-final-settlement` Edge Function**
  (final salary + paid-leave encashment − outstanding dues).
- Frontend: payslip download + Full & Final settlement section (compute + letter).
- E2E (1 spec): statutory payslip (net 20,080), payslip PDF, F&F (net 45,000) + letter.

### Fixed
- Phase 6 salary spec now sets the full policy (statutory = 0) — specs run
  lexicographically, so it must own its shared-singleton state.

## [1.5.0] — Phase 14: Asset management

### Added
- Schema: `assets` (laptop/desktop/mobile/SIM/ID-card/headset) + `asset_assignments`
  history. `assign_asset()`, `transfer_asset()`, `return_asset()` RPCs keep asset
  status + assignment history consistent.
- Frontend: Assets page (create, assign/transfer/return, full assignment history).
  New perms `assets.view` / `assets.manage` (HR + Super Admin).
- E2E (1 spec): assign → transfer → return with history preserved.

## [1.4.0] — Phase 13: Employee document management

### Added
- Schema: `employee_documents` (categorized, **auto-versioned** per
  employee+type) in the private `documents` bucket; storage policies scope file
  access (own folder, or `documents.view`/`documents.manage`).
- New perms `documents.view_own` (Employee/Intern), `documents.view` +
  `documents.manage` (HR + Super Admin). RLS: self-with-view-own / view / manage.
- Frontend: Documents page (upload + categorize + version list + signed-URL
  download).
- E2E (1 spec): upload → categorize → re-upload (v2) → data-layer access control
  (employee cannot see others' documents).

## [1.3.0] — Phase 12: Onboarding

### Added
- Schema: `onboarding_templates` (designation-based document templates),
  `onboarding` + `onboarding_items` (per-employee joining checklist).
  `start_onboarding()` RPC seeds the default checklist (Aadhaar, PAN, bank,
  education, previous-company, emergency, photograph).
- Frontend: Onboarding page — manage templates, generate documents from
  templates (placeholder substitution → PDF), run the joining checklist.
- New perm `onboarding.manage` (HR + Super Admin). RLS throughout.
- E2E (1 spec): create template → start checklist (7 items) → progress item →
  generate document (PDF).

## [1.2.0] — Phase 11: Recruitment & hiring

### Added
- Schema: `job_openings`, `candidates` (status pipeline + offer status),
  `interviews` (schedule + feedback + rating + recommendation). Resume storage
  policies on the private `documents` bucket.
- **Offer approval routed through the Phase 10 workflow engine**: a seeded "Offer
  Approval" workflow; a trigger reflects the instance decision back onto the
  candidate's `offer_status`.
- Offer-letter PDF generation (reusable `generateLetterPdf` helper).
- Frontend: Recruitment page (openings, candidates, interview scheduling +
  feedback, send-offer, generate letter, status pipeline). New perms
  `recruitment.view` / `recruitment.manage` (HR + Super Admin).
- E2E (1 spec): opening → candidate → interview → feedback → offer approval (via
  inbox) → offer letter (PDF) → Joined.

## [1.1.0] — Phase 10: Policy management + workflow engine

### Added
- **Policies**: `policies`, `policy_versions` (version control + change history),
  `policy_acknowledgements`. `publish_policy_version()` and `acknowledge_policy()`
  RPCs. Admin policy management (create, publish versions, history) + employee
  read/acknowledge page.
- **Configurable workflow engine**: `workflow_definitions`/`steps`/`instances`/
  `actions` with `start_workflow()` and `act_on_workflow()` RPCs (multi-level,
  per-step permission-gated). Workflow Builder + Approvals inbox.
- New permissions `policy.manage`, `workflow.manage` (granted to HR; Super Admin
  via `*`). RLS throughout.
- E2E (2 specs): policy create → 2 versions (history) → employee acknowledges;
  build a 2-level workflow → route an instance through both levels → approved.

### Note
- The engine is generic and ready to back core flows; existing leave/salary/task/
  appraisal flows are left intact (no regressions) and can be migrated onto it
  incrementally. Recruitment (Phase 11) will use it for offer approvals.

## [1.0.0] — Phase 9: Employee management & lifecycle (Core complete) 🎉

### Added
- **Edge Function `manage-employee`** (Deno): create/delete employees (auth user +
  profile + roles) via the Admin API; gated by `users.manage`. Rolls back the auth
  user if the profile insert fails.
- Employees page: **Add employee** (email, temp password, code, dept/team/manager,
  roles), **Delete** (with confirm), plus the existing edit (assign + activate/
  deactivate). Adding people requires **no code changes**.
- E2E (2 specs): full lifecycle add → assign → deactivate → reactivate → delete
  through the UI; and a newly-provisioned employee can sign in.

### Milestone
- **Core (Phases 0–9) complete** — tagged `v1.0-core`. 36 e2e specs green.

## [0.9.0] — Phase 8: Reports & export

### Added
- Reports module (Attendance, Leave, Salary, Task, Performance/Appraisal) with
  headings derived from the data; all RLS-gated (`reports.view`).
- **Client-side export**: Excel via SheetJS and PDF via jsPDF + autotable.
- Frontend: Reports page with report tabs, table view, and Excel/PDF export.
- E2E (1 spec): reports render with data and every report exports to a non-empty
  `.xlsx` and `.pdf` (download asserted).

### Security
- Use the **patched SheetJS build** (`xlsx@0.20.3` from the SheetJS CDN); the npm
  `xlsx@0.18.5` has unpatched advisories. `npm audit` is clean.

## [0.8.0] — Phase 7: Appraisal management

### Added
- Schema: `appraisal_cycles` (monthly/quarterly/half-yearly/annual) and
  `appraisals` (scores, performance rating, manager/HR feedback, recommendations).
- `compute_appraisal_scores()` RPC (SECURITY DEFINER, `appraisal.manage`): scores
  **attendance** (weighted days), **tasks** (completed/total in period) and
  **planning** (compliant/working days) from real data; derives an overall score,
  an **increment recommendation** (tiered) and a **promotion recommendation**.
- Frontend: admin Appraisals page (cycles, add appraisal, set rating/feedback,
  compute, cycle report with recommendations); employee self appraisal view.
- E2E (2 specs): create cycle + appraisal → compute (att 90 / task 75 / plan 50
  → overall 71.7, +5% increment) and employee self-view.

## [0.7.0] — Phase 6: Salary management

### Added
- **Edge Function `calculate-salary`** (Deno): verifies `salary.manage`, gathers
  attendance / paid leave / planning-compliance / adjustments with the service
  role, and computes a policy-driven payslip → upserts `salary_runs`.
- Schema: `salary_policy` (singleton), `salary_profiles` (CTC), `salary_adjustments`
  (incentive/penalty/increment), `salary_runs` (full breakdown).
- **Salary hidden from employees by default** (spec §6): the migration removes
  `salary.view_own` from Employee/Intern; RLS gates all salary tables; the Edge
  Function gates by permission.
- Frontend: admin Salary page (base CTC, adjustments, compute, payslip
  breakdown); employee self payslip page (requires explicit grant).
- E2E (3 specs): full policy-driven computation through the UI (gross 49,600 /
  net 48,800 from seeded inputs), and an employee blocked at the UI route, the
  data layer (RLS), and the Edge Function (403).

## [0.6.0] — Phase 5: Leave management

### Added
- Schema: `leave_types` (Paid/Casual/Sick/Unpaid seeded with quotas), `holidays`
  master (seeded), `leave_requests` (apply → approve/reject/cancel), `leave_balances`.
- `decide_leave()` RPC: approve/reject by an approver (`leave.approve`) or the
  requester's reporting manager; on approval, increments the year's balance.
  Inclusive day count via trigger.
- Frontend: employee Leave page (balances, apply, my requests, cancel pending);
  admin Approvals page (decide pending) + holiday calendar CRUD; realtime status
  + poll fallback so balances/status update without refresh.
- E2E (3 specs): apply → live approve + balance update, reject, holiday CRUD.

## [0.5.0] — Phase 4: Planning & mandatory policy

### Added
- Schema: `planning_config` (cadence, window, policy), `planning_slots`
  (per-slot task/progress/challenges/remarks), `planning_history` (edit trail),
  `planning_compliance` (day-end + next-day flags, admin unlock).
- **Mandatory-policy engine**: `attendance_punch` redefined to block Punch Out
  (or next-day Punch In) until planning is complete — configurable, with admin
  override via `unlock_planning()`. `submit_planning_compliance()` records the
  day-end update and next-day plan. Compliance feeds salary/appraisal later.
- Frontend: employee Planning page (2-hourly slots generated from config,
  edit-with-history, submit day-end / next-day, compliance status); admin
  Planning Monitor (per-employee compliance, unlock, combined plan view).
- Punch modal surfaces the `planning_incomplete` reason.
- E2E (3 specs): plan + edit history, punch-out blocked → admin unlock → allowed,
  and complete-planning → punch-out allowed. Punch tests now own their state via
  a service-role reset (deterministic across the full suite).

### Changed
- Punch RPC validates the in/out sequence before the planning gate (accurate
  rejection reasons).

## [0.4.0] — Phase 3: Task management

### Added
- Schema: editable `task_statuses` master (Pending/In Progress/On Hold/
  Completed seeded), `tasks` (self-created or assigned), `task_status_history`.
- `update_task_status()` RPC records every change with actor, from/to, remarks;
  a trigger logs the initial status on creation. Full per-task history.
- RLS: see your own (created/assigned) tasks or all (`tasks.view_all`); assign
  to others only with `tasks.assign`; status master editable with `tasks.manage`.
- Realtime task updates (+ poll fallback). Frontend Tasks page: create
  self/assigned tasks, change status with remarks, view history, manage statuses;
  assignee always visible; My/All filter.
- E2E (4 specs): self-task creation, status change + history, manager-assigns
  with live employee sync, editable status master.

### Fixed
- `Badge` now forwards HTML attributes (e.g. `data-testid`).

## [0.3.0] — Phase 2: Attendance (GPS + live selfie + realtime)

### Added
- Schema: `attendance_config` (singleton; office coords, 50 m radius, work
  window, hour thresholds, grace, IP allowlist, timezone), `attendance_punches`,
  `attendance_days` — all RLS default-deny; writes only via SECURITY DEFINER RPCs.
- `attendance_punch()` RPC: validates radius **server-side** (haversine) + punch
  sequence, records the punch, recomputes the day. Optional admin IP-allowlist.
- **Working-hours engine** (`recompute_attendance_day`): classifies full/half/
  quarter/absent from *actual hours worked* (configurable, not fixed clock),
  plus late detection and overtime.
- Live **selfie capture** (camera → canvas → private `selfies` bucket, owner-
  scoped storage RLS) linked to each punch; GPS gate with client pre-check +
  authoritative server check.
- **Realtime** admin monitor: punches stream live via Supabase Realtime
  (RLS-gated) with a polling fallback; configurable settings modal.
- Frontend: employee My Attendance (punch in/out, today status, punch list),
  admin Attendance Monitor; nav + routes.
- E2E (5 specs): hours-engine edge cases, in-radius selfie punch, out-of-radius
  rejection (client + server), and **live cross-device realtime sync**.

### Notes
- WiFi SSID validation is **not possible** from a web browser (documented); GPS
  is the primary gate with an optional IP allowlist. Background screenshots
  likewise require a native agent (Phase 19).

## [0.2.0] — Phase 1: Auth, roles, RBAC, users & hierarchy

### Added
- Schema: `companies`, `departments`, `teams`, `profiles`, `roles`,
  `permissions`, `role_permissions`, `user_roles`, `audit_log` — all with RLS
  enabled (default-deny) and explicit policies.
- Permission-based RBAC: a `*` wildcard for Super Admin and a 34-key permission
  catalog; 6 seeded system roles (Super Admin, HR, Manager, Team Leader,
  Employee, Intern). SECURITY DEFINER helpers `has_permission`, `my_permissions`,
  `my_roles` power both UI guards and RLS without policy recursion.
- Generic append-only `audit_trigger` on roles, role_permissions, user_roles,
  departments, teams, profiles.
- Seed script (`scripts/seed.mjs`) provisions Sunil, Riya (Employee + Super
  Admin) and Aarti, Raj (Employee) via the Auth Admin API; credentials printed
  to the developer console only.
- Frontend: profile/permissions context, **Super Admin dual-view toggle**
  (Admin ↔ Employee), `RequirePermission` route guard, admin pages for Roles &
  Permissions, Departments & Teams, Employees (role/team/manager/status), and an
  Audit Log viewer. Admin vs Employee dashboards.
- E2E (8 specs): per-role login, dual-view toggle, employees blocked from admin
  routes, role CRUD + permission assignment, hierarchy CRUD, role assignment, and
  **data-layer RLS cross-role isolation** asserted via a direct Supabase client.

## [0.1.0] — Phase 0: Foundation & infrastructure

### Added
- Vite + React 19 + TypeScript (strict) scaffold with Tailwind CSS v4, React
  Router, TanStack Query, React Hook Form, Zod.
- ESLint (flat config) + Prettier + Vitest + Playwright + `@axe-core/playwright`.
- Supabase local project: `supabase/migrations/20260101000000_init.sql`
  (pgcrypto, `set_updated_at()` trigger helper, `health_check()` RPC, private
  storage buckets `selfies`/`documents`/`screenshots`), default-deny RLS posture.
- App shell: auth-state plumbing (`AuthProvider`), protected routes, responsive
  layout, toast system, base UI primitives, login page (no credentials rendered),
  backend health badge.
- Env validation (`src/lib/env.ts`), typed Supabase client, generated DB types.
- Scripts: `setup-local-env.mjs`, `seed.mjs` (stub), Vercel config, `.env.example`.
- Docs: README, SETUP, database/api/deploy/hosting/user-manual.
- Playwright smoke suite: unauthenticated redirect, backend health check,
  no-credentials-rendered, invalid-login error, login a11y.

### Notes
- Local Supabase ports remapped to `5442x` to coexist with a pre-existing local
  project; analytics/vector container disabled (Colima socket-mount limitation).
