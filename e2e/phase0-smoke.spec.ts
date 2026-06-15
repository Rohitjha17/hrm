import { test, expect } from '@playwright/test'
import { LoginPage } from './pages/LoginPage'
import { expectNoSeriousA11yViolations } from './utils/axe'

test.describe('Phase 0 — foundation smoke', () => {
  test('unauthenticated user is redirected to /login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByTestId('login-form')).toBeVisible()
  })

  test('backend health check passes (centralized DB reachable)', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.expectBackendConnected()
  })

  test('login page renders without exposing any credentials', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await expect(login.email).toBeVisible()
    await expect(login.password).toBeVisible()
    await expect(login.submit).toBeVisible()

    // Hard requirement #3: never render demo/login credentials anywhere.
    const body = (await page.textContent('body'))?.toLowerCase() ?? ''
    for (const forbidden of [
      'demo credential',
      'demo login',
      'test@',
      'password:',
      'sunil',
      'riya',
      'aarti',
      'raj',
    ]) {
      expect(body, `login page must not contain "${forbidden}"`).not.toContain(forbidden)
    }
  })

  test('invalid credentials show an error and stay on /login', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.login('nobody@example.com', 'wrong-password')
    await expect(login.error).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test('login page has no serious accessibility violations', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await expectNoSeriousA11yViolations(page)
  })
})
