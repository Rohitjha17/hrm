import { execSync } from 'node:child_process'

/**
 * Reset the local Supabase DB to a known baseline before the e2e suite:
 *   1. `supabase db reset` — rebuilds schema from migrations + runs seed.sql
 *      (reference/config data).
 *   2. `node scripts/seed.mjs` — provisions the named auth users via the Admin
 *      API (added in Phase 1). Skipped automatically if the script is a no-op.
 *
 * Set SKIP_DB_RESET=1 to iterate quickly against existing state.
 */
export default async function globalSetup() {
  if (process.env.SKIP_DB_RESET === '1') {
    console.log('[e2e] SKIP_DB_RESET=1 — using existing DB state.')
    return
  }

  console.log('[e2e] Resetting local Supabase DB (schema + seed)…')
  execSync('supabase db reset', { stdio: 'inherit' })

  console.log('[e2e] Seeding auth users…')
  execSync('node scripts/seed.mjs', { stdio: 'inherit' })
}
