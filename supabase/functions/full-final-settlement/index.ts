// Edge Function: Full & Final settlement on exit.
// net = final salary (last month CTC) + paid-leave encashment − outstanding dues.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

const round2 = (n: number) => Math.round(n * 100) / 100

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''

    const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
    const { data: allowed } = await caller.rpc('has_permission', { perm: 'salary.manage' })
    if (!allowed) return json({ error: 'forbidden: salary.manage required' }, 403)

    const { userId, lastWorkingDate } = await req.json()
    if (!userId || !lastWorkingDate) return json({ error: 'userId and lastWorkingDate required' }, 400)

    const admin = createClient(url, service)
    const year = new Date(lastWorkingDate).getUTCFullYear()

    const [policyRes, profileRes, balRes, loanRes, callerUser] = await Promise.all([
      admin.from('salary_policy').select('working_days_per_month').eq('id', true).single(),
      admin.from('salary_profiles').select('monthly_ctc').eq('user_id', userId).maybeSingle(),
      admin.from('leave_balances').select('allocated,used,leave_types(is_paid)').eq('user_id', userId).eq('year', year),
      admin.from('loans_advances').select('outstanding').eq('user_id', userId),
      caller.auth.getUser(),
    ])

    const wdpm = Number(policyRes.data?.working_days_per_month ?? 26)
    const ctc = Number(profileRes.data?.monthly_ctc ?? 0)
    const perDay = wdpm > 0 ? ctc / wdpm : 0

    const remainingPaid = (balRes.data ?? [])
      // deno-lint-ignore no-explicit-any
      .filter((b: any) => b.leave_types?.is_paid)
      .reduce((s: number, b: { allocated: number; used: number }) => s + (Number(b.allocated) - Number(b.used)), 0)
    const leaveEncashment = round2(remainingPaid * perDay)
    const dues = round2((loanRes.data ?? []).reduce((s: number, l: { outstanding: number }) => s + Number(l.outstanding), 0))
    const finalSalary = round2(ctc)
    const netPayable = round2(finalSalary + leaveEncashment - dues)

    const { data: saved, error } = await admin
      .from('fnf_settlements')
      .upsert(
        {
          user_id: userId,
          last_working_date: lastWorkingDate,
          final_salary: finalSalary,
          leave_encashment: leaveEncashment,
          dues,
          net_payable: netPayable,
          breakdown: { perDay: round2(perDay), remainingPaidDays: remainingPaid },
          computed_by: callerUser.data.user?.id ?? null,
        },
        { onConflict: 'user_id' },
      )
      .select()
      .single()
    if (error) return json({ error: error.message }, 400)

    return json({ ok: true, settlement: saved })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
