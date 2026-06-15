import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { loginAs } from './utils/auth'
import { raj, sunil } from './utils/users'

test.describe('Phase 16 — lifecycle & exit management', () => {
  test('record lifecycle events, render timeline, run exit clearance + documents', async ({ page }) => {
    await loginAs(page, sunil)
    await page.goto('/admin/lifecycle')
    await expect(page.getByTestId('lifecycle-page')).toBeVisible()
    await page.getByTestId('lifecycle-employee-select').selectOption({ label: raj.fullName })

    // Record a lifecycle event → timeline.
    await page.getByTestId('event-type').selectOption('promotion')
    await page.getByTestId('event-date').fill('2026-03-01')
    await page.getByTestId('add-event').click()
    await expect(page.getByTestId('timeline-event').filter({ hasText: 'promotion' })).toBeVisible()

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
})
