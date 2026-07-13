import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import { loginAs } from './utils/auth'
import { aarti, raj, sunil } from './utils/users'
import { adminClient } from './utils/supabase'

const SHOT_DIR = 'test-results/regression-screens'

async function shot(page: Page, name: string) {
  fs.mkdirSync(SHOT_DIR, { recursive: true })
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: true })
}

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
  test('admin creates a review period + appraisal and computes scores & recommendations', async ({ page }) => {
    await seedAppraisalInputs()
    await loginAs(page, sunil)
    await page.goto('/admin/appraisal')
    await expect(page.getByTestId('appraisal-admin-page')).toBeVisible()

    // Create a review period — just a name and dates, no cycle type.
    await page.getByTestId('new-cycle-button').click()
    await expect(page.getByTestId('cycle-modal')).not.toContainText('Type')
    await page.getByTestId('cycle-name').fill('April Review')
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

  test('add all employees + compute all fills the period in bulk', async ({ page }) => {
    await loginAs(page, sunil)
    await page.goto('/admin/appraisal')
    await page.getByTestId('cycle-item').filter({ hasText: 'April Review' }).click()

    // Everyone gets enrolled (Raj's existing appraisal is kept, not duplicated).
    await page.getByTestId('add-all-employees').click()
    await expect(page.getByTestId(`appraisal-row-${aarti.email}`)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId(`appraisal-row-${sunil.email}`)).toBeVisible()
    await expect(page.getByTestId(`appraisal-row-${raj.email}`)).toHaveCount(1)

    // One click scores the whole period; Raj's numbers are unchanged.
    await page.getByTestId('compute-all').click()
    const rajRow = page.getByTestId(`appraisal-row-${raj.email}`)
    await expect(rajRow.getByTestId('appraisal-overall')).toHaveText('71.7', { timeout: 15_000 })
    const aartiRow = page.getByTestId(`appraisal-row-${aarti.email}`)
    await expect(aartiRow.getByTestId('appraisal-overall')).not.toHaveText('', { timeout: 15_000 })
    await shot(page, 'appraisal-bulk-add-compute')
  })

  test('feedback, KRA & KPI edits are logged as history without overwriting', async ({ page }) => {
    await loginAs(page, sunil)
    await page.goto('/admin/appraisal')
    await page.getByTestId('cycle-item').filter({ hasText: 'April Review' }).click()

    // First round of qualitative input.
    await page.getByTestId(`appraisal-details-${raj.email}`).click()
    await expect(page.getByTestId('appraisal-details-modal')).toBeVisible()
    await page.getByTestId('details-rating').selectOption('5')
    await page.getByTestId('details-kra').fill('Ship the v2 modules')
    await page.getByTestId('details-kpi').fill('On-time delivery rate')
    await page.getByTestId('details-manager-feedback').fill('Great quarter')
    await page.getByTestId('save-appraisal-details').click()
    await expect(page.getByTestId('appraisal-details-modal')).toBeHidden()

    // Reopen: every change is in the history with its old value.
    await page.getByTestId(`appraisal-details-${raj.email}`).click()
    const history = page.getByTestId('appraisal-history')
    await expect(history).toBeVisible()
    await expect(history).toContainText('Rating')
    await expect(history).toContainText('KRA')
    await expect(history).toContainText('Great quarter')

    // Second edit: the old feedback survives in history, not overwritten.
    await page.getByTestId('details-manager-feedback').fill('Great quarter — recommend promotion')
    await page.getByTestId('save-appraisal-details').click()
    await expect(page.getByTestId('appraisal-details-modal')).toBeHidden()
    await page.getByTestId(`appraisal-details-${raj.email}`).click()
    const feedbackEntries = page
      .getByTestId('appraisal-history-entry')
      .filter({ hasText: 'Manager feedback' })
    await expect(feedbackEntries).toHaveCount(2)
    await expect(feedbackEntries.first()).toContainText('Great quarter')
    await expect(feedbackEntries.first()).toContainText('recommend promotion')
    await shot(page, 'appraisal-change-history')
  })

  test('employee sees full appraisal details: scores, feedback, KRA/KPI and history', async ({ page }) => {
    await loginAs(page, raj)
    await page.goto('/appraisal')
    await expect(page.getByTestId('appraisal-page')).toBeVisible()
    const card = page.getByTestId('appraisal-card').filter({ hasText: 'April Review' })
    await expect(card).toBeVisible({ timeout: 10_000 })
    await expect(card).toContainText('71.7')
    await expect(card).toContainText('5%')
    await expect(card).toContainText('2026-04-01')
    await expect(card.getByTestId('appraisal-rating-stars')).toHaveAttribute('aria-label', '5 of 5')

    // Full details modal: KRA/KPI, both feedbacks, and the change history.
    await card.getByTestId('my-appraisal-details').click()
    const modal = page.getByTestId('my-appraisal-modal')
    await expect(modal).toBeVisible()
    await expect(modal.getByTestId('my-appraisal-kra')).toContainText('Ship the v2 modules')
    await expect(modal.getByTestId('my-appraisal-kpi')).toContainText('On-time delivery rate')
    await expect(modal.getByTestId('my-appraisal-manager-feedback')).toContainText(
      'recommend promotion',
    )
    await expect(modal.getByTestId('appraisal-history')).toContainText('Great quarter')
    await shot(page, 'appraisal-employee-full-details')
  })
})
