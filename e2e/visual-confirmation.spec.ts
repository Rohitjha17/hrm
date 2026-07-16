import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import { loginAs } from './utils/auth'
import { raj, sunil } from './utils/users'

/**
 * Visual confirmation for the delete/edit capabilities added to workflows,
 * lifecycle and appraisal periods. Run standalone with SKIP_DB_RESET=1 after
 * the main suite; every dialog is screenshotted then cancelled, and the demo
 * data it creates is removed through the same UI it is demonstrating.
 */
const SHOT_DIR = 'test-results/visual-confirmation'

async function shot(page: Page, name: string) {
  fs.mkdirSync(SHOT_DIR, { recursive: true })
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: true })
}

test.describe('Visual confirmation — edit/delete capabilities', () => {
  test('workflow: step editing, reordering and deletion UI', async ({ page }) => {
    await loginAs(page, sunil)
    await page.goto('/admin/workflows')

    await page.getByTestId('new-definition-button').click()
    await page.getByTestId('definition-name').fill('Employee Onboarding')
    await page.getByTestId('create-definition-submit').click()
    await page.getByTestId('definition-item').filter({ hasText: 'Employee Onboarding' }).click()
    const stepNames = ['Collect documents', 'IT account setup', 'Team introduction']
    for (const [i, name] of stepNames.entries()) {
      await page.getByTestId('step-name').fill(name)
      await page.getByTestId('add-step').click()
      await expect(page.getByTestId('step-row')).toHaveCount(i + 1)
    }
    await shot(page, '01-workflow-steps-with-controls')

    await page.getByTestId('edit-step-2').click()
    await expect(page.getByTestId('edit-step-modal')).toBeVisible()
    await shot(page, '02-workflow-edit-step-modal')
    await page.getByTestId('modal-close').click()

    await page.getByTestId('delete-step-2').click()
    await expect(page.getByTestId('delete-step-dialog')).toBeVisible()
    await shot(page, '03-workflow-delete-step-confirm')
    await page.getByTestId('modal-close').click()

    await page.getByTestId('delete-definition').click()
    await expect(page.getByTestId('delete-definition-dialog')).toBeVisible()
    await shot(page, '04-workflow-delete-workflow-confirm')
    await page.getByTestId('delete-definition-dialog-confirm').click()
    await expect(
      page.getByTestId('definition-item').filter({ hasText: 'Employee Onboarding' }),
    ).toHaveCount(0)
  })

  test('lifecycle: entry deletion and clear-all UI', async ({ page }) => {
    await loginAs(page, sunil)
    await page.goto('/admin/lifecycle')
    await page.getByTestId('lifecycle-employee-select').selectOption({ label: raj.fullName })

    await page.getByTestId('event-type').selectOption('confirmation')
    await page.getByTestId('event-date').fill('2026-06-01')
    await page.getByTestId('add-event').click()
    await expect(
      page.getByTestId('timeline-event').filter({ hasText: 'confirmation' }).first(),
    ).toBeVisible()
    await page.getByTestId('event-type').selectOption('promotion')
    await page.getByTestId('event-date').fill('2026-07-01')
    await page.getByTestId('add-event').click()
    await expect(
      page.getByTestId('timeline-event').filter({ hasText: 'promotion' }).first(),
    ).toBeVisible()
    await shot(page, '05-lifecycle-timeline-with-delete')

    await page
      .getByTestId('timeline-event')
      .filter({ hasText: 'confirmation' })
      .first()
      .getByTestId('delete-event')
      .click()
    await expect(page.getByTestId('delete-event-dialog')).toBeVisible()
    await shot(page, '06-lifecycle-delete-event-confirm')
    await page.getByTestId('modal-close').click()

    await page.getByTestId('clear-timeline').click()
    await expect(page.getByTestId('clear-timeline-dialog')).toBeVisible()
    await shot(page, '07-lifecycle-clear-timeline-confirm')
    await page.getByTestId('clear-timeline-dialog-confirm').click()
    await expect(page.getByTestId('timeline')).toContainText('No events yet.')
  })

  test('appraisal: remove employee and delete period UI', async ({ page }) => {
    await loginAs(page, sunil)
    await page.goto('/admin/appraisal')

    await page.getByTestId('new-cycle-button').click()
    await page.getByTestId('cycle-name').fill('May 2026 Review')
    await page.getByTestId('cycle-start').fill('2026-05-01')
    await page.getByTestId('cycle-end').fill('2026-05-31')
    await page.getByTestId('create-cycle-submit').click()
    await page.getByTestId('cycle-item').filter({ hasText: 'May 2026 Review' }).click()
    await page.getByTestId('add-all-employees').click()
    await expect(page.getByTestId(`appraisal-row-${raj.email}`)).toBeVisible()
    await shot(page, '08-appraisal-period-with-delete-controls')

    await page.getByTestId(`remove-appraisal-${raj.email}`).click()
    await expect(page.getByTestId('remove-appraisal-dialog')).toBeVisible()
    await shot(page, '09-appraisal-remove-employee-confirm')
    await page.getByTestId('modal-close').click()

    await page.getByTestId('delete-cycle').click()
    await expect(page.getByTestId('delete-cycle-dialog')).toBeVisible()
    await shot(page, '10-appraisal-delete-period-confirm')
    await page.getByTestId('delete-cycle-dialog-confirm').click()
    await expect(page.getByTestId('cycle-item').filter({ hasText: 'May 2026 Review' })).toHaveCount(
      0,
    )
  })

  test('tasks: admin delete control with confirmation dialog', async ({ page }) => {
    await loginAs(page, sunil)
    await page.goto('/tasks')

    await page.getByTestId('new-task-button').click()
    await page.getByTestId('task-title-input').fill('Visual demo — deletable task')
    await page.getByTestId('create-task-submit').click()
    const row = page.getByTestId('task-row').filter({ hasText: 'Visual demo — deletable task' })
    await expect(row).toBeVisible()
    await shot(page, '13-tasks-row-with-delete-control')

    await row.getByTestId('delete-task-button').click()
    await expect(page.getByTestId('delete-task-dialog')).toBeVisible()
    await shot(page, '14-tasks-delete-confirm')
    await page.getByTestId('delete-task-dialog-confirm').click()
    await expect(row).toHaveCount(0)
    await shot(page, '15-tasks-after-delete')
  })

  test('appraisal: increment & promotion no longer appear anywhere', async ({ page }) => {
    await loginAs(page, sunil)
    await page.goto('/admin/appraisal')
    await expect(page.getByTestId('appraisal-admin-page')).toBeVisible()
    await expect(page.getByTestId('appraisal-admin-page')).not.toContainText('Increment')
    await expect(page.getByTestId('appraisal-admin-page')).not.toContainText('Promotion')
    await shot(page, '16-appraisal-no-increment-promotion')
  })

  test('workflows: My Workflows tab, entity dropdown and admin owner filter', async ({
    browser,
  }) => {
    // Employee side: My Workflows with the entity-type dropdown.
    const empCtx = await browser.newContext()
    const emp = await empCtx.newPage()
    await loginAs(emp, raj)
    await emp.goto('/my-workflows')
    await expect(emp.getByTestId('my-workflows-page')).toBeVisible()

    await emp.getByTestId('new-definition-button').click()
    await emp.getByTestId('definition-entity').selectOption({ label: 'Leave' })
    await shot(emp, '17-workflow-entity-dropdown')
    await emp.getByTestId('definition-name').fill('Raj Leave Handover')
    await emp.getByTestId('create-definition-submit').click()
    await expect(
      emp.getByTestId('definition-item').filter({ hasText: 'Raj Leave Handover' }),
    ).toBeVisible()
    await emp.getByTestId('step-name').fill('Brief the team')
    await emp.getByTestId('add-step').click()
    await expect(emp.getByTestId('step-row')).toHaveCount(1)
    await shot(emp, '18-my-workflows-employee-view')
    await empCtx.close()

    // Admin side: all workflows with owners, filterable per employee.
    const admCtx = await browser.newContext()
    const adm = await admCtx.newPage()
    await loginAs(adm, sunil)
    await adm.goto('/admin/workflows')
    const admItem = adm.getByTestId('definition-item').filter({ hasText: 'Raj Leave Handover' })
    await expect(admItem).toBeVisible()
    await shot(adm, '19-workflows-admin-all-users')
    await adm.getByTestId('workflow-owner-filter').selectOption({ label: raj.fullName })
    await expect(admItem).toBeVisible()
    await shot(adm, '20-workflows-admin-filtered-by-user')

    // Clean up the demo workflow through the UI being demonstrated.
    await admItem.click()
    await adm.getByTestId('delete-definition').click()
    await adm.getByTestId('delete-definition-dialog-confirm').click()
    await expect(admItem).toHaveCount(0)
    await admCtx.close()
  })

  test('planning: read-only slot list, add/edit modal and labelled history', async ({ page }) => {
    await loginAs(page, raj)
    await page.goto('/planning')

    const future = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10)
    await page.getByTestId('plan-date').fill(future)

    // Add slot modal: times + Planning / Working / Completion % / Challenges.
    await page.getByTestId('add-slot').click()
    await expect(page.getByTestId('slot-form-modal')).toBeVisible()
    await page.getByTestId('slot-form-start').fill('09:00')
    await page.getByTestId('slot-form-end').fill('11:00')
    await page.getByTestId('slot-form-planning').fill('Prepare sprint demo')
    await page.getByTestId('slot-form-working').fill('Slides drafted')
    await page.getByTestId('slot-form-progress').fill('40')
    await page.getByTestId('slot-form-challenges').fill('Waiting on data from finance')
    await shot(page, '21-planning-add-slot-modal')
    await page.getByTestId('slot-form-save').click()
    await expect(page.getByTestId('slots-list').locator('[data-testid^="slot-card-"]')).toHaveCount(1)
    await shot(page, '22-planning-slot-list-readonly')

    // Edit once so history has an entry, then show the labelled history.
    await page.locator('[data-testid^="slot-edit-"]').click()
    await page.getByTestId('slot-form-progress').fill('70')
    await page.getByTestId('slot-form-save').click()
    await page.locator('[data-testid^="slot-history-"]').click()
    await expect(page.getByTestId('planning-history-modal')).toBeVisible()
    await expect(page.getByTestId('planning-history-entry').first()).toContainText('Working')
    await shot(page, '23-planning-history-labels')
    await page.getByTestId('modal-close').click()

    // Clean up the demo slot.
    await page.locator('[data-testid^="slot-delete-"]').click()
    await expect(page.getByTestId('slots-list')).toHaveCount(0)
  })

  test('planning admin: eye view shows the same labelled slot details', async ({ page }) => {
    await loginAs(page, sunil)

    // Give Sunil a slot today so the admin eye view has content.
    await page.goto('/planning')
    await page.getByTestId('add-slot').click()
    await page.getByTestId('slot-form-start').fill('14:00')
    await page.getByTestId('slot-form-end').fill('16:00')
    await page.getByTestId('slot-form-planning').fill('Quarterly budget review')
    await page.getByTestId('slot-form-working').fill('Draft shared with finance')
    await page.getByTestId('slot-form-progress').fill('50')
    await page.getByTestId('slot-form-save').click()

    await page.goto('/admin/planning')
    await page.getByTestId(`view-plan-${sunil.email}`).click()
    const modal = page.getByTestId('plan-view-modal')
    await expect(modal).toBeVisible()
    await expect(modal.getByTestId('plan-view-slot').first()).toContainText('Planning')
    await expect(modal.getByTestId('plan-view-slot').first()).toContainText('Working')
    await expect(modal.getByTestId('plan-view-slot').first()).toContainText('Completion %')
    await expect(modal.getByTestId('plan-view-slot').first()).toContainText('Challenges')
    await shot(page, '24-planning-admin-eye-labels')
    await page.getByTestId('modal-close').click()

    // Clean up the demo slot.
    await page.goto('/planning')
    const row = page
      .locator('[data-testid^="slot-card-"]')
      .filter({ hasText: 'Quarterly budget review' })
    await row.locator('[data-testid^="slot-delete-"]').click()
    await expect(row).toHaveCount(0)
  })

  test('users: per-user leave quotas in the add & edit employee dialogs', async ({ page }) => {
    await loginAs(page, sunil)
    await page.goto('/admin/users')

    await page.getByTestId('add-employee-button').click()
    await expect(page.getByTestId('new-quota-paid')).toHaveValue('12')
    await page.getByTestId('new-quota-paid').fill('18')
    await page.getByTestId('new-quota-casual').fill('4')
    await shot(page, '11-user-create-with-quotas')
    await page.getByTestId('modal-close').click()

    await page.getByTestId(`edit-user-${raj.email}`).click()
    await expect(page.getByTestId('edit-quota-paid')).toBeVisible()
    await shot(page, '12-user-edit-quotas')
    await page.getByTestId('modal-close').click()
  })
})
