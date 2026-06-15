import { expect, type Locator, type Page } from '@playwright/test'

export class LoginPage {
  readonly page: Page
  readonly form: Locator
  readonly email: Locator
  readonly password: Locator
  readonly submit: Locator
  readonly error: Locator
  readonly health: Locator

  constructor(page: Page) {
    this.page = page
    this.form = page.getByTestId('login-form')
    this.email = page.getByTestId('login-email')
    this.password = page.getByTestId('login-password')
    this.submit = page.getByTestId('login-submit')
    this.error = page.getByTestId('login-error')
    this.health = page.getByTestId('health-status')
  }

  async goto() {
    await this.page.goto('/login')
    await expect(this.form).toBeVisible()
  }

  async login(email: string, password: string) {
    await this.email.fill(email)
    await this.password.fill(password)
    await this.submit.click()
  }

  async expectBackendConnected() {
    await expect(this.health).toHaveAttribute('data-status', 'connected', { timeout: 15_000 })
  }
}
