import { test, expect } from '@playwright/test'
import { loginAs } from './utils/auth'
import { aarti, sunil } from './utils/users'

test.describe('Phase 5 — leave management', () => {
  test('employee applies; admin approves; status + balance update live', async ({ browser }) => {
    // Employee applies for 2 days of Casual leave.
    const empCtx = await browser.newContext()
    const empPage = await empCtx.newPage()
    await loginAs(empPage, aarti)
    await empPage.goto('/leave')
    await expect(empPage.getByTestId('leave-page')).toBeVisible()

    await empPage.getByTestId('apply-leave-button').click()
    await empPage.getByTestId('leave-type-select').selectOption({ label: 'Casual' })
    await empPage.getByTestId('leave-start').fill('2026-07-06')
    await empPage.getByTestId('leave-end').fill('2026-07-07')
    await empPage.getByTestId('leave-reason').fill('Family event')
    await empPage.getByTestId('submit-leave').click()

    const row = empPage.getByTestId('leave-row').filter({ hasText: 'Casual' })
    await expect(row.getByTestId('leave-status')).toContainText('pending')

    // Admin sees it pending and approves.
    const adminCtx = await browser.newContext()
    const adminPage = await adminCtx.newPage()
    await loginAs(adminPage, sunil)
    await adminPage.goto('/admin/leave')
    const appRow = adminPage.getByTestId(`approval-row-${aarti.email}`)
    await expect(appRow).toBeVisible({ timeout: 10_000 })
    await appRow.getByTestId('approve-leave').click()

    // Employee sees the approval live and the balance reflects the 2 used days.
    await expect(row.getByTestId('leave-status')).toContainText('approved', { timeout: 15_000 })
    await expect(empPage.getByTestId('balance-Casual')).toContainText('Used 2', { timeout: 15_000 })

    await empCtx.close()
    await adminCtx.close()
  })

  test('admin can reject a leave request', async ({ browser }) => {
    const empCtx = await browser.newContext()
    const empPage = await empCtx.newPage()
    await loginAs(empPage, aarti)
    await empPage.goto('/leave')
    await empPage.getByTestId('apply-leave-button').click()
    await empPage.getByTestId('leave-type-select').selectOption({ label: 'Sick' })
    await empPage.getByTestId('leave-start').fill('2026-07-20')
    await empPage.getByTestId('leave-end').fill('2026-07-20')
    await empPage.getByTestId('submit-leave').click()

    const adminCtx = await browser.newContext()
    const adminPage = await adminCtx.newPage()
    await loginAs(adminPage, sunil)
    await adminPage.goto('/admin/leave')
    const appRow = adminPage.getByTestId(`approval-row-${aarti.email}`)
    await expect(appRow).toBeVisible({ timeout: 10_000 })
    await appRow.getByTestId('reject-leave').click()

    const row = empPage.getByTestId('leave-row').filter({ hasText: 'Sick' })
    await expect(row.getByTestId('leave-status')).toContainText('rejected', { timeout: 15_000 })

    await empCtx.close()
    await adminCtx.close()
  })

  test('holiday master is editable', async ({ page }) => {
    await loginAs(page, sunil)
    await page.goto('/admin/leave')
    await expect(page.getByTestId('holidays-section')).toBeVisible()

    await page.getByTestId('holiday-name').fill('Company Foundation Day')
    await page.getByTestId('holiday-date').fill('2026-09-09')
    await page.getByTestId('add-holiday').click()
    await expect(page.getByTestId('holidays-table').getByText('Company Foundation Day')).toBeVisible()
  })
})
