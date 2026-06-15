# Deployment Guide

Target: **Supabase** (data/auth/storage/realtime/functions) + **Vercel**
(frontend), both free tier, HTTPS by default.

## 1. Provision Supabase (cloud)

1. Create a project at <https://supabase.com> → note **Project Ref**, **anon
   key**, **service-role key** (Settings → API).
2. Link and push the schema from this repo:
   ```bash
   supabase link --project-ref <your-ref>
   supabase db push           # applies supabase/migrations/* to cloud
   ```
3. Seed reference data + users against the cloud project:
   ```bash
   # reference/config data
   supabase db execute --file supabase/seed.sql   # or run via SQL editor
   # named users (uses service-role key)
   SUPABASE_URL=<cloud-url> SUPABASE_SERVICE_ROLE_KEY=<cloud-service-key> npm run seed
   ```
4. **Storage:** buckets are created by the migration. Confirm they are private.
5. **Auth:** Settings → URL Configuration → add your Vercel domain to *Site URL*
   and *Redirect URLs* (for password reset / email links).

## 2. Deploy Edge Functions (from Phase 6)

```bash
supabase functions deploy <name>
# set function secrets (never the service-role key in the client):
supabase secrets set SOME_KEY=...
```

## 3. Deploy the frontend (Vercel)

1. Import the repo at <https://vercel.com/new>.
2. Framework preset: **Vite** (auto-detected via `vercel.json`).
3. Environment variables (Project → Settings → Environment Variables):
   - `VITE_SUPABASE_URL` = your cloud API URL
   - `VITE_SUPABASE_ANON_KEY` = your cloud anon key
   - (Do **not** set the service-role key here — it must never reach the browser.)
4. Deploy. Vercel serves over HTTPS, satisfying the secure-context requirement
   for Geolocation + camera.

## 4. Post-deploy checks

- Open the site → "Backend: connected" badge is green.
- Log in as a seeded admin; confirm RBAC and realtime work across two devices.
- Re-run the e2e suite against a dedicated **test** project (never production).

## CI (optional)

Run `npm ci`, `supabase start`, `npm run db:reset`, `npm run build`,
`npm run test:e2e` in CI. Use a disposable local stack or a dedicated test
Supabase project — never production data.
