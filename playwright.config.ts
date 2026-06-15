import { defineConfig, devices } from '@playwright/test'

/**
 * E2E config. Tests run SERIALLY (workers: 1) against ONE shared local Supabase
 * database, so state is deterministic. `globalSetup` resets + seeds the DB to a
 * known baseline before the suite. Chromium launches with fake-media flags so
 * live selfie capture (Phase 2) runs unattended.
 */
export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/pages/**', '**/utils/**'],
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  globalSetup: './e2e/global-setup.ts',
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['list']]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
            '--auto-accept-this-tab-capture',
          ],
        },
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
