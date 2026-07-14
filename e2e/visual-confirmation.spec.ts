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
