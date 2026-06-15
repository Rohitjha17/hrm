import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { loginAs } from './utils/auth'
import { aarti, sunil } from './utils/users'

test.describe('Phase 18 — announcements, recognition & visitors', () => {
  test('publish announcement (visible to all), award recognition, register visitor + pass', async ({ browser }) => {
    const adminCtx = await browser.newContext()
    const admin = await adminCtx.newPage()
    await loginAs(admin, sunil)

    // Announcement.
    await admin.goto('/announcements')
    await admin.getByTestId('new-announcement-button').click()
    await admin.getByTestId('announcement-category').selectOption('news')
    await admin.getByTestId('announcement-title').fill('Quarterly all-hands')
    await admin.getByTestId('announcement-body').fill('Join us Friday at 4pm.')
    await admin.getByTestId('publish-announcement').click()
    await expect(admin.getByTestId('announcement-card').filter({ hasText: 'Quarterly all-hands' })).toBeVisible()

    // Recognition.
    await admin.goto('/recognition')
    await admin.getByTestId('award-button').click()
    await admin.getByTestId('recognition-employee').selectOption({ label: aarti.fullName })
    await admin.getByTestId('recognition-award-type').selectOption('star_performer')
    await admin.getByTestId('recognition-note').fill('Outstanding quarter')
    await admin.getByTestId('award-recognition').click()
    await expect(admin.getByTestId('recognition-card').filter({ hasText: 'Aarti' })).toBeVisible()

    // Visitor + pass.
    await admin.goto('/admin/visitors')
    await admin.getByTestId('visitor-name').fill('Jane External')
    await admin.getByTestId('visitor-company').fill('Acme Inc')
    await admin.getByTestId('visitor-date').fill('2026-09-15')
    await admin.getByTestId('register-visitor').click()
    const vrow = admin.getByTestId('visitor-row').filter({ hasText: 'Jane External' })
    await expect(vrow).toBeVisible()
    const [pass] = await Promise.all([
      admin.waitForEvent('download'),
      vrow.getByTestId('generate-pass').click(),
    ])
    expect(fs.statSync(await pass.path()).size).toBeGreaterThan(0)
    await adminCtx.close()

    // Any employee sees the announcement.
    const empCtx = await browser.newContext()
    const emp = await empCtx.newPage()
    await loginAs(emp, aarti)
    await emp.goto('/announcements')
    await expect(emp.getByTestId('announcement-card').filter({ hasText: 'Quarterly all-hands' })).toBeVisible({ timeout: 10_000 })
    await empCtx.close()
  })
})
