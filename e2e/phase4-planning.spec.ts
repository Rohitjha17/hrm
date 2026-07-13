import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Browser, type Page } from '@playwright/test'
import { loginAs } from './utils/auth'
import { aarti, raj, sunil } from './utils/users'
import { adminClient } from './utils/supabase'

const OFFICE = { latitude: 22.745618, longitude: 75.8933851 }
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
const YESTERDAY = new Date(new Date(`${TODAY}T00:00:00Z`).getTime() - 86_400_000)
  .toISOString()
  .slice(0, 10)

const SHOT_DIR = 'test-results/regression-screens'

async function shot(page: Page, name: string) {
  fs.mkdirSync(SHOT_DIR, { recursive: true })
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: true })
}

async function userId(email: string): Promise<string> {
  const admin = adminClient()
  const { data: u } = await admin.from('profiles').select('id').eq('email', email).single()
  return u!.id
}

// Give a user a worked (punched in + out) previous day with no planning yet.
async function seedYesterdayAttendance(email: string) {
  const admin = adminClient()
  const uid = await userId(email)
  await admin.from('attendance_punches').delete().eq('user_id', uid).eq('work_date', YESTERDAY)
  await admin.from('attendance_days').delete().eq('user_id', uid).eq('work_date', YESTERDAY)
  await admin.from('planning_compliance').delete().eq('user_id', uid).eq('work_date', YESTERDAY)
  await admin.from('planning_slots').delete().eq('user_id', uid).eq('plan_date', YESTERDAY)
  await admin.from('attendance_punches').insert([
    { user_id: uid, punch_type: 'in', punched_at: `${YESTERDAY}T10:00:00+05:30`, work_date: YESTERDAY, within_radius: true },
    { user_id: uid, punch_type: 'out', punched_at: `${YESTERDAY}T18:30:00+05:30`, work_date: YESTERDAY, within_radius: true },
  ])
  await admin.rpc('recompute_attendance_day', { p_user: uid, p_date: YESTERDAY })
  return uid
}

