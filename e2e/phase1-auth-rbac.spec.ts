import { test, expect } from '@playwright/test'
import { loginAs, signOut } from './utils/auth'
import { aarti, raj, sunil, riya } from './utils/users'
import { signedInClient } from './utils/supabase'

test.describe('Phase 1 — auth, RBAC, dual view & hierarchy', () => {
  test('Super Admin lands in Admin view; Employee lands in Employee view', async ({ page }) => {
    await loginAs(page, sunil)
    await expect(page.getByTestId('admin-dashboard')).toBeVisible()
    await expect(page.getByTestId('view-mode-toggle')).toBeVisible()
    await signOut(page)

    await loginAs(page, aarti)
    await expect(page.getByTestId('employee-dashboard')).toBeVisible()
    await expect(page.getByTestId('view-mode-toggle')).toHaveCount(0)
  })

  test('Super Admin can toggle between Employee and Admin views', async ({ page }) => {
    await loginAs(page, riya)
    await expect(page.getByTestId('admin-dashboard')).toBeVisible()
    await expect(page.getByTestId('nav-users')).toBeVisible()

    await page.getByTestId('view-mode-employee').click()
    await expect(page.getByTestId('employee-dashboard')).toBeVisible()
    await expect(page.getByTestId('nav-users')).toHaveCount(0)

    await page.getByTestId('view-mode-admin').click()
    await expect(page.getByTestId('admin-dashboard')).toBeVisible()
    await expect(page.getByTestId('nav-users')).toBeVisible()
  })

  test('Employees cannot reach admin routes (UI guard → Forbidden)', async ({ page }) => {
    await loginAs(page, raj)
    for (const route of ['/admin/users', '/admin/roles', '/admin/hierarchy', '/admin/audit']) {
      await page.goto(route)
      await expect(page.getByTestId('forbidden-page')).toBeVisible()
    }
  })

  test('Admin can create, configure permissions on, and delete a role', async ({ page }) => {
    await loginAs(page, sunil)
    await page.getByTestId('nav-roles').click()
    await expect(page.getByTestId('roles-page')).toBeVisible()

    // Create
    await page.getByTestId('new-role-button').click()
    await page.getByTestId('role-name-input').fill('QA Reviewer')
    await page.getByTestId('create-role-submit').click()
    const newRole = page.getByTestId('role-item-qa_reviewer')
    await expect(newRole).toBeVisible()

    // Configure a permission
    await newRole.click()
    const perm = page.getByTestId('perm-reports.view')
    await perm.click()
    await expect(perm).toBeChecked()
    // Persists across reload
    await page.reload()
    await page.getByTestId('role-item-qa_reviewer').click()
    await expect(page.getByTestId('perm-reports.view')).toBeChecked()

    // Delete
    await page.getByTestId('delete-role-qa_reviewer').click()
    await expect(page.getByTestId('role-item-qa_reviewer')).toHaveCount(0)
  })

  test('System roles cannot be deleted (no delete control)', async ({ page }) => {
    await loginAs(page, sunil)
    await page.goto('/admin/roles')
    await page.getByTestId('role-item-employee').click()
    await expect(page.getByTestId('delete-role-employee')).toHaveCount(0)
  })

  test('Admin can create a department and a team', async ({ page }) => {
    await loginAs(page, sunil)
    await page.goto('/admin/hierarchy')
    await expect(page.getByTestId('hierarchy-page')).toBeVisible()

    await page.getByTestId('new-department-button').click()
    await page.getByTestId('department-name-input').fill('Finance')
    await page.getByTestId('create-department-submit').click()
    await expect(page.getByTestId('departments-table').getByText('Finance')).toBeVisible()

    await page.getByTestId('new-team-button').click()
    await page.getByTestId('team-name-input').fill('Treasury')
    await page.getByTestId('create-team-submit').click()
    await expect(page.getByTestId('teams-table').getByText('Treasury')).toBeVisible()
  })

  test('Admin can assign a role to an employee', async ({ page }) => {
    await loginAs(page, sunil)
    await page.goto('/admin/users')
    await expect(page.getByTestId('users-page')).toBeVisible()

    await page.getByTestId(`edit-user-${raj.email}`).click()
    await expect(page.getByTestId('user-modal')).toBeVisible()
    await page.getByTestId('user-role-manager').check()
    await page.getByTestId('save-user-submit').click()

    const row = page.getByTestId(`user-row-${raj.email}`)
    await expect(row.getByText('Manager', { exact: true })).toBeVisible()
  })

  test('RLS enforces cross-role isolation at the data layer', async () => {
    const aartiClient = await signedInClient(aarti.email, aarti.password)
    const sunilClient = await signedInClient(sunil.email, sunil.password)

    // Employee sees only her own profile.
    const aartiProfiles = await aartiClient.from('profiles').select('email')
    expect(aartiProfiles.error).toBeNull()
    expect(aartiProfiles.data).toHaveLength(1)
    expect(aartiProfiles.data?.[0]?.email).toBe(aarti.email)

    // Super Admin sees everyone.
    const sunilProfiles = await sunilClient.from('profiles').select('email')
    expect((sunilProfiles.data?.length ?? 0)).toBeGreaterThanOrEqual(4)

    // Employee has no admin permission and cannot mutate roles.
    const perms = await aartiClient.rpc('my_permissions')
    expect(perms.data).not.toContain('*')
    const hack = await aartiClient.from('roles').insert({ slug: 'hack', name: 'Hack' })
    expect(hack.error).not.toBeNull()
  })
})
