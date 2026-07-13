import { test, expect } from '@playwright/test'
import { loginAs } from './utils/auth'
import { aarti, raj, sunil } from './utils/users'
import { adminClient, signedInClient } from './utils/supabase'

test.describe('Phase 13 — employee document management', () => {
  test('upload, categorize, version, and access-control documents', async ({ page }) => {
    await loginAs(page, sunil)
    await page.goto('/admin/documents')
    await expect(page.getByTestId('documents-page')).toBeVisible()

    // Upload a PAN document for Raj.
    await page.getByTestId('doc-employee-select').selectOption({ label: raj.fullName })
    await page.getByTestId('doc-type-select').selectOption('pan')
    await page.getByTestId('doc-title').fill('PAN Card')
    await page.getByTestId('doc-file').setInputFiles({
      name: 'pan.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('pan-document-content'),
    })
    await page.getByTestId('upload-document').click()

    const row = page.getByTestId('document-row').filter({ hasText: 'PAN Card' })
    await expect(row.first()).toBeVisible({ timeout: 10_000 })
    await expect(row.first().getByTestId('doc-category')).toHaveText('pan')
    await expect(row.first().getByTestId('doc-version')).toHaveText('v1')

    // Re-upload same category → version 2.
    await page.getByTestId('doc-title').fill('PAN Card (updated)')
    await page.getByTestId('doc-file').setInputFiles({
      name: 'pan2.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('pan-v2-content'),
    })
    await page.getByTestId('upload-document').click()
    await expect(
      page.getByTestId('document-row').filter({ hasText: 'PAN Card (updated)' }).getByTestId('doc-version'),
    ).toHaveText('v2', { timeout: 10_000 })

    // Access control at the data layer.
    const admin = adminClient()
    const { data: r } = await admin.from('profiles').select('id').eq('email', raj.email).single()

    const sunilClient = await signedInClient(sunil.email, sunil.password)
    const sunilSees = await sunilClient.from('employee_documents').select('id').eq('employee_id', r!.id)
    expect((sunilSees.data ?? []).length).toBeGreaterThanOrEqual(2)

    const aartiClient = await signedInClient(aarti.email, aarti.password)
    const aartiSees = await aartiClient.from('employee_documents').select('id')
    expect(aartiSees.data ?? []).toHaveLength(0) // sees only her own (none); never Raj's

    // Admin can delete any document (row + file).
    const v2row = page.getByTestId('document-row').filter({ hasText: 'PAN Card (updated)' })
    await v2row.getByTestId('delete-document').click()
    await expect(page.getByTestId('doc-delete-modal')).toBeVisible()
    await page.getByTestId('confirm-delete-document').click()
    await expect(v2row).toHaveCount(0, { timeout: 10_000 })
    // The v1 document is untouched.
    await expect(page.getByTestId('document-row').filter({ hasText: 'PAN Card' })).toHaveCount(1)
  })
})
