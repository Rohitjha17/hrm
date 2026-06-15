import { test, expect } from '@playwright/test'
import { loginAs } from './utils/auth'
import { aarti, sunil } from './utils/users'
import { adminClient } from './utils/supabase'

test.describe('Phase 17 — helpdesk / ticketing', () => {
  test('raise → update → escalate a ticket; SLA breach flagged', async ({ browser }) => {
    // Seed an overdue (SLA-breached) ticket.
    const admin = adminClient()
    const { data: a } = await admin.from('profiles').select('id').eq('email', aarti.email).single()
    await admin.from('tickets').insert({
      raised_by: a!.id,
      category: 'salary',
      subject: 'Overdue payslip query',
      priority: 'high',
      status: 'open',
      sla_due_at: new Date(Date.now() - 3_600_000).toISOString(),
    })

    // Employee raises a ticket.
    const empCtx = await browser.newContext()
    const emp = await empCtx.newPage()
    await loginAs(emp, aarti)
    await emp.goto('/helpdesk')
    await emp.getByTestId('ticket-category').selectOption('it')
    await emp.getByTestId('ticket-subject').fill('Laptop will not boot')
    await emp.getByTestId('raise-ticket').click()
    await expect(emp.getByTestId('ticket-row').filter({ hasText: 'Laptop will not boot' })).toBeVisible()
    await empCtx.close()

    // Agent updates + escalates, and sees the SLA breach.
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await loginAs(page, sunil)
    await page.goto('/helpdesk')

    const row = page.getByTestId('ticket-row').filter({ hasText: 'Laptop will not boot' })
    await expect(row).toBeVisible({ timeout: 10_000 })
    await row.getByTestId('ticket-status-select').selectOption('in_progress')
    await expect(row.getByTestId('ticket-status')).toHaveText('in_progress', { timeout: 10_000 })
    await row.getByTestId('escalate-ticket').click()
    await expect(row.getByTestId('escalated-badge')).toBeVisible({ timeout: 10_000 })

    const breached = page.getByTestId('ticket-row').filter({ hasText: 'Overdue payslip query' })
    await expect(breached.getByTestId('sla-badge')).toBeVisible()

    await ctx.close()
  })
})