async function cleanYesterday(uid: string) {
  const admin = adminClient()
  await admin.from('attendance_punches').delete().eq('user_id', uid).eq('work_date', YESTERDAY)
  await admin.from('attendance_days').delete().eq('user_id', uid).eq('work_date', YESTERDAY)
  await admin.from('planning_compliance').delete().eq('user_id', uid).eq('work_date', YESTERDAY)
  await admin.from('planning_slots').delete().eq('user_id', uid).eq('plan_date', YESTERDAY)
}

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

    // Add a flexible slot (fixed-length window starting at any chosen time).
    await page.getByTestId('new-slot-start').fill('09:00')
    await page.getByTestId('add-slot').click()

    const card = page.locator('[data-testid^="slot-card-"]').first()
    await expect(card).toBeVisible({ timeout: 10_000 })
    const task = card.locator('[data-testid^="slot-task-"]')
    await task.fill('Draft the report')
    await card.locator('[data-testid^="slot-save-"]').click()
    const history = card.locator('[data-testid^="slot-history-"]')
    await expect(history).toBeVisible({ timeout: 10_000 })

    // Edit the slot → recorded in history.
    await task.fill('Draft the report (v2)')
    await card.locator('[data-testid^="slot-save-"]').click()

    await history.click()
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

    // Unlock demands a remark: save stays disabled until one is entered.
    await expect(adminPage.getByTestId('unlock-modal')).toBeVisible()
    await expect(adminPage.getByTestId('unlock-save')).toBeDisabled()
    await adminPage.getByTestId('unlock-remark').fill('Client escalation ate the afternoon')
    await adminPage.getByTestId('unlock-save').click()
    await expect(adminPage.getByTestId(`compliance-${raj.email}`)).toHaveAttribute(
      'data-compliant',
      'true',
      { timeout: 10_000 },
    )
    await expect(adminPage.getByTestId(`unlock-remark-${raj.email}`)).toContainText('escalation')

    // Raj retries punch out → now allowed (modal closes on success).
    await rajPage.getByTestId('capture-punch-button').click()
    await expect(rajPage.getByTestId('punch-modal')).toBeHidden({ timeout: 15_000 })

    await rajCtx.close()
    await adminCtx.close()
  })

  test('completing day-end planning lets the employee punch out', async ({ browser }) => {
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

  test('planned slots render as a list with labelled history (Slot / Planning / Outcome)', async ({ page }) => {
    await loginAs(page, aarti)
    await page.goto('/planning')

    // Plan a fresh future date so the list starts empty.
    const future = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)
    await page.getByTestId('plan-date').fill(future)

    await page.getByTestId('new-slot-start').fill('09:00')
    await page.getByTestId('new-slot-end').fill('11:00')
    await page.getByTestId('add-slot').click()
    await page.getByTestId('new-slot-start').fill('11:00')
    await page.getByTestId('new-slot-end').fill('13:00')
    await page.getByTestId('add-slot').click()

    // Slots live in a single list, one row per slot.
    await expect(page.getByTestId('slots-list')).toBeVisible()
    await expect(page.getByTestId('slots-list').locator('[data-testid^="slot-card-"]')).toHaveCount(2)
    await shot(page, 'planning-slots-list-view')

    // Edit a slot twice so history has planning + outcome to show.
    const row = page.getByTestId('slot-card-0')
    await row.locator('[data-testid^="slot-task-"]').fill('Write the API spec')
    await row.locator('[data-testid^="slot-save-"]').click()
    await row.locator('[data-testid^="slot-progress-"]').fill('60')
    await row.locator('[data-testid^="slot-remarks-"]').fill('halfway there')
    await row.locator('[data-testid^="slot-save-"]').click()

    await row.locator('[data-testid^="slot-history-"]').click()
    const modal = page.getByTestId('planning-history-modal')
    await expect(modal).toBeVisible()
    const entry = page.getByTestId('planning-history-entry').first()
    await expect(entry).toContainText('Slot')
    await expect(entry).toContainText('Planning')
    await expect(entry).toContainText('Outcome')
    await expect(entry.getByTestId('history-slot')).toContainText('09:00–11:00')
    await expect(entry.getByTestId('history-planning')).toContainText('Write the API spec')
    await expect(entry.getByTestId('history-outcome')).toContainText('60% done')
    await expect(entry.getByTestId('history-outcome')).toContainText('halfway there')
    await shot(page, 'planning-history-labels')
  })

  test('punch-in is locked when yesterday is unplanned; admin unlock requires a remark', async ({ browser }) => {
    await resetTodayFor(raj.email)
    const uid = await seedYesterdayAttendance(raj.email) // worked yesterday, planned nothing

    const { context: rajCtx, page: rajPage } = await openApp(browser)
    await loginAs(rajPage, raj)
    await rajPage.goto('/attendance')

    // The lock is visible before any punch attempt…
    await expect(rajPage.getByTestId('punch-lock-banner')).toBeVisible({ timeout: 10_000 })
    await shot(rajPage, 'attendance-punch-in-locked')

    // …and the punch itself is rejected server-side.
    await rajPage.getByTestId('punch-button').click()
    await rajPage.getByTestId('capture-punch-button').click()
    await expect(rajPage.getByTestId('punch-error')).toBeVisible()
    await expect(rajPage.getByTestId('punch-error')).toContainText(/previous day/i)

    // Admin unlocks yesterday — remark is mandatory.
    const adminCtx = await browser.newContext()
    const adminPage = await adminCtx.newPage()
    await loginAs(adminPage, sunil)
    await adminPage.goto('/admin/planning')
    await adminPage.getByTestId('planning-admin-date').fill(YESTERDAY)
    await adminPage.getByTestId(`unlock-${raj.email}`).click()
    await expect(adminPage.getByTestId('unlock-modal')).toBeVisible()
    await expect(adminPage.getByTestId('unlock-save')).toBeDisabled()
    await adminPage.getByTestId('unlock-remark').fill('Missed planning due to network outage')
    await adminPage.getByTestId('unlock-save').click()
    await expect(adminPage.getByTestId(`compliance-${raj.email}`)).toHaveAttribute(
      'data-compliant',
      'true',
      { timeout: 10_000 },
    )
    await shot(adminPage, 'planning-admin-unlocked-with-remark')

    // The remark is stored on the compliance row.
    const admin = adminClient()
    const { data: comp } = await admin
      .from('planning_compliance')
      .select('unlocked, unlock_remarks')
      .eq('user_id', uid)
      .eq('work_date', YESTERDAY)
      .single()
    expect(comp!.unlocked).toBe(true)
    expect(comp!.unlock_remarks).toContain('network outage')

    // Raj can punch in now.
    await rajPage.getByTestId('capture-punch-button').click()
    await expect(rajPage.getByTestId('punch-modal')).toBeHidden({ timeout: 15_000 })

    await rajCtx.close()
    await adminCtx.close()
    await cleanYesterday(uid)
  })

  test('full-hours planning of the previous day lifts the punch-in lock without admin help', async ({ browser }) => {
    await resetTodayFor(aarti.email)
    const uid = await seedYesterdayAttendance(aarti.email)
    const admin = adminClient()

    // Day-end submitted but hours only partially planned → still locked.
    await admin.from('planning_compliance').upsert(
      { user_id: uid, work_date: YESTERDAY, day_end_submitted: true },
      { onConflict: 'user_id,work_date' },
    )
    await admin.from('planning_slots').insert({
      user_id: uid, plan_date: YESTERDAY, kind: 'day', slot_index: 0,
      slot_label: '10:00–12:00', task_name: 'Morning block', start_time: '10:00', end_time: '12:00',
    })

    const { context, page } = await openApp(browser)
    await loginAs(page, aarti)
    await page.goto('/attendance')
    await expect(page.getByTestId('punch-lock-banner')).toBeVisible({ timeout: 10_000 })

    // Cover the rest of the working window (10:00–18:30) → lock lifts.
    await admin.from('planning_slots').insert({
      user_id: uid, plan_date: YESTERDAY, kind: 'day', slot_index: 1,
      slot_label: '12:00–18:30', task_name: 'Afternoon block', start_time: '12:00', end_time: '18:30',
    })
    await page.reload()
    await expect(page.getByTestId('attendance-page')).toBeVisible()
    await expect(page.getByTestId('punch-lock-banner')).toHaveCount(0)

    await page.getByTestId('punch-button').click()
    await page.getByTestId('capture-punch-button').click()
    await expect(page.getByTestId('today-status')).toHaveAttribute('data-status', 'present', {
      timeout: 15_000,
    })

    await context.close()
    await cleanYesterday(uid)
  })
})
