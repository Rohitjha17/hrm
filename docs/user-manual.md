# User Manual

Grows each phase. This Phase 0 version covers sign-in and the core concepts;
module-specific sections (attendance, tasks, planning, leave, salary, appraisal,
reports) are added as those phases land.

## Roles (overview)

- **Super Admin** (e.g. Sunil, Riya) — full access; can toggle between an
  **Employee View** and an **Admin View** (Phase 1).
- **HR / Manager / Team Leader** — scoped admin capabilities (Phase 1+).
- **Employee / Intern** (e.g. Aarti, Raj) — self-service: punch in/out, tasks,
  planning, leave; cannot see others' salary or admin areas.

Roles are **permission-based and unlimited** — create new ones in the UI without
code changes (Phase 1).

## Signing in

1. Go to the app URL (HTTPS).
2. Enter the email + password your admin shared with you out-of-band.
3. The page never displays anyone's credentials. Forgot your password? Use
   **Forgot password?** to receive a reset email.

## How credentials are shared

Admins provision accounts; the system **never shows passwords in the UI**. For
the seed/demo users, credentials are printed **only to the developer console** by
`npm run seed`. In production, an admin sets/resets passwords and shares them
through a secure channel.

## How data syncs across devices

All data lives in one central Postgres database. When you punch in on your phone,
an admin watching the dashboard on a laptop sees it **in real time** — no refresh
(Phase 2). The same is true for tasks, planning, and leave updates.

## Adding people & configuration (no code)

From Phase 1, admins add employees, roles, departments, teams, holidays, task
statuses, and policy/planning settings entirely through the UI.

## Backups

The database is the source of truth. On Supabase, enable scheduled backups
(Pro) or periodically export via `supabase db dump`. Document your cadence.
