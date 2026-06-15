import { test, expect } from '@playwright/test'
import { loginAs } from './utils/auth'
import { sunil } from './utils/users'

const NEW_EMAIL = 'neha@hrms.local'

test.describe('Phase 9 — employee management & lifecycle', () => {
  test('full lifecycle: add → assign → deactivate → reactivate → delete (UI only)', async ({ page }) => {
    await loginAs(page, sunil)
    await page.goto('/admin/users')
    await expect(page.getByTestId('users-page')).toBeVisible()

    // 1) Add (creates an auth user via the Edge Function).
    await page.getByTestId('add-employee-button').click()
    await page.getByTestId('new-emp-email').fill(NEW_EMAIL)
    await page.getByTestId('new-emp-password').fill('Neha#Demo2026')
    await page.getByTestId('new-emp-name').fill('Neha Test')
    await page.getByTestId('new-emp-code').fill('EMP900')
    await page.getByTestId('new-emp-dept').selectOption({ label: 'Engineering' })
    await page.getByTestId('new-emp-role-employee').check()
    await page.getByTestId('create-employee-submit').click()

    const row = page.getByTestId(`user-row-${NEW_EMAIL}`)
    await expect(row).toBeVisible({ timeout: 15_000 })

    // 2) Assign department/team/manager/role.
    await page.getByTestId(`edit-user-${NEW_EMAIL}`).click()
    await page.getByTestId('user-team-select').selectOption({ label: 'Platform' })
    await page.getByTestId('user-manager-select').selectOption({ label: sunil.fullName })
    await page.getByTestId('user-role-team_leader').check()
    await page.getByTestId('save-user-submit').click()
    await expect(row.getByText('Team Leader', { exact: true })).toBeVisible()

    // 3) Deactivate.
    await page.getByTestId(`edit-user-${NEW_EMAIL}`).click()
    await page.getByTestId('user-status-select').selectOption('inactive')
    await page.getByTestId('save-user-submit').click()
    await expect(row.getByTestId('user-status')).toHaveText('inactive')

    // 4) Reactivate.
    await page.getByTestId(`edit-user-${NEW_EMAIL}`).click()
    await page.getByTestId('user-status-select').selectOption('active')
    await page.getByTestId('save-user-submit').click()
    await expect(row.getByTestId('user-status')).toHaveText('active')

    // 5) Delete.
    await page.getByTestId(`delete-user-${NEW_EMAIL}`).click()
    await page.getByTestId('confirm-delete-user').click()
    await expect(page.getByTestId(`user-row-${NEW_EMAIL}`)).toHaveCount(0, { timeout: 15_000 })
  })

  test('new employee can sign in with the provisioned credentials', async ({ browser }) => {
    // Add a user as admin…
    const adminCtx = await browser.newContext()
    const adminPage = await adminCtx.newPage()
    await loginAs(adminPage, sunil)
    await adminPage.goto('/admin/users')
    await adminPage.getByTestId('add-employee-button').click()
    await adminPage.getByTestId('new-emp-email').fill('arjun@hrms.local')
    await adminPage.getByTestId('new-emp-password').fill('Arjun#Demo2026')
    await adminPage.getByTestId('new-emp-name').fill('Arjun New')
    await adminPage.getByTestId('new-emp-role-employee').check()
    await adminPage.getByTestId('create-employee-submit').click()
    await expect(adminPage.getByTestId('user-row-arjun@hrms.local')).toBeVisible({ timeout: 15_000 })
    await adminCtx.close()

    // …and that user can log in (no code changes needed to add people).
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await loginAs(page, { email: 'arjun@hrms.local', password: 'Arjun#Demo2026' })
    await expect(page.getByTestId('employee-dashboard')).toBeVisible()
    await ctx.close()
  })
})
