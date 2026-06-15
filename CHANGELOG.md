# Changelog

All notable changes to this project are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); one section per build phase.

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
