// Edge Function: policy-driven monthly salary calculation.
// Server-side only — verifies the caller has `salary.manage`, gathers attendance,
// leave, planning-compliance and adjustment data with the service role, computes
// the payslip, and upserts a salary_run.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

const round2 = (n: number) => Math.round(n * 100) / 100
const sumKind = (rows: Array<{ kind: string; amount: number }>, kind: string) =>
  rows.filter((r) => r.kind === kind).reduce((s, r) => s + Number(r.amount), 0)

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''

    // 1) Authorize the caller (RLS-aware client using their JWT).
    const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
    const { data: allowed, error: permErr } = await caller.rpc('has_permission', {
      perm: 'salary.manage',
    })
    if (permErr) return json({ error: permErr.message }, 400)
    if (!allowed) return json({ error: 'forbidden: salary.manage required' }, 403)

    const { userId, month } = await req.json()
    if (!userId || !month) return json({ error: 'userId and month (YYYY-MM) required' }, 400)

    const periodStart = `${month}-01`
    const end = new Date(`${periodStart}T00:00:00Z`)
    end.setUTCMonth(end.getUTCMonth() + 1)
    const endStr = end.toISOString().slice(0, 10)

    // 2) Gather inputs with the service role (bypasses RLS deliberately).
    const admin = createClient(url, service)
    const [policyRes, profileRes, daysRes, leavesRes, complRes, adjRes, callerUser] =
      await Promise.all([
        admin.from('salary_policy').select('*').eq('id', true).single(),
        admin.from('salary_profiles').select('monthly_ctc').eq('user_id', userId).maybeSingle(),
        admin
          .from('attendance_days')
          .select('status,is_late,overtime_minutes,work_date')
          .eq('user_id', userId)
          .gte('work_date', periodStart)
          .lt('work_date', endStr),
        admin
          .from('leave_requests')
          .select('days,status,start_date,leave_types(is_paid)')
          .eq('user_id', userId)
          .eq('status', 'approved')
          .gte('start_date', periodStart)
          .lt('start_date', endStr),
        admin
          .from('planning_compliance')
          .select('work_date,day_end_submitted,next_day_submitted,unlocked')
          .eq('user_id', userId)
          .gte('work_date', periodStart)
          .lt('work_date', endStr),
        admin
          .from('salary_adjustments')
          .select('kind,amount')
          .eq('user_id', userId)
          .eq('period_month', periodStart),
        caller.auth.getUser(),
      ])

    const policy = policyRes.data
    if (!policy) return json({ error: 'salary policy missing' }, 400)
    const monthlyCtc = Number(profileRes.data?.monthly_ctc ?? 0)
    const days = daysRes.data ?? []
    const leaves = leavesRes.data ?? []
    const compliance = complRes.data ?? []
    const adjustments = (adjRes.data ?? []) as Array<{ kind: string; amount: number }>

    const present = days.filter((d) => d.status === 'full_day' || d.status === 'present').length
    const half = days.filter((d) => d.status === 'half_day').length
    const quarter = days.filter((d) => d.status === 'quarter_day').length
    const absent = days.filter((d) => d.status === 'absent').length
    const lateCount = days.filter((d) => d.is_late).length
    const overtimeMinutes = days.reduce((s, d) => s + (d.overtime_minutes ?? 0), 0)

    const paidLeaveDays = leaves
      // deno-lint-ignore no-explicit-any
      .filter((l: any) => l.leave_types?.is_paid)
      .reduce((s: number, l: { days: number }) => s + Number(l.days), 0)

    const workingDates = days
      .filter((d) => ['full_day', 'present', 'half_day', 'quarter_day'].includes(d.status))
      .map((d) => d.work_date)
    const compliantDates = new Set(
      compliance
        .filter((c) => c.unlocked || (c.day_end_submitted && c.next_day_submitted))
        .map((c) => c.work_date),
    )
    const nonCompliant = workingDates.filter((d) => !compliantDates.has(d)).length

    const wdpm = Number(policy.working_days_per_month)
    const perDay = wdpm > 0 ? monthlyCtc / wdpm : 0
    const paidUnits =
      present +
      half * Number(policy.half_day_factor) +
      quarter * Number(policy.quarter_day_factor) +
      (policy.paid_leave_paid ? paidLeaveDays : 0)

    const baseEarned = round2(perDay * paidUnits)
    const overtimePay = round2((overtimeMinutes / 60) * Number(policy.overtime_rate_per_hour))
    const latePenalty = round2(lateCount * Number(policy.late_penalty_per_day))
    const planningPenalty = round2(nonCompliant * Number(policy.planning_penalty_per_day))
    const incentives = round2(sumKind(adjustments, 'incentive'))
    const increments = round2(sumKind(adjustments, 'increment'))
    const adjPenalty = round2(sumKind(adjustments, 'penalty'))
    const penalties = round2(adjPenalty + latePenalty + planningPenalty)
    const gross = round2(baseEarned + overtimePay + incentives + increments)

    // Statutory deductions (default 0 in policy → no effect unless configured).
    const pf = round2((baseEarned * Number(policy.pf_percent)) / 100)
    const esic = round2((gross * Number(policy.esic_percent)) / 100)
    const professionalTax = round2(Number(policy.professional_tax))
    const tds = round2((gross * Number(policy.tds_percent)) / 100)
    const statutory = round2(pf + esic + professionalTax + tds)
    const net = round2(gross - penalties - statutory)

    const row = {
      user_id: userId,
      period_month: periodStart,
      present_days: present,
      half_days: half,
      quarter_days: quarter,
      absent_days: absent,
      paid_leave_days: paidLeaveDays,
      late_count: lateCount,
      overtime_minutes: overtimeMinutes,
      planning_noncompliant_days: nonCompliant,
      base_earned: baseEarned,
      overtime_pay: overtimePay,
      incentives,
      increments,
      penalties,
      pf,
      esic,
      professional_tax: professionalTax,
      tds,
      gross,
      net,
      breakdown: {
        perDay: round2(perDay),
        paidUnits,
        baseEarned,
        overtimePay,
        latePenalty,
        planningPenalty,
        adjPenalty,
        incentives,
        increments,
        pf,
        esic,
        professionalTax,
        tds,
        statutory,
      },
      status: 'finalized',
      computed_by: callerUser.data.user?.id ?? null,
      computed_at: new Date().toISOString(),
    }

    const { data: saved, error: saveErr } = await admin
      .from('salary_runs')
      .upsert(row, { onConflict: 'user_id,period_month' })
      .select()
      .single()
    if (saveErr) return json({ error: saveErr.message }, 400)

    return json({ ok: true, run: saved })
  } catch (e) {
    return json({ error: (e as Error).message ?? String(e) }, 500)
  }
})
