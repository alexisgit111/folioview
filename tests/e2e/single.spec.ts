import { expect, test, type Page } from '@playwright/test'
import { announcer, canvasHasInk, openDemo, trackErrors } from './helpers'

async function zoomPercent(page: Page) {
  const text = await page.locator('footer').getByText(/^\d+%$/).textContent()
  return parseInt(text ?? '0', 10)
}

test.describe('single-page mode', () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page, 'harbourview')
    await page.getByRole('radio', { name: 'Single page' }).click()
    await expect(page.locator('.single-stage .pdf-page')).toHaveAttribute('data-status', 'rendered')
  })

  test('renders the page sharply for the device pixel ratio', async ({ page }) => {
    expect(await canvasHasInk(page, '.single-stage canvas')).toBe(true)
    const { cssW, pxW, dpr } = await page.locator('.single-stage canvas').evaluate((c: HTMLCanvasElement) => ({
      cssW: c.getBoundingClientRect().width,
      pxW: c.width,
      dpr: window.devicePixelRatio,
    }))
    expect(pxW / cssW).toBeCloseTo(dpr, 1)
  })

  test('zoom in, zoom out, fit width and fit page', async ({ page }) => {
    const errors = trackErrors(page)
    const fitPage = await zoomPercent(page)
    await page.getByRole('button', { name: 'Zoom in' }).click()
    await expect.poll(() => zoomPercent(page)).toBeGreaterThan(fitPage)
    const afterClick = await zoomPercent(page)
    await page.keyboard.press('+')
    await expect.poll(() => zoomPercent(page)).toBeGreaterThan(afterClick)
    const zoomed = await zoomPercent(page)
    await page.keyboard.press('-')
    await expect.poll(() => zoomPercent(page)).toBeLessThan(zoomed)

    await page.getByRole('button', { name: 'Fit width' }).click()
    await expect(page.getByRole('button', { name: 'Fit width' })).toHaveAttribute('aria-pressed', 'true')
    const stage = await page.getByTestId('single-stage').boundingBox()
    await expect.poll(async () => (await page.locator('.single-stage .pdf-page').boundingBox())!.width)
      .toBeGreaterThan(stage!.width - 80)

    await page.getByRole('button', { name: 'Fit page' }).click()
    await expect.poll(() => zoomPercent(page)).toBe(fitPage)
    const pageBox = await page.locator('.single-stage .pdf-page').boundingBox()
    expect(pageBox!.height).toBeLessThanOrEqual(stage!.height)
    expect(errors).toEqual([])
  })

  test('thumbnail rail navigates and highlights the current page', async ({ page }) => {
    await page.getByRole('button', { name: 'Go to page 5' }).click()
    expect(await announcer(page)).toBe('Page 5 of 12')
    await expect(page.getByRole('button', { name: 'Go to page 5' })).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('.single-stage .pdf-page')).toHaveAttribute('data-rendered-page', '4')
    await page.getByRole('button', { name: 'Hide thumbnails' }).click()
    await expect(page.locator('.thumb-rail')).toHaveCount(0)
  })

  test('keyboard and buttons move one page at a time', async ({ page }) => {
    await page.keyboard.press('ArrowRight')
    expect(await announcer(page)).toBe('Page 2 of 12')
    await page.keyboard.press('PageDown')
    expect(await announcer(page)).toBe('Page 3 of 12')
    await page.getByRole('navigation', { name: 'Page navigation' }).getByRole('button', { name: 'Previous page' }).click()
    expect(await announcer(page)).toBe('Page 2 of 12')
    await page.keyboard.press('End')
    expect(await announcer(page)).toBe('Page 12 of 12')
  })

  test('typing in the page box does not trigger shortcuts', async ({ page }) => {
    const input = page.getByTestId('page-input')
    await input.click()
    await input.press('ArrowRight')
    await input.press('-')
    expect(await announcer(page)).toBe('Page 1 of 12')
  })
})
