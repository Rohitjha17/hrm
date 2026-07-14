// Edge Function: provision and remove employees (auth users + profiles).
// Creating/deleting auth users needs the Admin API, which must run server-side.
// Verifies the caller holds `users.manage`.
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

interface LeaveQuota {
  leaveTypeId: string
  allocated: number
}

/**
 * Reconcile a user's current-year leave allocations to `quotas`, preserving
 * whatever `used` has already accumulated on existing rows.
 */
async function setLeaveQuotas(admin: SupabaseClient, userId: string, quotas: LeaveQuota[]) {
  const year = new Date().getFullYear()
  const { data: existing, error: exErr } = await admin
    .from('leave_balances')
    .select('id, leave_type_id')
    .eq('user_id', userId)
    .eq('year', year)
  if (exErr) return exErr.message
  const byType = new Map((existing ?? []).map((b) => [b.leave_type_id, b.id]))

  for (const q of quotas) {
    const allocated = Number(q.allocated)
    if (!q.leaveTypeId || !Number.isFinite(allocated) || allocated < 0) {
      return 'each quota needs a leaveTypeId and a non-negative allocated number'
    }
    const rowId = byType.get(q.leaveTypeId)
    const { error } = rowId
      ? await admin.from('leave_balances').update({ allocated }).eq('id', rowId)
      : await admin
          .from('leave_balances')
          .insert({ user_id: userId, leave_type_id: q.leaveTypeId, year, allocated, used: 0 })
    if (error) return error.message
  }
  return null
}

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

      if (Array.isArray(body.leaveQuotas) && body.leaveQuotas.length > 0) {
        const qErr = await setLeaveQuotas(admin, userId, body.leaveQuotas)
        if (qErr) return json({ error: qErr }, 400)
      }

      return json({ ok: true, userId })
    }

    if (body.action === 'set-leave-quotas') {
      const { userId, quotas } = body
      if (!userId) return json({ error: 'userId required' }, 400)
      if (!Array.isArray(quotas)) return json({ error: 'quotas array required' }, 400)
      const qErr = await setLeaveQuotas(admin, userId, quotas)
      if (qErr) return json({ error: qErr }, 400)
      return json({ ok: true })
    }

    if (body.action === 'update-credentials') {
      const { userId, email, password } = body
      if (!userId) return json({ error: 'userId required' }, 400)
      if (!email && !password) return json({ error: 'nothing to update' }, 400)

      const patch: { email?: string; password?: string; email_confirm?: boolean } = {}
      if (email) {
        patch.email = email
        patch.email_confirm = true
      }
      if (password) patch.password = password
      const { error: uErr } = await admin.auth.admin.updateUserById(userId, patch)
      if (uErr) return json({ error: uErr.message }, 400)

      if (email) {
        const { error: pErr } = await admin.from('profiles').update({ email }).eq('id', userId)
        if (pErr) return json({ error: pErr.message }, 400)
      }
      return json({ ok: true })
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
