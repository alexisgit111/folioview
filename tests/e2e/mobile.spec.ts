import { expect, test, type Page } from '@playwright/test'
import { announcer, noHorizontalOverflow, openDemo, trackErrors, uploadFixture, waitForFlipbook } from './helpers'

/** Real touch events via the DevTools protocol (not mouse emulation). */
async function swipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 8) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] })
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps }],
    })
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
}

test.describe('mobile', () => {
  test('dashboard fits the screen', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/')
    await expect(page.getByTestId('choose-pdf')).toBeVisible()
    await noHorizontalOverflow(page)
    expect(errors).toEqual([])
  })

  test('viewer defaults to single-page and swipes between pages', async ({ page }) => {
    const errors = trackErrors(page)
    await openDemo(page, 'harbourview')
    await expect(page.getByRole('radio', { name: 'Single page' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.locator('.single-stage .pdf-page')).toHaveAttribute('data-status', 'rendered')
    await expect(page.locator('.thumb-rail')).toBeHidden()
    await noHorizontalOverflow(page)

    const stage = (await page.getByTestId('single-stage').boundingBox())!
    const y = stage.y + stage.height / 2
    await swipe(page, { x: stage.x + stage.width * 0.85, y }, { x: stage.x + stage.width * 0.15, y })
    await expect.poll(() => announcer(page)).toBe('Page 2 of 12')
    await swipe(page, { x: stage.x + stage.width * 0.15, y }, { x: stage.x + stage.width * 0.85, y })
    await expect.poll(() => announcer(page)).toBe('Page 1 of 12')

    // touch targets are at least 44px
    const next = await page.getByRole('navigation', { name: 'Page navigation' }).getByRole('button', { name: 'Next page' }).boundingBox()
    expect(next!.width).toBeGreaterThanOrEqual(44)
    expect(next!.height).toBeGreaterThanOrEqual(44)
    expect(errors).toEqual([])
  })

  test('flipbook on a phone shows one page and turns with touch', async ({ page }) => {
    const errors = trackErrors(page)
    await openDemo(page, 'harbourview')
    await page.getByRole('radio', { name: 'Flipbook' }).click()
    await waitForFlipbook(page)
    await expect(page.locator('.flipbook-stage')).toHaveAttribute('data-orientation', 'portrait')
    await noHorizontalOverflow(page)

    const book = (await page.locator('.stf__block').boundingBox())!
    const y = book.y + book.height * 0.8
    // a quick flick, as a reader would do it
    await swipe(page, { x: book.x + book.width - 20, y }, { x: book.x + 20, y }, 4)
    await expect.poll(() => announcer(page)).toBe('Page 2 of 12')
    // Chrome swallows the first tap after a fling gesture (tap-to-stop-fling).
    await page.waitForTimeout(1500)
    await page.getByRole('navigation', { name: 'Page navigation' }).getByRole('button', { name: 'Next page' }).tap()
    await expect.poll(() => announcer(page)).toBe('Page 3 of 12')
    expect(errors).toEqual([])
  })

  test('presentation: tap advances, works with or without fullscreen', async ({ page }) => {
    await openDemo(page, 'deck')
    await page.getByRole('button', { name: 'Present fullscreen' }).tap()
    await expect(page).toHaveURL(/\/present/)
    await expect(page.locator('.present-root .pdf-page').first()).toHaveAttribute('data-status', 'rendered')
    const vp = page.viewportSize()!
    await page.getByTestId('present-stage').tap({ position: { x: vp.width * 0.8, y: vp.height / 2 } })
    await expect(page.getByTestId('present-indicator')).toHaveText('2 / 7')
    const slide = await page.locator('[aria-label="Slide 2 of 7"]').boundingBox()
    expect(slide!.width).toBeLessThanOrEqual(vp.width)
    expect(slide!.width / slide!.height).toBeCloseTo(960 / 540, 1)
  })

  test('corrupted file error is readable on a phone', async ({ page }) => {
    await page.goto('/')
    await uploadFixture(page, 'corrupt.pdf')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const box = (await dialog.boundingBox())!
    expect(box.width).toBeLessThanOrEqual(page.viewportSize()!.width)
    await noHorizontalOverflow(page)
  })
})
