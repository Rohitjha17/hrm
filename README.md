# HRMS — Attendance · Tasks · Planning · Leave · Salary · Appraisal

A production-oriented, multi-user **Human Resource Management System** built on a
**centralized Postgres database** so employees on any device share one source of
truth, with **real-time** visibility for admins. Deployable end-to-end on free
hosting tiers.

> Status: **Phase 8 complete** — core + reports/export. (RBAC, attendance, tasks,
> planning, leave, salary, appraisal, reports.) See [the roadmap](#roadmap) and
> [`CHANGELOG.md`](./CHANGELOG.md).

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | React 19 + Vite + TypeScript (strict), Tailwind CSS v4, React Router, TanStack Query, React Hook Form, Zod |
| Backend | **Supabase** — Postgres, Auth (JWT, hashed passwords), Storage (private), Realtime, Row Level Security, Edge Functions (Deno) |
| Exports | SheetJS (`xlsx`) + `pdfmake`/`jspdf`, generated **client-side** (Phase 8) |
| Tests | Playwright (real-user e2e) + Vitest (unit) + `@axe-core/playwright` (a11y) |
| Hosting | Vercel (frontend) + Supabase (data) — both free tier |

**Why this stack:** genuinely free end-to-end, HTTPS by default (required for the
GPS + camera punch-in), a real centralized SQL database, realtime sync and RBAC
enforced **at the data layer** (RLS) — not just the UI.

## Repository structure

```
hrm/
├── src/
│   ├── components/        # ui/ primitives + layout/ app shell
│   ├── features/          # feature-scoped modules (auth, health, …)
│   ├── pages/             # routed pages
│   ├── providers/         # app-wide context providers
│   ├── routes/            # route guards
│   ├── lib/               # supabase client, env, query client, helpers
│   ├── types/             # database.types.ts (generated per phase)
│   └── test/              # vitest setup
├── supabase/
│   ├── migrations/        # ordered, idempotent SQL — rebuilds everything
│   ├── functions/         # Edge Functions (Deno) — added from Phase 6
│   ├── seed.sql           # reference/config data (runs on db reset)
│   └── config.toml        # local stack config
├── scripts/               # setup-local-env.mjs, seed.mjs
├── e2e/                   # Playwright: pages/ (POMs), utils/, *.spec.ts
└── docs/                  # database, api, deploy, hosting, user-manual
```

## Prerequisites

- Node ≥ 20 (tested on 22/25)
- Docker (running) — for the local Supabase stack
- [Supabase CLI](https://supabase.com/docs/guides/cli) ≥ 2.x

## Quickstart (local)

```bash
npm install                # install deps
supabase start             # boot local Postgres/Auth/Storage/Realtime (Docker)
npm run env:local          # write .env.local from `supabase status`
npm run db:reset           # apply migrations + seed reference data
npm run seed               # provision named auth users (prints creds to console)
npm run dev                # http://localhost:5173
```

Full step-by-step (including cloud provisioning) is in [`SETUP.md`](./SETUP.md).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` / `build` / `preview` | Vite dev / production build / preview |
| `npm run typecheck` / `lint` / `format` | TS project build / ESLint / Prettier |
| `npm run test:unit` | Vitest unit tests |
| `npm run test:e2e` | Playwright e2e (resets DB, boots app, runs suite) |
| `npm run db:start` / `db:stop` / `db:reset` / `db:status` | Local Supabase control |
| `npm run env:local` | Regenerate `.env.local` from local Supabase |
| `npm run seed` | Provision named auth users via Admin API |

## Testing

E2E tests drive the **real UI** against a **real local database**, serially
(`workers: 1`) for deterministic shared state. `e2e/global-setup.ts` resets the
DB before each run. Chromium launches with fake-media flags so the live selfie
capture (Phase 2) runs unattended. The suite **grows each phase** and must be
100% green before that phase is committed.

```bash
npm run test:e2e            # headless
npm run test:e2e:headed     # watch it drive the browser
SKIP_DB_RESET=1 npm run test:e2e   # fast iteration on unchanged schema
```

## Roadmap

Core (Phases 0–9): foundation → auth/RBAC → attendance (GPS+selfie+realtime) →
tasks → planning+mandatory policy → leave → salary → appraisal → reports/export →
employee CRUD. Then Extended modules (Phases 10–19). Each phase ships only when
the full regression suite is green and is captured in one conventional commit.

## Security posture

- **No credentials in the UI, ever.** Provisioned out-of-band; printed only to
  the developer console by the seed script. Passwords hashed by Supabase Auth.
- **RBAC at the data layer.** Every table has RLS enabled, default-deny.
- **Secrets:** only the RLS-gated anon key reaches the browser. The service-role
  key lives in Edge Functions / scripts. See [`.env.example`](./.env.example).
- **HTTPS** everywhere in production (Vercel + Supabase) — required for GPS/camera.

## Assumptions & deviations

- **Local Supabase ports are remapped to `5442x`** (API 54421, DB 54422, Studio
  54423, Mailpit 54424) to coexist with a pre-existing local Supabase project on
  the dev machine. Revert in `supabase/config.toml` if not needed. The app reads
  ports dynamically via `npm run env:local`, so nothing else changes.
- **Zod 4** + `@hookform/resolvers` v5 (current as of build).
- **SheetJS (`xlsx`) is installed from the SheetJS CDN tarball** (patched
  `0.20.3`), not npm — the npm build (`0.18.5`) has unpatched advisories. A fresh
  `npm install` fetches it from `cdn.sheetjs.com`; `npm audit` is clean.
- Cloud deployment is **documented** in [`docs/deploy.md`](./docs/deploy.md) but
  must be executed with your own Supabase/Vercel accounts (no creds in repo).
