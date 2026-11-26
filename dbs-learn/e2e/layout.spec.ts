import { test, expect, type Page } from '@playwright/test'

/**
 * Layout regression checks that hold in any browser build: no sideways scrolling, no text
 * clipped inside controls, nothing escaping its card, and labels that do not collide.
 * Pixel snapshots differ between browser builds; these invariants do not.
 */
const WIDTHS = [320, 390, 768, 1024, 1280]
const PAGES = [
  { name: 'lesson guide', path: './#/lesson/bipolar-sensing' },
  { name: 'free lab', path: './#/lab' },
  { name: 'course map', path: './#/map' },
  { name: 'assessment', path: './#/assess' },
]

/** Elements whose text overflows a box that does not let it show (excluding intended ellipses). */
const clipped = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('main *, header *')]
      .filter((el) => {
        if (el.closest('svg, canvas, select, input, .viewport, .trace-area, .sr-only')) return false
        const s = getComputedStyle(el)
        if (s.display === 'none' || s.visibility === 'hidden' || !el.offsetParent) return false
        // Ellipses are intended, and a scrolling box keeps its content reachable.
        if (s.textOverflow === 'ellipsis' || s.overflowX === 'auto' || s.overflowX === 'scroll') return false
        const confined = s.whiteSpace === 'nowrap' || s.overflowX === 'hidden' || s.overflowX === 'clip'
        return confined && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0
      })
      .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${el.textContent?.trim().slice(0, 40)}" (${el.scrollWidth} > ${el.clientWidth})`),
  )

/** Visible elements that stick out past the right edge of the card that contains them. */
const escapes = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.card')].flatMap((card) => {
      const edge = card.getBoundingClientRect().right
      return [...card.querySelectorAll<HTMLElement>('*')]
        .filter((el) => {
          if (el.closest('svg, .viewport, .spectro-tip, option')) return false
          const r = el.getBoundingClientRect()
          return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && r.right > edge + 1
        })
        .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${el.textContent?.trim().slice(0, 30)}"`)
    }),
  )

for (const width of WIDTHS)
  for (const p of PAGES)
    test(`${p.name} at ${width}px has no overflow or clipped text`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(p.path)
      await page.waitForTimeout(1500)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
      expect(await clipped(page)).toEqual([])
      expect(await escapes(page)).toEqual([])
    })

test('the brain and trace cards line up at desktop width', async ({ page }) => {
  await page.goto('./#/lab')
  await page.waitForTimeout(1500)
  const [brain, traces] = await Promise.all([page.locator('.brain-card').boundingBox(), page.locator('.traces').boundingBox()])
  expect(Math.abs(brain!.y + brain!.height - (traces!.y + traces!.height))).toBeLessThanOrEqual(2)
})

test('3D labels other than contact numbers do not overlap', async ({ page }) => {
  await page.goto('./#/lesson/find-beta-contacts')
  await expect(page.locator('.label3d').first()).toBeVisible({ timeout: 20_000 })
  for (const view of ['Overview', 'Coronal', 'Sagittal', 'Target']) {
    await page.getByRole('button', { name: view, exact: true }).click()
    await page.waitForTimeout(1500)
    const overlaps = await page.evaluate(() => {
      const boxes = [...document.querySelectorAll<HTMLElement>('.label3d:not(.contact)')]
        .filter((el) => getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).opacity !== '0')
        .map((el) => ({ id: el.dataset.label, r: el.getBoundingClientRect() }))
      const hits: string[] = []
      boxes.forEach((a, i) =>
        boxes.slice(i + 1).forEach((b) => {
          if (a.r.left < b.r.right && b.r.left < a.r.right && a.r.top < b.r.bottom && b.r.top < a.r.bottom) hits.push(`${a.id} × ${b.id}`)
        }),
      )
      return hits
    })
    expect(overlaps, view).toEqual([])
  }
})
