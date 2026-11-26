import { test, expect, type Page } from '@playwright/test'

/**
 * Pixel snapshots of views that do not depend on the live signal, for checking a styling
 * change before and after. Browser builds render text slightly differently, so baselines
 * are kept per machine (e2e/.visual-baselines, not committed): the first run records them,
 * later runs compare. Run with `npm run test:visual`; the CI layout tests cover every build.
 */
const settle = async (page: Page) => {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(400)
}
const options = { maxDiffPixelRatio: 0.005, animations: 'disabled' as const }

test('course map', async ({ page }) => {
  await page.goto('./#/map')
  await settle(page)
  await expect(page.locator('.map-grid')).toHaveScreenshot('course-map.png', options)
})

test('lesson guide, desktop and phone', async ({ page }) => {
  await page.goto('./#/lesson/read-spectrum')
  await settle(page)
  await expect(page.locator('.lesson')).toHaveScreenshot('lesson-guide.png', options)
  await page.setViewportSize({ width: 390, height: 844 })
  await settle(page)
  await expect(page.locator('.lesson')).toHaveScreenshot('lesson-guide-phone.png', options)
})

test('prediction card and checkpoint feedback', async ({ page }) => {
  await page.goto('./#/lesson/movement-erd')
  await page.getByRole('tab', { name: 'Experiment' }).click()
  await settle(page)
  await expect(page.locator('.predict')).toHaveScreenshot('predict.png', options)
  await page.getByRole('tab', { name: 'Checkpoint' }).click()
  await page.getByRole('button', { name: /Right STN/ }).click()
  await page.getByRole('button', { name: 'Check answer' }).click()
  await expect(page.locator('.pane .feedback').last()).toHaveScreenshot('checkpoint-feedback.png', options)
})

test('assessment questions', async ({ page }) => {
  await page.goto('./#/assess')
  await settle(page)
  await expect(page.locator('.case-card')).toHaveScreenshot('assessment-card.png', options)
})

test('chronic beta timeline (a fixed patient, no live data)', async ({ page }) => {
  await page.goto('./#/lesson/daily-beta')
  await page.getByRole('tab', { name: 'Experiment' }).click()
  await page.getByRole('button', { name: 'Skip prediction' }).click()
  await settle(page)
  await expect(page.locator('.pane:not([hidden]) .tool').first()).toHaveScreenshot('chronic.png', options)
})
