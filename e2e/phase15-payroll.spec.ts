import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { loginAs } from './utils/auth'
import { raj, sunil } from './utils/users'
import { adminClient } from './utils/supabase'

const pad = (n: number) => String(n).padStart(2, '0')

async function seedPayroll(): Promise<void> {
  const admin = adminClient()
  const { data: r } = await admin.from('profiles').select('id').eq('email', raj.email).single()
  const uid = r!.id
  await admin.from('salary_policy').update({
    working_days_per_month: 26, late_penalty_per_day: 0, overtime_rate_per_hour: 0,
    planning_penalty_per_day: 0, pf_percent: 12, esic_percent: 0, professional_tax: 200, tds_percent: 10,
  }).eq('id', true)
  await admin.from('salary_profiles').upsert({ user_id: uid, monthly_ctc: 26000 }, { onConflict: 'user_id' })
  const days = []
  for (let d = 1; d <= 26; d++) days.push({ user_id: uid, work_date: `2026-08-${pad(d)}`, status: 'full_day', is_late: false, overtime_minutes: 0, worked_minutes: 480 })
  await admin.from('attendance_days').delete().eq('user_id', uid).gte('work_date', '2026-08-01').lt('work_date', '2026-09-01')
  await admin.from('attendance_days').insert(days)
  const comp = []
  for (let d = 1; d <= 26; d++) comp.push({ user_id: uid, work_date: `2026-08-${pad(d)}`, unlocked: true, unlock_remarks: 'e2e seed' })
  await admin.from('planning_compliance').delete().eq('user_id', uid).gte('work_date', '2026-08-01').lt('work_date', '2026-09-01')
  await admin.from('planning_compliance').insert(comp)
  await admin.from('loans_advances').delete().eq('user_id', uid)
  await admin.from('loans_advances').insert({ user_id: uid, kind: 'loan', amount: 5000, outstanding: 5000 })
}

test.describe('Phase 15 — payroll enhancements', () => {
  test('payslip with statutory components, payslip PDF, and Full & Final settlement', async ({ page }) => {
    await seedPayroll()
    await loginAs(page, sunil)
    await page.goto('/admin/salary')

    // Compute payslip with PF/PT/TDS.
    await page.getByTestId('salary-user-select').selectOption({ label: raj.fullName })
    await page.getByTestId('salary-month').fill('2026-08')
    await page.getByTestId('compute-salary').click()
    await expect(page.getByTestId('salary-net')).toHaveText('20080', { timeout: 15_000 })

    const [slip] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('download-payslip').click(),
    ])
    expect(fs.statSync(await slip.path()).size).toBeGreaterThan(0)

    // Full & Final settlement.
    await page.getByTestId('fnf-user-select').selectOption({ label: raj.fullName })
    await page.getByTestId('fnf-date').fill('2026-08-31')
    await page.getByTestId('compute-fnf').click()
    await expect(page.getByTestId('fnf-net')).toHaveText('45000', { timeout: 15_000 })

    const [fnf] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('generate-fnf-letter').click(),
    ])
    expect(fs.statSync(await fnf.path()).size).toBeGreaterThan(0)
  })
})
