import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import { loginAs } from './utils/auth'
import { aarti, raj, sunil } from './utils/users'

const SHOT_DIR = 'test-results/regression-screens'

async function shot(page: Page, name: string) {
  fs.mkdirSync(SHOT_DIR, { recursive: true })
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: true })
}

test.describe('Phase 21 — tab-wise upgrades v2', () => {
  test('1. attendance monitor shows a range summary', async ({ page }) => {
    await loginAs(page, sunil)
    await page.goto('/admin/attendance')
    await expect(page.getByTestId('attendance-monitor-page')).toBeVisible()

    // Summary tiles are always present.
    await expect(page.getByTestId('monitor-summary')).toBeVisible()
    await expect(page.getByTestId('summary-employees')).toBeVisible()

    // Widen to a week — per-employee summary appears for multi-day ranges.
    const today = new Date()
    const weekAgo = new Date(today.getTime() - 6 * 86_400_000)
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    await page.getByTestId('monitor-from').fill(iso(weekAgo))
    await page.getByTestId('monitor-to').fill(iso(today))
    await expect(page.getByTestId('monitor-summary')).toBeVisible()
    await shot(page, '01-attendance-range-summary')
  })

  test('2. task remarks accumulate as history', async ({ page }) => {
    await loginAs(page, aarti)
    await page.goto('/tasks')
    await page.getByTestId('new-task-button').click()
    await page.getByTestId('task-title-input').fill('Remark history task')
    await page.getByTestId('create-task-submit').click()

    const row = page.getByTestId('task-row').filter({ hasText: 'Remark history task' })
    await expect(row).toBeVisible()
    await row.getByTestId('task-remark-button').click()
    await expect(page.getByTestId('remark-modal')).toBeVisible()

    await page.getByTestId('task-remark-textarea').fill('First remark')
    await page.getByTestId('save-remark-submit').click()
    await expect(page.getByTestId('remark-entry')).toHaveCount(1, { timeout: 10_000 })

    await page.getByTestId('task-remark-textarea').fill('Second remark')
    await page.getByTestId('save-remark-submit').click()
    await expect(page.getByTestId('remark-entry')).toHaveCount(2, { timeout: 10_000 })

    // Newest first; both survive (history, not overwrite).
    await expect(page.getByTestId('remark-entry').first()).toContainText('Second remark')
    await expect(page.getByTestId('remark-entry').last()).toContainText('First remark')
    await shot(page, '02-task-remark-history')
  })

  test('3. planning: any date, any duration slots, task brief', async ({ page }) => {
    await loginAs(page, aarti)
    await page.goto('/planning')
    await expect(page.getByTestId('planning-page')).toBeVisible()

    // Task brief panel is present.
    await expect(page.getByTestId('planning-task-brief')).toBeVisible()

    // Plan a future date.
    const future = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10)
    await page.getByTestId('plan-date').fill(future)

    // Arbitrary duration: 09:15 → 10:45.
    await page.getByTestId('new-slot-start').fill('09:15')
    await page.getByTestId('new-slot-end').fill('10:45')
    await page.getByTestId('add-slot').click()

    const card = page.locator('[data-testid^="slot-card-"]').first()
    await expect(card).toBeVisible({ timeout: 10_000 })
    await expect(card.locator('[data-testid^="slot-label-"]')).toHaveText('09:15–10:45')
    await shot(page, '03-planning-flexible-anydate')
  })

  test('4. reports cover all module tabs', async ({ page }) => {
    await loginAs(page, sunil)
    await page.goto('/admin/reports')
    await expect(page.getByTestId('reports-page')).toBeVisible()

    const newTabs = [
      'planning', 'recruitment', 'communication', 'documents', 'assets', 'lifecycle',
      'helpdesk', 'visitors', 'meetings', 'training', 'policies', 'workflows',
    ]
    for (const t of newTabs) {
      await page.getByTestId(`report-tab-${t}`).click()
      // Table or empty state renders without error for every module.
      await expect(page.getByTestId('report-table').or(page.getByTestId('report-empty'))).toBeVisible({ timeout: 10_000 })
    }
    await shot(page, '04-reports-all-tabs')
  })

  test('5. workflows are a view-only rulebook', async ({ page }) => {
    await loginAs(page, sunil)
    await page.goto('/admin/workflows')
    await expect(page.getByTestId('workflow-admin-page')).toBeVisible()
    await expect(page.getByTestId('start-instance')).toHaveCount(0)
    await expect(page.getByText('reference plans, not automations')).toBeVisible()
    await shot(page, '05-workflows-rulebook')
  })

  test('6. recruitment: dept+designation opening, candidate phone/docs/checklist', async ({ page }) => {
    await loginAs(page, sunil)
    await page.goto('/admin/recruitment')

    await page.getByTestId('new-opening-button').click()
    await expect(page.getByTestId('opening-title')).toHaveCount(0) // no free-text title
    await page.getByTestId('opening-department').selectOption({ index: 1 })
    await page.getByTestId('opening-designation').fill('QA Analyst')
    await page.getByTestId('create-opening-submit').click()
    await page.getByTestId('opening-item').filter({ hasText: 'QA Analyst' }).first().click()

    // Candidate with phone.
    await page.getByTestId('add-candidate-button').click()
    await page.getByTestId('candidate-name').fill('Priya Verma')
    await page.getByTestId('candidate-email').fill('priya.verma@example.com')
    await page.getByTestId('candidate-phone').fill('+91 98765 12345')
    await page.getByTestId('create-candidate-submit').click()
    const row = page.getByTestId('candidate-row').filter({ hasText: 'Priya Verma' })
    await expect(row).toBeVisible()
    await expect(row).toContainText('+91 98765 12345')

    // Communication checklist.
    await row.getByTestId('manage-candidate').click()
    await expect(page.getByTestId('candidate-documents')).toBeVisible()
    await page.getByTestId('start-checklist').click()
    await expect(page.getByTestId('checklist-item-offer_letter')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('checklist-status-offer_letter').selectOption('sent')
    await expect(
      page.getByTestId('checklist-item-offer_letter').locator('[data-testid^="checklist-status-"]'),
    ).toHaveValue('sent')
    await shot(page, '06-recruitment-checklist')
    await page.getByTestId('close-candidate').click()
  })

  test('7-8-11. renames: Communication, Doc Vault, Users', async ({ page }) => {
    await loginAs(page, sunil)

    await expect(page.getByTestId('nav-onboarding')).toContainText('Communication')
    await expect(page.getByTestId('nav-documents')).toContainText('Doc Vault')
    await expect(page.getByTestId('nav-users')).toContainText('Users')
    await expect(page.getByTestId('nav-visitors')).toContainText('Visitors & Meetings')

    await page.goto('/admin/onboarding')
    await expect(page.getByRole('heading', { name: 'Communication' })).toBeVisible()
    await page.goto('/admin/documents')
    await expect(page.getByRole('heading', { name: 'Doc Vault' })).toBeVisible()
    await page.goto('/admin/users')
    await expect(page.getByRole('heading', { name: 'Users', exact: true })).toBeVisible()
    await shot(page, '07-renamed-tabs')
  })

  test('9. lifecycle: exit document templates', async ({ page }) => {
    await loginAs(page, sunil)
    await page.goto('/admin/lifecycle')
    await expect(page.getByTestId('exit-templates')).toBeVisible()

    await page.getByTestId('new-exit-template').click()
    await page.getByTestId('tpl-doctype').selectOption('relieving')
    await page.getByTestId('tpl-title').fill('Relieving Letter (standard)')
    await page.getByTestId('tpl-body').fill(
      'Dear {{full_name}},\n\nThis confirms your relieving effective {{last_working_date}}.\n\nHR',
    )
    await page.getByTestId('create-template').click()
    await expect(page.getByTestId('exit-template-row').filter({ hasText: 'Relieving Letter (standard)' })).toBeVisible()

    // Generates a PDF from the template.
    const [pdf] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('generate-exit-relieving').click(),
    ])
    expect(fs.statSync(await pdf.path()).size).toBeGreaterThan(0)
    await shot(page, '09-lifecycle-exit-templates')
  })

  test('10. meetings: host, invite, invitee accepts', async ({ browser }) => {
    // Sunil hosts a meeting and invites Raj.
    const hostCtx = await browser.newContext()
    const host = await hostCtx.newPage()
    await loginAs(host, sunil)
    await host.goto('/admin/visitors')
    await expect(host.getByTestId('meetings-section')).toBeVisible()

    await host.getByTestId('host-meeting-button').click()
    await host.getByTestId('meeting-title-input').fill('Sprint sync')
    await host.getByTestId('meeting-desc-input').fill('Weekly cadence review')
    await host.getByTestId('meeting-link-input').fill('https://meet.example.com/sprint-sync')
    const starts = new Date(Date.now() + 86_400_000)
    const local = new Date(starts.getTime() - starts.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16)
    await host.getByTestId('meeting-start-input').fill(local)
    await host.getByTestId(`invite-${raj.email}`).check()
    await host.getByTestId('create-meeting-submit').click()
    await expect(host.getByTestId('meeting-card').filter({ hasText: 'Sprint sync' })).toBeVisible({ timeout: 10_000 })
    await shot(host, '10a-meeting-hosted')
    await hostCtx.close()

    // Raj sees the upcoming meeting and accepts.
    const invCtx = await browser.newContext()
    const inv = await invCtx.newPage()
    await loginAs(inv, raj)
    await inv.goto('/visitors')
    const card = inv.getByTestId('meeting-card').filter({ hasText: 'Sprint sync' })
    await expect(card).toBeVisible({ timeout: 10_000 })
    await expect(card.getByTestId('meeting-link')).toBeVisible()
    await card.getByTestId('accept-invite').click()
    await expect(card.getByTestId('meeting-invitees')).toContainText('accepted', { timeout: 10_000 })
    await shot(inv, '10b-meeting-accepted')
    await invCtx.close()
  })

  test('12. training: create module, assign, complete & acknowledge', async ({ browser }) => {
    // Admin creates and assigns a module.
    const adminCtx = await browser.newContext()
    const admin = await adminCtx.newPage()
    await loginAs(admin, sunil)
    await admin.goto('/admin/training')
    await expect(admin.getByTestId('training-page')).toBeVisible()

    await admin.getByTestId('new-module-button').click()
    await admin.getByTestId('module-title-input').fill('Security basics')
    await admin.getByTestId('module-body-input').fill('Read the security handbook and complete the checklist.')
    await admin.getByTestId('create-module-submit').click()
    await admin.getByTestId('module-item').filter({ hasText: 'Security basics' }).click()

    await admin.getByTestId('assign-module').click()
    await admin.getByTestId(`assign-${aarti.email}`).check()
    await admin.getByTestId('assign-submit').click()
    await expect(admin.getByTestId(`assignment-row-${aarti.email}`)).toBeVisible({ timeout: 10_000 })
    await shot(admin, '12a-training-assigned')
    await adminCtx.close()

    // Aarti completes and acknowledges.
    const empCtx = await browser.newContext()
    const emp = await empCtx.newPage()
    await loginAs(emp, aarti)
    await emp.goto('/training')
    const card = emp.getByTestId('my-training-Security basics')
    await expect(card).toBeVisible({ timeout: 10_000 })
    await card.getByTestId('mark-complete').click()
    await expect(card.getByTestId('my-training-status')).toHaveText('completed', { timeout: 10_000 })
    await card.getByTestId('acknowledge-training').click()
    await expect(card.getByTestId('my-training-status')).toHaveText('acknowledged', { timeout: 10_000 })
    await shot(emp, '12b-training-acknowledged')
    await empCtx.close()
  })
})
