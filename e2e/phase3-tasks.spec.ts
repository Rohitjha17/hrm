import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import { loginAs } from './utils/auth'
import { aarti, raj, sunil } from './utils/users'

const SHOT_DIR = 'test-results/regression-screens'

async function shot(page: Page, name: string) {
  fs.mkdirSync(SHOT_DIR, { recursive: true })
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: true })
}

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

  test('completed tasks are hidden by default and revealed by the toggle', async ({ page }) => {
    await loginAs(page, aarti)
    await page.goto('/tasks')
    await page.getByTestId('new-task-button').click()
    await page.getByTestId('task-title-input').fill('Toggle visibility task')
    await page.getByTestId('create-task-submit').click()

    const row = page.getByTestId('task-row').filter({ hasText: 'Toggle visibility task' })
    await expect(row).toBeVisible()

    // Mark it completed — it disappears from the default (open tasks) view.
    await row.getByTestId('update-status-button').click()
    await page.getByTestId('status-select').selectOption({ label: 'Completed' })
    await page.getByTestId('save-status-submit').click()
    await expect(row).toHaveCount(0)
    await shot(page, 'tasks-completed-hidden')

    // The toggle reveals it again, marked with its terminal status.
    await expect(page.getByTestId('toggle-completed')).toContainText('Show completed')
    await page.getByTestId('toggle-completed').click()
    await expect(row).toBeVisible()
    await expect(row.getByTestId('task-status')).toContainText('Completed')
    await expect(page.getByTestId('toggle-completed')).toContainText('Hide completed')
    await shot(page, 'tasks-completed-shown')

    // Toggle back off hides it again.
    await page.getByTestId('toggle-completed').click()
    await expect(row).toHaveCount(0)
  })

  test('task entries show their date of creation', async ({ page }) => {
    await loginAs(page, aarti)
    await page.goto('/tasks')

    // The new-task form displays a read-only creation date (today).
    await page.getByTestId('new-task-button').click()
    const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD
    await expect(page.getByTestId('task-created-input')).toHaveValue(today)
    await expect(page.getByTestId('task-created-input')).toBeDisabled()

    await page.getByTestId('task-title-input').fill('Creation date task')
    await page.getByTestId('create-task-submit').click()

    // The task row shows when it was created.
    const row = page.getByTestId('task-row').filter({ hasText: 'Creation date task' })
    await expect(row).toBeVisible()
    await expect(row.getByTestId('task-created-at')).toContainText(String(new Date().getFullYear()))
    await shot(page, 'tasks-created-date-column')
  })

  test('assignee can update the due date of a task assigned to them', async ({ browser }) => {
    // Manager assigns a task to Raj with no due date.
    const mgrCtx = await browser.newContext()
    const mgrPage = await mgrCtx.newPage()
    await loginAs(mgrPage, sunil)
    await mgrPage.goto('/tasks')
    await mgrPage.getByTestId('new-task-button').click()
    await mgrPage.getByTestId('task-title-input').fill('Due date owned by assignee')
    await mgrPage.getByTestId('task-assignee-select').selectOption({ label: raj.fullName })
    await mgrPage.getByTestId('create-task-submit').click()
    await mgrCtx.close()

    // Raj (assignee, not creator) sets the due date from the update modal.
    const empCtx = await browser.newContext()
    const empPage = await empCtx.newPage()
    await loginAs(empPage, raj)
    await empPage.goto('/tasks')
    const row = empPage.getByTestId('task-row').filter({ hasText: 'Due date owned by assignee' })
    await expect(row).toBeVisible()
    await row.getByTestId('update-status-button').click()

    await expect(empPage.getByTestId('status-modal')).toBeVisible()
    await empPage.getByTestId('status-due-date').fill('2026-08-15')
    await empPage.getByTestId('save-status-submit').click()

    await expect(row).toContainText('due 15-08-2026')
    await shot(empPage, 'tasks-assignee-due-date')

    // And can change an existing due date too.
    await row.getByTestId('update-status-button').click()
    await expect(empPage.getByTestId('status-due-date')).toHaveValue('2026-08-15')
    await empPage.getByTestId('status-due-date').fill('2026-08-20')
    await empPage.getByTestId('save-status-submit').click()
    await expect(row).toContainText('due 20-08-2026')
    await empCtx.close()
  })

  test('admin can delete any task after confirmation', async ({ page }) => {
    await loginAs(page, sunil)
    await page.goto('/tasks')
    await page.getByTestId('new-task-button').click()
    await page.getByTestId('task-title-input').fill('Task to be deleted')
    await page.getByTestId('create-task-submit').click()

    const row = page.getByTestId('task-row').filter({ hasText: 'Task to be deleted' })
    await expect(row).toBeVisible()

    // Cancelling the dialog keeps the task.
    await row.getByTestId('delete-task-button').click()
    await expect(page.getByTestId('delete-task-dialog')).toBeVisible()
    await page.getByTestId('modal-close').click()
    await expect(row).toBeVisible()

    // Confirming removes it for good.
    await row.getByTestId('delete-task-button').click()
    await expect(page.getByTestId('delete-task-dialog')).toContainText('Task to be deleted')
    await page.getByTestId('delete-task-dialog-confirm').click()
    await expect(row).toHaveCount(0)
    await shot(page, 'tasks-admin-deleted')
  })

  test('employees do not get a delete control on tasks', async ({ page }) => {
    await loginAs(page, aarti)
    await page.goto('/tasks')
    await expect(page.getByTestId('task-row').first()).toBeVisible()
    await expect(page.getByTestId('delete-task-button')).toHaveCount(0)
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
