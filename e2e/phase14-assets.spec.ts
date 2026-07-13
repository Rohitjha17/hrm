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

  test('employee sees their assigned assets; admin can delete an asset entry', async ({ browser }) => {
    // Admin creates and assigns a monitor to Aarti.
    const adminCtx = await browser.newContext()
    const adminPage = await adminCtx.newPage()
    await loginAs(adminPage, sunil)
    await adminPage.goto('/admin/assets')
    await adminPage.getByTestId('new-asset-button').click()
    await adminPage.getByTestId('asset-type').selectOption('other')
    await adminPage.getByTestId('asset-name').fill('Dell Monitor 27')
    await adminPage.getByTestId('create-asset').click()
    const row = adminPage.getByTestId('asset-row').filter({ hasText: 'Dell Monitor 27' })
    await row.getByTestId('manage-asset').click()
    await adminPage.getByTestId('asset-employee').selectOption({ label: aarti.fullName })
    await adminPage.getByTestId('assign-asset').click()
    await expect(adminPage.getByTestId('current-holder')).toContainText('Aarti', { timeout: 10_000 })
    await adminPage.getByTestId('close-asset').click()

    // Aarti sees it under My Assets in the employee view.
    const empCtx = await browser.newContext()
    const empPage = await empCtx.newPage()
    await loginAs(empPage, aarti)
    await empPage.goto('/my-assets')
    await expect(empPage.getByTestId('my-assets-page')).toBeVisible()
    const myRow = empPage.getByTestId('my-asset-row').filter({ hasText: 'Dell Monitor 27' })
    await expect(myRow).toBeVisible({ timeout: 10_000 })
    await expect(myRow.getByTestId('my-asset-status')).toContainText('with you')
    await empCtx.close()

    // Admin deletes the asset entry entirely (with inline confirmation).
    await row.getByTestId('manage-asset').click()
    await adminPage.getByTestId('delete-asset').click()
    await adminPage.getByTestId('confirm-delete-asset').click()
    await expect(row).toHaveCount(0, { timeout: 10_000 })
    await adminCtx.close()
  })
})
