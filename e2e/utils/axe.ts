import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

/**
 * Assert no serious/critical accessibility violations on the current page.
 * Scoped to high-impact issues to keep the gate meaningful, not noisy.
 */
export async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()

  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  )

  if (serious.length > 0) {
    console.error(
      'A11y violations:',
      serious.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
    )
  }
  expect(serious, 'serious/critical a11y violations').toEqual([])
}
