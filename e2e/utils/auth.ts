import { expect, type Page } from '@playwright/test'
import { LoginPage } from '../pages/LoginPage'
import type { SeedUser } from './users'

/** Log in through the real UI and wait for the app shell to render. */
export async function loginAs(page: Page, user: SeedUser) {
  const login = new LoginPage(page)
  await login.goto()
  await login.login(user.email, user.password)
  await expect(page.getByTestId('app-main')).toBeVisible()
}

export async function signOut(page: Page) {
  await page.getByTestId('sign-out').click()
  await expect(page.getByTestId('login-form')).toBeVisible()
}
