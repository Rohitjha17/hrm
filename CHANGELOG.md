# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); one section per build phase.

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
