import { test, expect, type Browser, type Page } from '@playwright/test'
import { loginAs } from './utils/auth'
import { aarti, raj, sunil } from './utils/users'
import { adminClient } from './utils/supabase'

const OFFICE = { latitude: 22.745618, longitude: 75.8933851 }
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())

// Own this test's slice of shared state: clear the user's attendance + planning
// compliance for today so the punch flow is deterministic regardless of which
// earlier specs punched this user in.
async function resetTodayFor(email: string) {
  const admin = adminClient()
  const { data: u } = await admin.from('profiles').select('id').eq('email', email).single()
  if (!u) return
  await admin.from('attendance_punches').delete().eq('user_id', u.id).eq('work_date', TODAY)
  await admin.from('attendance_days').delete().eq('user_id', u.id).eq('work_date', TODAY)
  await admin.from('planning_compliance').delete().eq('user_id', u.id).eq('work_date', TODAY)
}

async function openApp(browser: Browser) {
  const context = await browser.newContext({
    permissions: ['geolocation', 'camera'],
    geolocation: OFFICE,
  })
  const page = await context.newPage()
  return { context, page }
}

// Resilient to prior-suite state: punch in only if not already punched in.
async function ensurePunchedIn(page: Page) {
  await page.goto('/attendance')
  const label = await page.getByTestId('punch-button').textContent()
  if (label?.includes('Punch In')) {
    await page.getByTestId('punch-button').click()
    await page.getByTestId('capture-punch-button').click()
    await expect(page.getByTestId('punch-modal')).toBeHidden({ timeout: 15_000 })
  }
}

test.describe('Phase 4 — planning & mandatory policy', () => {
  test('employee plans a slot and edits are tracked in history', async ({ page }) => {
    await loginAs(page, aarti)
    await page.goto('/planning')
    await expect(page.getByTestId('planning-page')).toBeVisible()

    const task = page.getByTestId('slot-task-day-0')
    await task.fill('Draft the report')
    await page.getByTestId('slot-save-day-0').click()
    await expect(page.getByTestId('slot-history-day-0')).toBeVisible({ timeout: 10_000 })

    // Edit the slot → recorded in history.
    await task.fill('Draft the report (v2)')
    await page.getByTestId('slot-save-day-0').click()

    await page.getByTestId('slot-history-day-0').click()
    await expect(page.getByTestId('planning-history-modal')).toBeVisible()
    await expect(page.getByTestId('planning-history-entry').first()).toContainText('v2')
  })

  test('punch out is blocked until planning is complete; admin can unlock', async ({ browser }) => {
    await resetTodayFor(raj.email)
    const { context: rajCtx, page: rajPage } = await openApp(browser)
    await loginAs(rajPage, raj)
    await ensurePunchedIn(rajPage)

    // Attempt to punch out → blocked by the mandatory planning policy.
    await rajPage.getByTestId('punch-button').click()
    await rajPage.getByTestId('capture-punch-button').click()
    await expect(rajPage.getByTestId('punch-error')).toBeVisible()
    await expect(rajPage.getByTestId('punch-error')).toContainText(/Day-End|planning|unlock/i)

    // Admin unlocks Raj's planning (compliance flag recorded).
    const adminCtx = await browser.newContext()
    const adminPage = await adminCtx.newPage()
    await loginAs(adminPage, sunil)
    await adminPage.goto('/admin/planning')
    await expect(adminPage.getByTestId('planning-admin-page')).toBeVisible()
    await adminPage.getByTestId(`unlock-${raj.email}`).click()
    await expect(adminPage.getByTestId(`compliance-${raj.email}`)).toHaveAttribute(
      'data-compliant',
      'true',
      { timeout: 10_000 },
    )

    // Raj retries punch out → now allowed (modal closes on success).
    await rajPage.getByTestId('capture-punch-button').click()
    await expect(rajPage.getByTestId('punch-modal')).toBeHidden({ timeout: 15_000 })

    await rajCtx.close()
    await adminCtx.close()
  })

  test('completing day-end + next-day planning lets the employee punch out', async ({ browser }) => {
    await resetTodayFor(aarti.email)
    const { context, page } = await openApp(browser)
    await loginAs(page, aarti)
    await ensurePunchedIn(page)

    // Blocked first.
    await page.getByTestId('punch-button').click()
    await page.getByTestId('capture-punch-button').click()
    await expect(page.getByTestId('punch-error')).toBeVisible()
    await page.getByTestId('punch-modal').getByRole('button', { name: 'Cancel' }).click()

    // Complete planning.
    await page.goto('/planning')
    await page.getByTestId('submit-day-end').click()
    await page.getByTestId('submit-next-day').click()
    await expect(page.getByTestId('compliance-status')).toHaveAttribute('data-compliant', 'true', {
      timeout: 10_000,
    })

    // Punch out now succeeds.
    await page.goto('/attendance')
    await page.getByTestId('punch-button').click()
    await page.getByTestId('capture-punch-button').click()
    await expect(page.getByTestId('punch-modal')).toBeHidden({ timeout: 15_000 })

    await context.close()
  })
})
