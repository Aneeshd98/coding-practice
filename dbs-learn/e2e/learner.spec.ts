import { test as base, expect } from '@playwright/test'

const test = base.extend<{ errors: void }>({
  errors: [
    async ({ page }, use) => {
      const issues: string[] = []
      page.on('pageerror', (e) => issues.push(e.message))
      page.on('console', (m) => m.type() === 'error' && issues.push(m.text()))
      await use()
      expect(issues).toEqual([])
    },
    { auto: true },
  ],
})

test('a learner streams data, answers a checkpoint and completes the first lesson', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Where the lead sits')
  const clock = page.locator('.trace-foot .clock')
  const first = await clock.innerText()
  await expect(clock).not.toHaveText(first)
  await page.getByRole('tab', { name: 'Checkpoint' }).click()
  await page.getByRole('button', { name: /Contact 3/ }).click()
  await page.getByRole('button', { name: 'Check answer' }).click()
  await expect(page.getByText('Not quite')).toBeVisible()
  await expect(page.getByText('Contact 3 is the highest contact')).toBeVisible()
  await page.getByRole('button', { name: /Contact 0/ }).click()
  await page.getByRole('button', { name: 'Check answer' }).click()
  await page.getByRole('button', { name: 'Complete lesson' }).click()
  await page.getByRole('link', { name: 'Next lesson' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Why record between contacts')
  await page.reload()
  await page.getByRole('link', { name: 'Course map' }).click()
  await expect(page.getByRole('img', { name: '1 of 19 lessons complete' })).toBeVisible()
})

test('the sensing practical is graded from the live recording', async ({ page }) => {
  await page.goto('./#/lesson/find-beta-contacts')
  await page.getByRole('combobox', { name: 'Montage' }).selectOption('Adjacent pairs')
  await page.getByRole('tab', { name: 'Checkpoint' }).click()
  await page.getByRole('combobox', { name: /Which left adjacent pair/ }).selectOption('0–1')
  await page.getByRole('button', { name: 'Verify practical' }).click()
  await expect(page.locator('.practical .status')).toBeVisible()
  await page.waitForTimeout(8500)
  for (const pair of ['0–1', '1–2', '2–3']) {
    await page.getByRole('combobox', { name: /Which left adjacent pair/ }).selectOption(pair)
    await page.getByRole('button', { name: 'Verify practical' }).click()
    if (await page.getByText('Module practical passed', { exact: true }).isVisible()) break
  }
  await expect(page.getByText('Module practical passed', { exact: true })).toBeVisible()
})

test('the 3D brain loads its anatomy, and the target view shows the four contacts', async ({ page }) => {
  await page.goto('./#/lesson/lead-anatomy')
  const model = page.locator('.brain-card')
  await expect(model.locator('canvas')).toBeVisible()
  await expect(model.getByText('Loading anatomy…')).toHaveCount(0, { timeout: 20_000 })
  await expect(model.locator('[data-label="stnL"]')).toHaveText('Left STN')
  await model.getByRole('button', { name: 'Target', exact: true }).click()
  for (const c of ['0', '1', '2', '3']) await expect(model.locator(`[data-label="c${c}"]`)).toHaveText(c)
  await model.getByRole('button', { name: /Reveal β region/ }).click()
  await expect(model.locator('[data-label="edge"]')).toHaveText('β edge')
})

test('stimulation and burst tools render, and the narrow layout does not scroll sideways', async ({ page }) => {
  await page.goto('./#/lab')
  await page.getByRole('switch', { name: 'Stimulation on' }).check()
  await expect(page.locator('.patient .status-chip.stim')).toContainText('2.0 mA')
  await expect(page.locator('.brain-card .card-foot')).toContainText('L1 · R1 · 2.0 mA')
  await expect(page.getByRole('heading', { name: /Beta bursts/ })).toBeVisible()
  await page.setViewportSize({ width: 375, height: 800 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('adaptive DBS follows sensed beta and reports its energy use', async ({ page }) => {
  await page.goto('./#/lesson/close-the-loop')
  await page.getByRole('tab', { name: 'Experiment' }).click()
  await page.getByRole('switch', { name: 'Adaptive stimulation' }).check()
  await expect(page.locator('.patient .status-chip.stim')).toContainText('Adaptive · up to 3 mA')
  await page.getByRole('slider', { name: 'Threshold' }).fill('0.2')
  await expect(page.locator('.metric.stim').first()).toContainText(/[1-3]\.\d\d/, { timeout: 15_000 })
})

test('a monopolar review records thresholds and shows side effects as the amplitude rises', async ({ page }) => {
  await page.goto('./#/lesson/monopolar-review')
  await page.getByRole('tab', { name: 'Experiment' }).click()
  await page.getByRole('button', { name: 'Contact 3', exact: true }).click()
  const exam = page.locator('.exam')
  await expect(exam).toContainText('None observed')
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: '+0.5' }).click()
  await expect(exam).toContainText('Muscle contraction')
  await page.getByRole('button', { name: /Record side-effect threshold/ }).click()
  await expect(page.locator('.table tr.current td').nth(1)).toHaveText('3.0 mA')
})

test('a directional lead estimates the beta direction, and a new patient returns to ring contacts', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 860 })
  await page.goto('./#/lesson/directional-sensing')
  await page.getByRole('tab', { name: 'Experiment' }).click()
  await page.getByRole('group', { name: 'Lead type' }).getByRole('button', { name: 'Directional' }).click()
  await page.getByLabel('Montage').selectOption('Segments')
  await expect(page.getByText(/Strongest L 1[abc]\/2[abc]/)).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('img', { name: /Left lead, directional beta by segment/ })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  await page.getByRole('button', { name: 'New patient' }).click()
  await expect(page.getByLabel('Montage')).toHaveValue('Sandwich pairs')
  await expect(page.getByText(/Ring contacts wrap all the way round/)).toBeVisible()
})
