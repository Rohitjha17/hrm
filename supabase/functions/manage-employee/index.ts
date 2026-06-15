// Edge Function: provision and remove employees (auth users + profiles).
// Creating/deleting auth users needs the Admin API, which must run server-side.
// Verifies the caller holds `users.manage`.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''

    const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
    const { data: allowed } = await caller.rpc('has_permission', { perm: 'users.manage' })
    if (!allowed) return json({ error: 'forbidden: users.manage required' }, 403)

    const admin = createClient(url, service)
    const body = await req.json()

    if (body.action === 'create') {
      const { email, password, fullName, employeeCode, departmentId, teamId, managerId, roleIds } = body
      if (!email || !password) return json({ error: 'email and password are required' }, 400)

      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (cErr) return json({ error: cErr.message }, 400)
      const userId = created.user.id

      const { error: pErr } = await admin.from('profiles').insert({
        id: userId,
        email,
        full_name: fullName ?? '',
        employee_code: employeeCode || null,
        department_id: departmentId || null,
        team_id: teamId || null,
        reporting_manager_id: managerId || null,
        status: 'active',
      })
      if (pErr) {
        // Roll back the auth user so we don't leave an orphan.
        await admin.auth.admin.deleteUser(userId)
        return json({ error: pErr.message }, 400)
      }

      if (Array.isArray(roleIds) && roleIds.length > 0) {
        const { error: rErr } = await admin
          .from('user_roles')
          .insert(roleIds.map((rid: string) => ({ user_id: userId, role_id: rid })))
        if (rErr) return json({ error: rErr.message }, 400)
      }

      return json({ ok: true, userId })
    }

    if (body.action === 'delete') {
      if (!body.userId) return json({ error: 'userId required' }, 400)
      const { error } = await admin.auth.admin.deleteUser(body.userId)
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true })
    }

    return json({ error: 'unknown action' }, 400)
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
