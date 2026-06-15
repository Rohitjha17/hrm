import { test, expect } from '@playwright/test'
import { loginAs } from './utils/auth'
import { raj, sunil } from './utils/users'
import { adminClient } from './utils/supabase'

const pad = (n: number) => String(n).padStart(2, '0')

// Seed April 2026 inputs for Raj: attendance 90, planning 50, tasks 75 → overall 71.7.
async function seedAppraisalInputs(): Promise<string> {
  const admin = adminClient()
  const { data: r } = await admin.from('profiles').select('id').eq('email', raj.email).single()
  const uid = r!.id

  const mk = (d: number, status: string) => ({
    user_id: uid, work_date: `2026-04-${pad(d)}`, status, is_late: false, overtime_minutes: 0, worked_minutes: 0,
  })
  const days = []
  for (let d = 1; d <= 18; d++) days.push(mk(d, 'full_day'))
  days.push(mk(19, 'absent'), mk(20, 'absent'))
  await admin.from('attendance_days').delete().eq('user_id', uid).gte('work_date', '2026-04-01').lt('work_date', '2026-05-01')
  await admin.from('attendance_days').insert(days)

  const comp = []
  for (let d = 1; d <= 9; d++) comp.push({ user_id: uid, work_date: `2026-04-${pad(d)}`, day_end_submitted: true, next_day_submitted: true })
  await admin.from('planning_compliance').delete().eq('user_id', uid).gte('work_date', '2026-04-01').lt('work_date', '2026-05-01')
  await admin.from('planning_compliance').insert(comp)

  const { data: statuses } = await admin.from('task_statuses').select('id,slug')
  const done = statuses!.find((s) => s.slug === 'completed')!.id
  const pend = statuses!.find((s) => s.slug === 'pending')!.id
  const tasks = [1, 2, 3].map((i) => ({
    title: `done-${i}`, created_by: uid, assignee_id: uid, status_id: done, created_at: '2026-04-15T10:00:00Z',
  }))
  tasks.push({ title: 'pending-1', created_by: uid, assignee_id: uid, status_id: pend, created_at: '2026-04-16T10:00:00Z' })
  await admin.from('tasks').insert(tasks)
  return uid
}

test.describe('Phase 7 — appraisal management', () => {
  test('admin creates a cycle + appraisal and computes scores & recommendations', async ({ page }) => {
    await seedAppraisalInputs()
    await loginAs(page, sunil)
    await page.goto('/admin/appraisal')
    await expect(page.getByTestId('appraisal-admin-page')).toBeVisible()

    // Create cycle.
    await page.getByTestId('new-cycle-button').click()
    await page.getByTestId('cycle-name').fill('April Review')
    await page.getByTestId('cycle-type').selectOption('monthly')
    await page.getByTestId('cycle-start').fill('2026-04-01')
    await page.getByTestId('cycle-end').fill('2026-04-30')
    await page.getByTestId('create-cycle-submit').click()
    await expect(page.getByTestId('cycle-item').filter({ hasText: 'April Review' })).toBeVisible()
    await page.getByTestId('cycle-item').filter({ hasText: 'April Review' }).click()

    // Add appraisal for Raj.
    await page.getByTestId('add-appraisal-button').click()
    await page.getByTestId('appraisal-user-select').selectOption({ label: raj.fullName })
    await page.getByTestId('appraisal-rating').selectOption('4')
    await page.getByTestId('create-appraisal-submit').click()

    const row = page.getByTestId(`appraisal-row-${raj.email}`)
    await expect(row).toBeVisible()

    // Compute scores from the seeded data.
    await row.getByTestId('compute-appraisal').click()
    await expect(row.getByTestId('appraisal-overall')).toHaveText('71.7', { timeout: 10_000 })
    await expect(row.getByTestId('appraisal-increment')).toHaveText('5%')
  })

  test('employee sees their own appraisal with scores & recommendation', async ({ page }) => {
    await loginAs(page, raj)
    await page.goto('/appraisal')
    await expect(page.getByTestId('appraisal-page')).toBeVisible()
    const card = page.getByTestId('appraisal-card').filter({ hasText: 'April Review' })
    await expect(card).toBeVisible({ timeout: 10_000 })
    await expect(card).toContainText('71.7')
    await expect(card).toContainText('5%')
  })
})
