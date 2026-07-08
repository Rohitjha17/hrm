import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { loginAs } from './utils/auth'
import { sunil } from './utils/users'

test.describe('Phase 11 — recruitment & hiring', () => {
  test('opening → candidate → interview → feedback → offer approval → letter → joined', async ({ page }) => {
    await loginAs(page, sunil)
    await page.goto('/admin/recruitment')
    await expect(page.getByTestId('recruitment-page')).toBeVisible()

    // Opening (department + designation, no free-text title).
    await page.getByTestId('new-opening-button').click()
    await page.getByTestId('opening-department').selectOption({ index: 1 })
    await page.getByTestId('opening-designation').fill('Senior Engineer')
    await page.getByTestId('create-opening-submit').click()
    await page.getByTestId('opening-item').filter({ hasText: 'Senior Engineer' }).click()

    // Candidate.
    await page.getByTestId('add-candidate-button').click()
    await page.getByTestId('candidate-name').fill('Cara Diaz')
    await page.getByTestId('candidate-email').fill('cara@example.com')
    await page.getByTestId('create-candidate-submit').click()
    const row = page.getByTestId('candidate-row').filter({ hasText: 'Cara Diaz' })
    await expect(row).toBeVisible()

    // Schedule interview.
    await row.getByTestId('manage-candidate').click()
    await expect(page.getByTestId('candidate-modal')).toBeVisible()
    await page.getByTestId('interview-date').fill('2026-07-01T10:00')
    await page.getByTestId('interview-interviewer').selectOption({ label: sunil.fullName })
    await page.getByTestId('schedule-interview').click()
    await expect(page.getByTestId('interview-row')).toHaveCount(1)

    // Record feedback.
    const iv = page.getByTestId('interview-row').first()
    await iv.getByTestId('feedback-rating').selectOption('5')
    await iv.getByTestId('feedback-recommendation').selectOption('proceed')
    await iv.getByTestId('feedback-text').fill('Strong candidate')
    await iv.getByTestId('save-feedback').click()

    // Select + send offer for approval (routes through the workflow engine).
    await page.getByTestId('candidate-status-select').selectOption('selected')
    await page.getByTestId('send-offer').click()
    await expect(page.getByTestId('offer-status')).toContainText('pending')

    // Approve the offer in the Approvals inbox.
    await page.goto('/approvals')
    const inst = page.getByTestId('instance-row').filter({ hasText: 'Offer: Cara Diaz' })
    await expect(inst).toBeVisible({ timeout: 10_000 })
    await inst.getByTestId('approve-instance').click()
    await expect(inst.getByTestId('instance-status')).toHaveText('approved', { timeout: 10_000 })

    // Back to the candidate: offer approved → generate letter → mark joined.
    await page.goto('/admin/recruitment')
    await page.getByTestId('opening-item').filter({ hasText: 'Senior Engineer' }).click()
    const row2 = page.getByTestId('candidate-row').filter({ hasText: 'Cara Diaz' })
    await row2.getByTestId('manage-candidate').click()
    await expect(page.getByTestId('offer-status')).toContainText('approved', { timeout: 10_000 })

    const [pdf] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('generate-offer-letter').click(),
    ])
    expect(fs.statSync(await pdf.path()).size).toBeGreaterThan(0)

    await page.getByTestId('candidate-status-select').selectOption('joined')
    await page.getByTestId('close-candidate').click()
    await expect(row2.getByTestId('candidate-status')).toContainText('joined')
  })
})
