import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { loginAs } from './utils/auth'
import { raj, sunil } from './utils/users'

test.describe('Phase 16 — lifecycle & exit management', () => {
  test('record lifecycle events, render timeline, run exit clearance + documents', async ({
    page,
  }) => {
    await loginAs(page, sunil)
    await page.goto('/admin/lifecycle')
    await expect(page.getByTestId('lifecycle-page')).toBeVisible()
    await page.getByTestId('lifecycle-employee-select').selectOption({ label: raj.fullName })

    // Record a lifecycle event → timeline.
    await page.getByTestId('event-type').selectOption('promotion')
    await page.getByTestId('event-date').fill('2026-03-01')
    await page.getByTestId('add-event').click()
    const promo = page.getByTestId('timeline-event').filter({ hasText: 'promotion' })
    await expect(promo).toBeVisible()

    // Events can be corrected after the fact.
    await promo.getByTestId('edit-event').click()
    await expect(page.getByTestId('edit-event-modal')).toBeVisible()
    await page.getByTestId('edit-event-date').fill('2026-03-15')
    await page.getByTestId('edit-event-note').fill('Corrected effective date')
    await page.getByTestId('save-event').click()
    await expect(promo).toContainText('2026-03-15', { timeout: 10_000 })
    await expect(promo).toContainText('Corrected effective date')

    // Start exit → default clearances appear.
    await page.getByTestId('exit-date').fill('2026-09-30')
    await page.getByTestId('start-exit').click()
    await expect(page.getByTestId('clearance-row')).toHaveCount(4, { timeout: 10_000 })

    // Clear each clearance.
    for (let remaining = 4; remaining > 0; remaining--) {
      await page.getByTestId('clear-button').first().click()
      await expect(page.getByTestId('clear-button')).toHaveCount(remaining - 1, { timeout: 10_000 })
    }

    // Generate an exit document.
    const [pdf] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('generate-experience').click(),
    ])
    expect(fs.statSync(await pdf.path()).size).toBeGreaterThan(0)
  })

  test('timeline entries can be deleted one-by-one or cleared entirely', async ({ page }) => {
    await loginAs(page, sunil)
    await page.goto('/admin/lifecycle')
    await page.getByTestId('lifecycle-employee-select').selectOption({ label: raj.fullName })

    // Record a mistaken transfer entry, then delete just that entry (confirmed).
    await page.getByTestId('event-type').selectOption('transfer')
    await page.getByTestId('event-date').fill('2026-05-01')
    await page.getByTestId('add-event').click()
    const transfer = page.getByTestId('timeline-event').filter({ hasText: 'transfer' })
    await expect(transfer).toBeVisible()
    await transfer.getByTestId('delete-event').click()
    await expect(page.getByTestId('delete-event-dialog')).toBeVisible()
    await page.getByTestId('delete-event-dialog-confirm').click()
    await expect(transfer).toHaveCount(0)

    // Other entries survive a single delete; "Clear all" wipes the timeline.
    await expect(page.getByTestId('timeline-event').first()).toBeVisible()
    await page.getByTestId('clear-timeline').click()
    await expect(page.getByTestId('clear-timeline-dialog')).toBeVisible()
    await page.getByTestId('clear-timeline-dialog-confirm').click()
    await expect(page.getByTestId('timeline-event')).toHaveCount(0)
    await expect(page.getByTestId('timeline')).toContainText('No events yet.')
    // The bulk action hides once there is nothing left to clear.
    await expect(page.getByTestId('clear-timeline')).toHaveCount(0)
  })
})
