# SETUP — Installation Guide

Two paths: **local development** (free, runs entirely on your machine via Docker)
and **cloud** (free tiers of Supabase + Vercel). Local is enough to build, run,
and test the whole system.

---

## A. Local development

### 1. Prerequisites

- **Node ≥ 20** — `node -v`
- **Docker Desktop / Colima**, running — `docker info`
- **Supabase CLI ≥ 2** — `supabase --version` (install: `brew install supabase/tap/supabase`)

### 2. Install dependencies

```bash
npm install
npx playwright install chromium    # one-time, for e2e
```

### 3. Start the local backend

```bash
supabase start
```

This boots Postgres, Auth, Storage, Realtime, and Studio in Docker. First run
downloads images (a few minutes).

> **Port note:** this project uses non-default ports (`API 54421`, `DB 54422`,
> `Studio 54423`, `Mailpit 54424`) so it can coexist with another local Supabase
> project. Studio: <http://127.0.0.1:54423>. Change them in
> `supabase/config.toml` if you prefer the defaults.

### 4. Generate the local env file

```bash
npm run env:local
```

Writes `.env.local` (gitignored) with the local API URL + keys read from
`supabase status`. These are the well-known local demo keys — safe locally.

### 5. Build the schema + seed data

```bash
npm run db:reset     # applies supabase/migrations/* and runs seed.sql
npm run seed         # creates the named auth users via the Admin API
```

`npm run seed` prints each user's email + temporary password **to your console
only** — they are never stored in the app or shown in the UI. Share them with
employees out-of-band (Phase 1+).

### 6. Run the app

```bash
npm run dev          # http://localhost:5173
```

### 7. Run the tests

```bash
npm run test:e2e     # full regression suite (resets DB first)
npm run test:unit    # unit tests
```

---

## B. Cloud (free tiers)

Detailed in [`docs/deploy.md`](./docs/deploy.md). Summary:

1. **Create a Supabase project** at <https://supabase.com> (free). Note the
   project ref, anon key, and service-role key.
2. **Push the schema:**
   ```bash
   supabase link --project-ref <your-ref>
   supabase db push        # applies migrations to the cloud DB
   ```
   Seed reference data and users against the cloud project (see deploy doc).
3. **Create a Vercel project** at <https://vercel.com> (free), import this repo.
   Set env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to your cloud
   project's values. Vercel builds with `npm run build` and serves over HTTPS.
4. **Configure Auth redirect URLs** in Supabase to your Vercel domain.

Free-tier limits and caveats: [`docs/hosting.md`](./docs/hosting.md).

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `supabase start` fails on a port | Another stack holds it — change ports in `config.toml` or `supabase stop` the other project. |
| `vector`/analytics container won't start (Colima) | Already disabled (`[analytics] enabled = false`). |
| App shows "Backend: offline" | Run `supabase start`, then `npm run env:local`, then restart `npm run dev`. |
| e2e can't find the DB | Ensure `supabase start` ran; the suite resets but does not start the stack. |
| Edge Function returns 404 ("Function not found") | The edge runtime loads functions at `supabase start`. If you add a function afterwards, run `supabase stop && supabase start` (the DB volume persists). A fresh clone is fine — the function already exists at start. |
