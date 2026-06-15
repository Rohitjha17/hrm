// Provisions the named auth users (Sunil, Riya, Aarti, Raj), their profiles,
// role assignments and reporting lines — via the Supabase Auth Admin API
// (service role). Idempotent: re-running updates existing users.
//
// Credentials are PRINTED ONLY to this developer console — never stored in the
// app, never rendered in the UI (hard requirement #3).
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { SEED_USERS } from './seed-users.mjs'

// ── Load env (.env.local) without a dotenv dependency ──────────────────────
function loadEnv() {
  try {
    const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
    }
  } catch {
    /* fall back to ambient env */
  }
}
loadEnv()

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('❌ Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Run `npm run env:local`.')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function findUserByEmail(email) {
  // Local projects have few users; one page suffices.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw error
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null
}

async function ensureUser({ email, password }) {
  const existing = await findUserByEmail(email)
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true })
    return existing.id
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw error
  return data.user.id
}

async function main() {
  console.log('[seed] Provisioning named users…')

  const [{ data: depts }, { data: teams }, { data: roles }] = await Promise.all([
    admin.from('departments').select('id,name'),
    admin.from('teams').select('id,name'),
    admin.from('roles').select('id,slug'),
  ])
  const deptByName = new Map((depts ?? []).map((d) => [d.name, d.id]))
  const teamByName = new Map((teams ?? []).map((t) => [t.name, t.id]))
  const roleBySlug = new Map((roles ?? []).map((r) => [r.slug, r.id]))

  const idByEmail = new Map()

  for (const u of SEED_USERS) {
    const userId = await ensureUser(u)
    idByEmail.set(u.email, userId)

    const { error: pErr } = await admin.from('profiles').upsert(
      {
        id: userId,
        email: u.email,
        full_name: u.fullName,
        employee_code: u.employeeCode,
        department_id: deptByName.get(u.department) ?? null,
        team_id: teamByName.get(u.team) ?? null,
        status: 'active',
      },
      { onConflict: 'id' },
    )
    if (pErr) throw pErr

    for (const slug of u.roles) {
      const roleId = roleBySlug.get(slug)
      if (!roleId) throw new Error(`Unknown role slug: ${slug}`)
      const { error: rErr } = await admin
        .from('user_roles')
        .upsert({ user_id: userId, role_id: roleId }, { onConflict: 'user_id,role_id' })
      if (rErr) throw rErr
    }
  }

  // Reporting lines (now that all profiles exist).
  for (const u of SEED_USERS) {
    if (!u.reportsTo) continue
    const managerId = idByEmail.get(u.reportsTo)
    if (managerId) {
      await admin.from('profiles').update({ reporting_manager_id: managerId }).eq('id', idByEmail.get(u.email))
    }
  }

  // Developer-only credential printout.
  console.log('\n[seed] ✅ Done. Local demo credentials (developer console only):')
  console.table(
    SEED_USERS.map((u) => ({
      email: u.email,
      password: u.password,
      roles: u.roles.join(' + '),
    })),
  )
  console.log('[seed] These are NEVER shown in the app UI. Share with employees out-of-band.\n')
}

main().catch((err) => {
  console.error('[seed] Failed:', err.message ?? err)
  process.exit(1)
})
