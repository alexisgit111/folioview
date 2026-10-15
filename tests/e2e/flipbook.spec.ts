import { expect, test } from '@playwright/test'
import { announcer, canvasHasInk, noHorizontalOverflow, openDemo, trackErrors, uploadFixture, waitForFlipbook } from './helpers'

test.describe('flipbook mode', () => {
  test('opens on the cover and turns pages with the keyboard', async ({ page }) => {
    const errors = trackErrors(page)
    await openDemo(page, 'harbourview')
    await expect(page.getByRole('radio', { name: 'Flipbook' })).toHaveAttribute('aria-checked', 'true')
    await waitForFlipbook(page)
    expect(await announcer(page)).toBe('Page 1 of 12')
    expect(await canvasHasInk(page, '.flipbook-page[data-page-index="0"] img')).toBe(true)

    await page.keyboard.press('ArrowRight')
    await expect.poll(() => announcer(page)).toBe('Pages 2–3 of 12')
    await page.keyboard.press('PageDown')
    await expect.poll(() => announcer(page)).toBe('Pages 4–5 of 12')
    await page.keyboard.press('PageUp')
    await expect.poll(() => announcer(page)).toBe('Pages 2–3 of 12')
    await page.keyboard.press('ArrowLeft')
    await expect.poll(() => announcer(page)).toBe('Page 1 of 12')
    expect(errors).toEqual([])
  })

  test('back cover sits on its own at the end, Home returns to the cover', async ({ page }) => {
    await openDemo(page, 'harbourview')
    await waitForFlipbook(page)
    await page.keyboard.press('End')
    await expect.poll(() => announcer(page)).toBe('Page 12 of 12')
    await expect(page.getByRole('button', { name: 'Next page' }).last()).toBeDisabled()
    await page.keyboard.press('Home')
    await expect.poll(() => announcer(page)).toBe('Page 1 of 12')
    await expect(page.getByRole('button', { name: 'Previous page' }).last()).toBeDisabled()
  })

  test('toolbar buttons and go-to-page navigate', async ({ page }) => {
    await openDemo(page, 'harbourview')
    await waitForFlipbook(page)
    await page.getByRole('navigation', { name: 'Page navigation' }).getByRole('button', { name: 'Next page' }).click()
    await expect.poll(() => announcer(page)).toBe('Pages 2–3 of 12')
    await page.getByTestId('page-input').fill('9')
    await page.getByTestId('page-input').press('Enter')
    await expect.poll(() => announcer(page)).toBe('Pages 8–9 of 12')
    await expect(page.getByTestId('page-indicator')).toHaveText('–9 / 12')
  })

  test('dragging the page corner with the mouse turns the page', async ({ page }) => {
    await openDemo(page, 'harbourview')
    await waitForFlipbook(page)
    const book = await page.locator('.stf__block').boundingBox()
    expect(book).not.toBeNull()
    const y = book!.y + book!.height * 0.85
    await page.mouse.move(book!.x + book!.width - 8, y)
    await page.mouse.down()
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(book!.x + book!.width - 8 - (book!.width * 0.7 * i) / 12, y - 10)
    }
    await page.mouse.up()
    await expect.poll(() => announcer(page)).toBe('Pages 2–3 of 12')
  })

  test('clicking the right-hand page turns forward', async ({ page }) => {
    await openDemo(page, 'harbourview')
    await waitForFlipbook(page)
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => announcer(page)).toBe('Pages 2–3 of 12')
    const book = await page.locator('.stf__block').boundingBox()
    await page.mouse.click(book!.x + book!.width * 0.92, book!.y + book!.height * 0.9)
    await expect.poll(() => announcer(page)).toBe('Pages 4–5 of 12')
  })

  test('landscape documents form landscape spreads', async ({ page }) => {
    await openDemo(page, 'portfolio')
    await waitForFlipbook(page)
    const first = await page.locator('.flipbook-page[data-page-index="0"]').boundingBox()
    expect(first!.width / first!.height).toBeCloseTo(842 / 595, 1)
  })

  test('resizing to a narrow window switches to single-page book and back', async ({ page }) => {
    const errors = trackErrors(page)
    await openDemo(page, 'harbourview')
    await waitForFlipbook(page)
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => announcer(page)).toBe('Pages 2–3 of 12')

    await page.setViewportSize({ width: 700, height: 1000 }) // narrow: one page at a time
    await expect(page.locator('.flipbook-stage')).toHaveAttribute('data-orientation', 'portrait')
    await waitForFlipbook(page)
    await expect.poll(() => announcer(page)).toMatch(/^Page [23] of 12$/)
    // the reader's chosen mode survives the resize
    await expect(page.getByRole('radio', { name: 'Flipbook' })).toHaveAttribute('aria-checked', 'true')
    await noHorizontalOverflow(page)

    await page.setViewportSize({ width: 1440, height: 900 })
    await expect(page.locator('.flipbook-stage')).toHaveAttribute('data-orientation', 'landscape')
    await waitForFlipbook(page)
    await expect.poll(() => announcer(page)).toBe('Pages 2–3 of 12')
    const block = await page.locator('.stf__block').boundingBox()
    const stage = await page.locator('.flipbook-stage').boundingBox()
    expect(block!.width).toBeLessThanOrEqual(stage!.width + 1)
    expect(block!.height).toBeLessThanOrEqual(stage!.height + 1)
    expect(errors).toEqual([])
  })

  test('respects reduced-motion preference', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openDemo(page, 'harbourview')
    await waitForFlipbook(page)
    await page.keyboard.press('ArrowRight')
    // without animation the change is effectively immediate
    await expect.poll(() => announcer(page), { timeout: 1000 }).toBe('Pages 2–3 of 12')
  })

  test('mode switch preserves the current page', async ({ page }) => {
    await openDemo(page, 'harbourview')
    await waitForFlipbook(page)
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => announcer(page)).toBe('Pages 4–5 of 12')
    await page.getByRole('radio', { name: 'Single page' }).click()
    await expect(page).toHaveURL(/mode=single/)
    expect(await announcer(page)).toBe('Page 4 of 12')
    await page.getByRole('radio', { name: 'Flipbook' }).click()
    await waitForFlipbook(page)
    await expect.poll(() => announcer(page)).toBe('Pages 4–5 of 12')
  })
})

test('turning pages never makes the window scroll (no scrollbar flicker)', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 760 })
  await page.goto('/')
  await uploadFixture(page, 'a4-landscape.pdf')
  await waitForFlipbook(page)
  await page.evaluate(() => {
    const w = window as unknown as { __over: number }
    w.__over = 0
    const tick = () => {
      const d = document.documentElement
      w.__over = Math.max(w.__over, d.scrollHeight - d.clientHeight, d.scrollWidth - d.clientWidth)
      requestAnimationFrame(tick)
    }
    tick()
  })
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(1200)
  }
  expect(await page.evaluate(() => (window as unknown as { __over: number }).__over)).toBe(0)
})
