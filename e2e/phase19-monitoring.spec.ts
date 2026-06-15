import { test, expect } from '@playwright/test'
import { loginAs } from './utils/auth'
import { aarti, sunil } from './utils/users'

test.describe('Phase 19 — employee monitoring (opt-in, feasibility-constrained)', () => {
  test('opt-in capture stores a record with all fields; admin report renders it', async ({ browser }) => {
    // Employee opts in and captures (consent-based; headless falls back to a placeholder).
    const empCtx = await browser.newContext()
    const emp = await empCtx.newPage()
    await loginAs(emp, aarti)
    await emp.goto('/monitoring')
    await expect(emp.getByTestId('monitoring-page')).toBeVisible()
    // The honesty note about the native-agent requirement must be shown.
    await expect(emp.getByTestId('monitoring-limitation-note')).toBeVisible()

    await emp.getByTestId('capture-screenshot').click()
    const row = emp.getByTestId('capture-row').first()
    await expect(row).toBeVisible({ timeout: 15_000 })
    await expect(row.getByTestId('capture-activity')).toHaveText('active')
    await expect(row.getByTestId('capture-system')).not.toBeEmpty()
    await empCtx.close()

    // Admin report renders the capture (employee-wise / daily).
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await loginAs(page, sunil)
    await page.goto('/admin/monitoring')
    await expect(page.getByTestId('report-limitation-note')).toBeVisible()
    await expect(page.getByTestId('report-capture-row').filter({ hasText: 'Aarti' })).toBeVisible({
      timeout: 15_000,
    })
    await ctx.close()
  })
})
