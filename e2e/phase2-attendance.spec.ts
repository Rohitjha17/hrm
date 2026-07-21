import { test, expect, type Browser } from '@playwright/test'
import { loginAs } from './utils/auth'
import { aarti, raj, sunil } from './utils/users'
import { adminClient, signedInClient } from './utils/supabase'

// Office coordinates from the spec, and a point clearly >50 m away.
const OFFICE = { latitude: 22.745618, longitude: 75.8933851 }
const FAR = { latitude: 22.747, longitude: 75.897 }

async function openApp(browser: Browser, geolocation: { latitude: number; longitude: number }) {
  const context = await browser.newContext({
    permissions: ['geolocation', 'camera'],
    geolocation,
  })
  const page = await context.newPage()
  return { context, page }
}

// The punch lock follows the user's last worked day, so the unplanned days
// seeded by the working-hours test would block punch-in. Unlock that day.
async function clearPunchLock(email: string) {
  const admin = adminClient()
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
  const { data: u } = await admin.from('profiles').select('id').eq('email', email).single()
  const { data: last } = await admin
    .from('attendance_days')
    .select('work_date')
    .eq('user_id', u!.id)
    .lt('work_date', today)
    .order('work_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (last) {
    await admin.from('planning_compliance').upsert(
      { user_id: u!.id, work_date: last.work_date, unlocked: true, unlock_remarks: 'e2e: clear lock' },
      { onConflict: 'user_id,work_date' },
    )
  }
}

test.describe('Phase 2 — attendance (GPS + selfie + realtime)', () => {
  test('working-hours engine classifies days from actual hours worked', async () => {
    const admin = adminClient()
    const { data: u } = await admin.from('profiles').select('id').eq('email', aarti.email).single()
    const uid = u!.id

    const cases = [
      ['2026-06-01', '10:00', '18:35', 'full_day', false, 0],
      ['2026-06-02', '10:30', '19:00', 'full_day', true, 0],
      ['2026-06-03', '10:00', '14:30', 'half_day', false, 0],
      ['2026-06-04', '10:00', '12:30', 'quarter_day', false, 0],
      ['2026-06-05', '10:00', '11:00', 'absent', false, 0],
      ['2026-06-06', '10:00', '20:00', 'full_day', false, 60],
    ] as const

    for (const [d, tin, tout, status, late, ot] of cases) {
      await admin.from('attendance_punches').insert([
        { user_id: uid, punch_type: 'in', punched_at: `${d}T${tin}:00+05:30`, work_date: d, within_radius: true },
        { user_id: uid, punch_type: 'out', punched_at: `${d}T${tout}:00+05:30`, work_date: d, within_radius: true },
      ])
      await admin.rpc('recompute_attendance_day', { p_user: uid, p_date: d })
      const { data: day } = await admin
        .from('attendance_days')
        .select('status,is_late,overtime_minutes')
        .eq('user_id', uid)
        .eq('work_date', d)
        .single()
      expect(day!.status, `status for ${d}`).toBe(status)
      expect(day!.is_late, `late for ${d}`).toBe(late)
      expect(day!.overtime_minutes, `ot for ${d}`).toBe(ot)
    }
  })

  test('employee punches in within radius (GPS + live selfie)', async ({ browser }) => {
    await clearPunchLock(aarti.email)
    const { context, page } = await openApp(browser, OFFICE)
    await loginAs(page, aarti)
    await page.goto('/attendance')
    await expect(page.getByTestId('attendance-page')).toBeVisible()

    await page.getByTestId('punch-button').click()
    await expect(page.getByTestId('punch-modal')).toBeVisible()
    await page.getByTestId('capture-punch-button').click()

    await expect(page.getByTestId('today-status')).toHaveAttribute('data-status', 'present', {
      timeout: 15_000,
    })
    await expect(page.getByTestId('punches-list').getByTestId('punch-row').first()).toBeVisible()
    // A selfie was captured and linked to the punch.
    await expect(page.getByTestId('punch-selfie').first()).toBeVisible()
    await context.close()
  })

  test('punch is rejected outside the 50 m radius (client gate)', async ({ browser }) => {
    const { context, page } = await openApp(browser, FAR)
    await loginAs(page, raj)
    await page.goto('/attendance')
    await page.getByTestId('punch-button').click()
    await page.getByTestId('capture-punch-button').click()
    await expect(page.getByTestId('punch-error')).toBeVisible()
    await expect(page.getByTestId('punch-error')).toContainText(/radius/i)
    await context.close()
  })

  test('server independently rejects out-of-radius punch (RPC gate)', async () => {
    const client = await signedInClient(aarti.email, aarti.password)
    const { data } = await client.rpc('attendance_punch', {
      p_type: 'in',
      p_lat: FAR.latitude,
      p_lng: FAR.longitude,
    })
    const result = data as { ok: boolean; reason?: string }
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('out_of_radius')
  })

  test('punch syncs to the admin monitor in real time', async ({ browser }) => {
    // Admin watching the live monitor.
    const adminCtx = await browser.newContext()
    const adminPage = await adminCtx.newPage()
    await loginAs(adminPage, sunil)
    await adminPage.goto('/admin/attendance')
    await expect(adminPage.getByTestId('attendance-monitor-page')).toBeVisible()
    await expect(adminPage.getByTestId(`monitor-row-${raj.email}`)).toHaveCount(0)

    // Employee punches in from another device/context.
    const { context: empCtx, page: empPage } = await openApp(browser, OFFICE)
    await loginAs(empPage, raj)
    await empPage.goto('/attendance')
    await empPage.getByTestId('punch-button').click()
    await empPage.getByTestId('capture-punch-button').click()
    await expect(empPage.getByTestId('today-status')).toHaveAttribute('data-status', 'present', {
      timeout: 15_000,
    })

    // Admin sees it appear WITHOUT a manual refresh (realtime → refetch).
    await expect(adminPage.getByTestId(`monitor-row-${raj.email}`)).toBeVisible({ timeout: 20_000 })

    await empCtx.close()
    await adminCtx.close()
  })
})
