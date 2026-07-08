import { test, expect } from '@playwright/test'
import { loginAs } from './utils/auth'
import { aarti, sunil } from './utils/users'

test.describe('Phase 10 — policies & workflow engine', () => {
  test('policy: create, publish two versions (history), employee acknowledges', async ({ browser }) => {
    const adminCtx = await browser.newContext()
    const admin = await adminCtx.newPage()
    await loginAs(admin, sunil)
    await admin.goto('/admin/policies')
    await expect(admin.getByTestId('policy-admin-page')).toBeVisible()

    await admin.getByTestId('new-policy-button').click()
    await admin.getByTestId('policy-category').selectOption('leave')
    await admin.getByTestId('policy-title').fill('Leave Policy')
    await admin.getByTestId('create-policy-submit').click()
    await admin.getByTestId('policy-item-leave').click()

    // Version 1.
    await admin.getByTestId('publish-version-button').click()
    await admin.getByTestId('version-content').fill('Apply for leave in advance.')
    await admin.getByTestId('publish-submit').click()
    await expect(admin.getByTestId('version-row')).toHaveCount(1)

    // Version 2 (change history).
    await admin.getByTestId('publish-version-button').click()
    await admin.getByTestId('version-content').fill('Apply for leave at least 2 working days in advance.')
    await admin.getByTestId('version-note').fill('Clarified notice period')
    await admin.getByTestId('publish-submit').click()
    await expect(admin.getByTestId('version-row')).toHaveCount(2)
    await adminCtx.close()

    // Employee reads + acknowledges the current version.
    const empCtx = await browser.newContext()
    const emp = await empCtx.newPage()
    await loginAs(emp, aarti)
    await emp.goto('/policies')
    await expect(emp.getByTestId('policy-card-leave')).toBeVisible()
    await emp.getByTestId('acknowledge-leave').click()
    await expect(emp.getByTestId('policy-acked-leave')).toBeVisible()
    await empCtx.close()
  })

  test('workflow: build a multi-step rulebook (view-only, no execution)', async ({ page }) => {
    await loginAs(page, sunil)
    await page.goto('/admin/workflows')
    await expect(page.getByTestId('workflow-admin-page')).toBeVisible()

    await page.getByTestId('new-definition-button').click()
    await page.getByTestId('definition-name').fill('Expense Approval')
    await page.getByTestId('create-definition-submit').click()
    await page.getByTestId('definition-item').filter({ hasText: 'Expense Approval' }).click()

    // Two levels.
    await page.getByTestId('step-name').fill('Manager')
    await page.getByTestId('step-permission').selectOption('leave.approve')
    await page.getByTestId('add-step').click()
    await expect(page.getByTestId('step-row')).toHaveCount(1)

    await page.getByTestId('step-name').fill('Finance')
    await page.getByTestId('step-permission').selectOption('salary.manage')
    await page.getByTestId('add-step').click()
    await expect(page.getByTestId('step-row')).toHaveCount(2)

    // Workflows are a rulebook, not an automation: no execution controls.
    await expect(page.getByTestId('start-instance')).toHaveCount(0)
    await expect(page.getByTestId('instance-title')).toHaveCount(0)

    // Steps can be removed (rulebook stays editable).
    await page.getByTestId('delete-step-2').click()
    await expect(page.getByTestId('step-row')).toHaveCount(1)
  })
})
