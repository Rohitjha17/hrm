import { test, expect } from '@playwright/test'
import { loginAs } from './utils/auth'
import { aarti, raj, sunil } from './utils/users'

test.describe('Phase 3 — task management', () => {
  test('employee creates a self task (assignee = self, always visible)', async ({ page }) => {
    await loginAs(page, aarti)
    await page.goto('/tasks')
    await expect(page.getByTestId('tasks-page')).toBeVisible()

    await page.getByTestId('new-task-button').click()
    await page.getByTestId('task-title-input').fill('Aarti self task')
    await page.getByTestId('create-task-submit').click()

    const row = page.getByTestId('task-row').filter({ hasText: 'Aarti self task' })
    await expect(row).toBeVisible()
    await expect(row.getByTestId('task-assignee')).toContainText('Aarti')
  })

  test('changing status records a history entry with remarks', async ({ page }) => {
    await loginAs(page, aarti)
    await page.goto('/tasks')
    await page.getByTestId('new-task-button').click()
    await page.getByTestId('task-title-input').fill('Status flow task')
    await page.getByTestId('create-task-submit').click()

    const row = page.getByTestId('task-row').filter({ hasText: 'Status flow task' })
    await expect(row).toBeVisible()
    await row.getByTestId('update-status-button').click()

    await expect(page.getByTestId('status-modal')).toBeVisible()
    await page.getByTestId('status-select').selectOption({ label: 'In Progress' })
    await page.getByTestId('status-remarks').fill('Kicking off the work')
    await page.getByTestId('save-status-submit').click()

    await expect(row.getByTestId('task-status')).toContainText('In Progress')

    // History shows both the creation and the status change (with remarks).
    await row.getByTestId('task-history-button').click()
    await expect(page.getByTestId('history-modal')).toBeVisible()
    const entries = page.getByTestId('history-entry')
    await expect(entries).toHaveCount(2)
    await expect(page.getByTestId('history-modal')).toContainText('Kicking off the work')
    await expect(page.getByTestId('history-modal')).toContainText('In Progress')
  })

  test('manager assigns a task and the employee sees it in real time', async ({ browser }) => {
    // Employee watching their task list.
    const empCtx = await browser.newContext()
    const empPage = await empCtx.newPage()
    await loginAs(empPage, raj)
    await empPage.goto('/tasks')
    await expect(empPage.getByTestId('tasks-page')).toBeVisible()
    await expect(empPage.getByTestId('task-row').filter({ hasText: 'Ship the release' })).toHaveCount(0)

    // Manager assigns a task to the employee.
    const mgrCtx = await browser.newContext()
    const mgrPage = await mgrCtx.newPage()
    await loginAs(mgrPage, sunil)
    await mgrPage.goto('/tasks')
    await mgrPage.getByTestId('new-task-button').click()
    await mgrPage.getByTestId('task-title-input').fill('Ship the release')
    await mgrPage.getByTestId('task-assignee-select').selectOption({ label: raj.fullName })
    await mgrPage.getByTestId('create-task-submit').click()

    // Appears on the employee's board without a manual refresh.
    const empRow = empPage.getByTestId('task-row').filter({ hasText: 'Ship the release' })
    await expect(empRow).toBeVisible({ timeout: 15_000 })
    await expect(empRow.getByTestId('task-assignee')).toContainText('Raj')

    await empCtx.close()
    await mgrCtx.close()
  })

  test('task status master is editable (add a new status)', async ({ page }) => {
    await loginAs(page, sunil)
    await page.goto('/tasks')
    await page.getByTestId('manage-statuses-button').click()
    await expect(page.getByTestId('status-master-modal')).toBeVisible()

    await page.getByTestId('new-status-name').fill('Blocked')
    await page.getByTestId('create-status-submit').click()
    await expect(page.getByTestId('status-master-modal')).toContainText('Blocked')

    // The new status is usable on a task.
    await page.getByTestId('modal-close').click()
    await page.getByTestId('new-task-button').click()
    await page.getByTestId('task-title-input').fill('Uses new status')
    await page.getByTestId('create-task-submit').click()
    const row = page.getByTestId('task-row').filter({ hasText: 'Uses new status' })
    await row.getByTestId('update-status-button').click()
    await expect(page.getByTestId('status-select')).toContainText('Blocked')
  })
})
