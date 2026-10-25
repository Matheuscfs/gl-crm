import { expect, test } from './fixtures'

test.describe('on a phone', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })

  for (const path of ['/', '/agenda', '/pacientes', '/financeiro']) {
    test(`${path} has no horizontal scroll`, async ({ page }) => {
      await page.goto(path)
      await expect(page.getByRole('main')).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow).toBeLessThanOrEqual(0)
    })
  }
})

test('the dark theme is applied and survives a reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Conta de/ }).click()
  await page.getByRole('button', { name: 'Escuro' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})
