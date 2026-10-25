import { test as base, expect } from '@playwright/test'

/** Monday 26 October 2026, 09:00 in Cascavel. The demo data has fixed dates, so the clock is fixed too. */
export const NOW = new Date('2026-10-26T09:00:00-03:00')

/**
 * Every test starts on a clean browser with the clock fixed, the onboarding guide already seen
 * and the 2D odontogram (the 3D one needs WebGL). Console errors fail the test.
 */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    await use(errors)
    expect(errors, 'no errors in the browser console').toEqual([])
  },
  page: async ({ page }, use) => {
    await page.clock.setFixedTime(NOW)
    await page.addInitScript(() => {
      localStorage.setItem('gl-onboarding-v1', '1')
      localStorage.setItem('gl-odonto-view', '2d')
    })
    await use(page)
  },
})

export { expect }
