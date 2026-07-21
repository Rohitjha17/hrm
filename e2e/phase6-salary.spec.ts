import { test, expect } from '@playwright/test'
import { loginAs } from './utils/auth'
import { aarti, sunil } from './utils/users'
import { adminClient, signedInClient } from './utils/supabase'

const MONTH = '2026-05'
const pad = (n: number) => String(n).padStart(2, '0')

// Seed a deterministic month of inputs for the salary engine.
async function seedSalaryMonth(): Promise<string> {
  const admin = adminClient()
  const { data: a } = await admin.from('profiles').select('id').eq('email', aarti.email).single()
  const uid = a!.id

  await admin.from('salary_policy').update({
    late_penalty_per_day: 100,
    overtime_rate_per_hour: 50,
    planning_penalty_per_day: 200,
    // Own the full policy state — other specs (run earlier lexicographically) may
    // have set non-zero statutory rates on this shared singleton.
    pf_percent: 0,
    esic_percent: 0,
    professional_tax: 0,
    tds_percent: 0,
  }).eq('id', true)
  await admin.from('salary_profiles').upsert({ user_id: uid, monthly_ctc: 52000 }, { onConflict: 'user_id' })

  // 20 full (one late + 120m OT), 2 half, 1 quarter, 1 absent — all columns set.
  const mk = (d: string, status: string, late = false, ot = 0) => ({
    user_id: uid, work_date: d, status, is_late: late, overtime_minutes: ot, worked_minutes: 0,
  })
  const days = []
  for (let d = 1; d <= 20; d++) days.push(mk(`${MONTH}-${pad(d)}`, 'full_day', d === 1, d === 1 ? 120 : 0))
  days.push(mk(`${MONTH}-21`, 'half_day'), mk(`${MONTH}-22`, 'half_day'), mk(`${MONTH}-23`, 'quarter_day'), mk(`${MONTH}-24`, 'absent'))
  await admin.from('attendance_days').delete().eq('user_id', uid).gte('work_date', `${MONTH}-01`).lt('work_date', '2026-06-01')
  await admin.from('attendance_days').insert(days)

  // 22 of 23 working days planning-compliant → 1 non-compliant.
  const comp = []
  for (let d = 1; d <= 22; d++) comp.push({ user_id: uid, work_date: `${MONTH}-${pad(d)}`, unlocked: true, unlock_remarks: 'e2e seed' })
  await admin.from('planning_compliance').delete().eq('user_id', uid).gte('work_date', `${MONTH}-01`).lt('work_date', '2026-06-01')
  await admin.from('planning_compliance').insert(comp)

  const { data: casual } = await admin.from('leave_types').select('id').eq('slug', 'casual').single()
  await admin.from('leave_requests').delete().eq('user_id', uid).gte('start_date', `${MONTH}-01`).lt('start_date', '2026-06-01')
  await admin.from('leave_requests').insert({ user_id: uid, leave_type_id: casual!.id, start_date: `${MONTH}-10`, end_date: `${MONTH}-11`, status: 'approved' })

  await admin.from('salary_adjustments').delete().eq('user_id', uid).eq('period_month', `${MONTH}-01`)
  await admin.from('salary_adjustments').insert([
    { user_id: uid, period_month: `${MONTH}-01`, kind: 'incentive', amount: 1000 },
    { user_id: uid, period_month: `${MONTH}-01`, kind: 'penalty', amount: 500 },
    { user_id: uid, period_month: `${MONTH}-01`, kind: 'increment', amount: 2000 },
  ])
  return uid
}

test.describe('Phase 6 — salary management', () => {
  test('admin computes a policy-driven payslip (Edge Function) via the UI', async ({ page }) => {
    await seedSalaryMonth()
    await loginAs(page, sunil)
    await page.goto('/admin/salary')
    await expect(page.getByTestId('salary-admin-page')).toBeVisible()

    await page.getByTestId('salary-user-select').selectOption({ label: aarti.fullName })
    await page.getByTestId('salary-month').fill(MONTH)
    await page.getByTestId('compute-salary').click()

    await expect(page.getByTestId('salary-result')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('salary-gross')).toHaveText('49600')
    await expect(page.getByTestId('salary-net')).toHaveText('48800')
  })

  test('employee without salary permission is blocked (UI, data layer, function)', async () => {
    const uid = await seedSalaryMonth()

    // Data layer: RLS denies reading salary_runs (no salary.view_own by default).
    const aartiClient = await signedInClient(aarti.email, aarti.password)
    const runs = await aartiClient.from('salary_runs').select('*')
    expect(runs.data ?? []).toHaveLength(0)
    const profiles = await aartiClient.from('salary_profiles').select('*')
    expect(profiles.data ?? []).toHaveLength(0)

    // Edge Function: forbidden for a non-salary.manage caller.
    const invoke = await aartiClient.functions.invoke('calculate-salary', {
      body: { userId: uid, month: MONTH },
    })
    expect(invoke.error).toBeTruthy()
  })

  test('employee cannot reach the salary route (UI guard → Forbidden)', async ({ page }) => {
    await loginAs(page, aarti)
    await page.goto('/salary')
    await expect(page.getByTestId('forbidden-page')).toBeVisible()
    await page.goto('/admin/salary')
    await expect(page.getByTestId('forbidden-page')).toBeVisible()
  })
})
