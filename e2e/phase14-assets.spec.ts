import { test, expect } from '@playwright/test'
import { loginAs } from './utils/auth'
import { aarti, raj, sunil } from './utils/users'

test.describe('Phase 14 — asset management', () => {
  test('assign → transfer → return an asset with full history', async ({ page }) => {
    await loginAs(page, sunil)
    await page.goto('/admin/assets')
    await expect(page.getByTestId('assets-page')).toBeVisible()

    // Create.
    await page.getByTestId('new-asset-button').click()
    await page.getByTestId('asset-type').selectOption('laptop')
    await page.getByTestId('asset-name').fill('MacBook Pro 16')
    await page.getByTestId('create-asset').click()
    const row = page.getByTestId('asset-row').filter({ hasText: 'MacBook Pro 16' })
    await expect(row).toBeVisible()
    await expect(row.getByTestId('asset-status')).toHaveText('available')

    // Assign to Aarti.
    await row.getByTestId('manage-asset').click()
    await page.getByTestId('asset-employee').selectOption({ label: aarti.fullName })
    await page.getByTestId('assign-asset').click()
    await expect(page.getByTestId('current-holder')).toContainText('Aarti', { timeout: 10_000 })
    await expect(page.getByTestId('assignment-row')).toHaveCount(1)

    // Transfer to Raj.
    await page.getByTestId('asset-employee').selectOption({ label: raj.fullName })
    await page.getByTestId('transfer-asset').click()
    await expect(page.getByTestId('current-holder')).toContainText('Raj', { timeout: 10_000 })
    await expect(page.getByTestId('assignment-row')).toHaveCount(2)

    // Return — history is preserved.
    await page.getByTestId('return-asset').click()
    await expect(page.getByTestId('current-holder')).toContainText('Unassigned', { timeout: 10_000 })
    await expect(page.getByTestId('assignment-row')).toHaveCount(2)

    await page.getByTestId('close-asset').click()
    await expect(row.getByTestId('asset-status')).toHaveText('available')
  })
})
