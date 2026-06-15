import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { loginAs } from './utils/auth'
import { raj, sunil } from './utils/users'

test.describe('Phase 12 — onboarding', () => {
  test('create template, run the joining checklist, generate a document', async ({ page }) => {
    await loginAs(page, sunil)
    await page.goto('/admin/onboarding')
    await expect(page.getByTestId('onboarding-page')).toBeVisible()

    // Create a document template.
    await page.getByTestId('new-template-button').click()
    await page.getByTestId('tpl-doctype').selectOption('welcome')
    await page.getByTestId('tpl-title').fill('Welcome Letter')
    await page.getByTestId('tpl-body').fill('Welcome {{full_name}} to the team!')
    await page.getByTestId('create-template').click()
    await expect(page.getByTestId('template-row').filter({ hasText: 'Welcome Letter' })).toBeVisible()

    // Start onboarding for a new joiner → default checklist appears.
    await page.getByTestId('onboarding-employee-select').selectOption({ label: raj.fullName })
    await page.getByTestId('start-onboarding').click()
    await expect(page.getByTestId('checklist-item')).toHaveCount(7, { timeout: 10_000 })

    // Progress a checklist item.
    await page.getByTestId('item-status-pan').selectOption('verified')
    await expect(page.getByTestId('item-status-pan')).toHaveValue('verified')

    // Generate a document from the template.
    const [pdf] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('generate-doc-welcome').click(),
    ])
    expect(fs.statSync(await pdf.path()).size).toBeGreaterThan(0)
  })
})
