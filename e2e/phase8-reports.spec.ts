import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { loginAs } from './utils/auth'
import { aarti, sunil } from './utils/users'
import { adminClient } from './utils/supabase'
import type { ReportType } from '../src/features/reports/hooks'

const TYPES: ReportType[] = ['attendance', 'leave', 'salary', 'task', 'appraisal']

async function seedReportData() {
  const admin = adminClient()
  const { data: a } = await admin.from('profiles').select('id').eq('email', aarti.email).single()
  const uid = a!.id
  await admin.from('attendance_days').upsert(
    [
      { user_id: uid, work_date: '2026-03-02', status: 'full_day', is_late: false, overtime_minutes: 0, worked_minutes: 510 },
      { user_id: uid, work_date: '2026-03-03', status: 'half_day', is_late: true, overtime_minutes: 0, worked_minutes: 260 },
    ],
    { onConflict: 'user_id,work_date' },
  )
  const { data: st } = await admin.from('task_statuses').select('id').eq('slug', 'pending').single()
  await admin.from('tasks').insert({ title: 'Report seed task', created_by: uid, assignee_id: uid, status_id: st!.id })
}

test.describe('Phase 8 — reports & export', () => {
  test('reports render and export to non-empty Excel + PDF', async ({ page }) => {
    await seedReportData()
    await loginAs(page, sunil)
    await page.goto('/admin/reports')
    await expect(page.getByTestId('reports-page')).toBeVisible()

    // Attendance report shows seeded rows.
    await expect(page.getByTestId('report-table')).toBeVisible()
    await expect(page.getByTestId('report-row').first()).toBeVisible()

    for (const type of TYPES) {
      await page.getByTestId(`report-tab-${type}`).click()
      await expect(page.getByTestId('reports-page')).toBeVisible()

      const [xlsx] = await Promise.all([
        page.waitForEvent('download'),
        page.getByTestId('export-excel').click(),
      ])
      expect(xlsx.suggestedFilename()).toContain('.xlsx')
      const xlsxPath = await xlsx.path()
      expect(fs.statSync(xlsxPath).size, `${type} xlsx size`).toBeGreaterThan(0)

      const [pdf] = await Promise.all([
        page.waitForEvent('download'),
        page.getByTestId('export-pdf').click(),
      ])
      expect(pdf.suggestedFilename()).toContain('.pdf')
      const pdfPath = await pdf.path()
      expect(fs.statSync(pdfPath).size, `${type} pdf size`).toBeGreaterThan(0)
    }
  })
})
