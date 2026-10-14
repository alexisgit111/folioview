import { expect, test, type Page } from '@playwright/test'
import { announcer, openDemo, trackErrors } from './helpers'

const overlay = (page: Page) => page.locator('.page-transition-overlay')

async function openSingle(page: Page) {
  await openDemo(page, 'harbourview')
  await page.getByRole('radio', { name: 'Single page' }).click()
  await expect(page.locator('.single-stage .pdf-page')).toHaveAttribute('data-status', 'rendered')
}

test.describe('page transitions', () => {
  test('single page: turning a page animates the old sheet away, then cleans up', async ({ page }) => {
    const errors = trackErrors(page)
    await openSingle(page)
    await page.keyboard.press('ArrowRight')
    await expect(overlay(page)).toHaveCount(1)
    // the overlay is laid out exactly on top of the page (measured without its animation transform)
    const o = await overlay(page).evaluate((el) => ({ w: parseFloat(el.style.width), h: parseFloat(el.style.height) }))
    const p = (await page.locator('.single-stage .pdf-page').boundingBox())!
    expect(Math.abs(o.w - p.width)).toBeLessThan(2)
    expect(Math.abs(o.h - p.height)).toBeLessThan(2)
    await expect(overlay(page)).toHaveCount(0, { timeout: 5000 })
    await expect(page.locator('.single-stage .pdf-page')).toHaveAttribute('data-rendered-page', '1')
    expect(await announcer(page)).toBe('Page 2 of 12')
    expect(errors).toEqual([])
  })

  test('single page: rapid key presses never leave stray overlays', async ({ page }) => {
    await openSingle(page)
    for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight')
    await expect(page.locator('.single-stage .pdf-page')).toHaveAttribute('data-rendered-page', '6')
    await expect(overlay(page)).toHaveCount(0, { timeout: 5000 })
  })

  test('transition style is picked from a menu and remembered', async ({ page }) => {
    await openSingle(page)
    const picker = page.getByTestId('transition-toggle')
    await expect(picker).toHaveValue('turn')
    const options = await picker.locator('option').allTextContents()
    expect(options).toEqual(['Page turn', 'Slide', 'Zoom', 'Cube', 'Flip', 'Wipe', 'Cover / Stack', 'Reveal', 'Drop', 'Fade', 'No animation'])
    await picker.selectOption('none')
    await page.keyboard.press('ArrowRight')
    await expect(page.locator('.single-stage .pdf-page')).toHaveAttribute('data-rendered-page', '1')
    await expect(overlay(page)).toHaveCount(0)
    await page.reload()
    await page.goto('/')
    await openSingle(page)
    await expect(page.getByTestId('transition-toggle')).toHaveValue('none')
  })

  for (const style of ['slide', 'zoom', 'cube', 'flip', 'wipe', 'cover', 'reveal']) {
    test(`${style}: animates both ways, cleans up and leaves the page untouched`, async ({ page }) => {
      const errors = trackErrors(page)
      await openSingle(page)
      await page.getByTestId('transition-toggle').selectOption(style)
      const target = page.locator('.single-stage [data-transition-target]')
      for (const [key, expected] of [['ArrowRight', '1'], ['ArrowLeft', '0']] as const) {
        await page.keyboard.press(key)
        await expect(overlay(page)).toHaveCount(1)
        await expect(page.locator('.single-stage .pdf-page')).toHaveAttribute('data-rendered-page', expected)
        await page.waitForTimeout(150)
        // mid-animation something is actually moving
        const moving = await page.evaluate(() => document.getAnimations().filter((a) => !(a instanceof CSSAnimation) && !(a instanceof CSSTransition)).length)
        expect(moving).toBeGreaterThan(0)
        await expect(overlay(page)).toHaveCount(0, { timeout: 5000 })
        await expect.poll(() => page.evaluate(() => document.getAnimations().filter((a) => !(a instanceof CSSAnimation) && !(a instanceof CSSTransition)).length)).toBe(0)
        const st = await target.evaluate((el) => ({ t: getComputedStyle(el).transform, z: el.style.zIndex, o: el.style.transformOrigin }))
        expect(st).toEqual({ t: 'none', z: '', o: '' })
        // the stage gets its normal overflow back
        expect(await page.locator('.single-stage').evaluate((el) => el.style.overflow)).toBe('')
      }
      expect(errors).toEqual([])
    })
  }

  test('presentation: every style runs without errors', async ({ page }) => {
    const errors = trackErrors(page)
    await openDemo(page, 'deck')
    await page.getByRole('button', { name: 'Present fullscreen' }).click()
    await expect(page.locator('[aria-label="Slide 1 of 7"]')).toHaveAttribute('data-status', 'rendered')
    await page.mouse.move(400, 400)
    const picker = page.getByTestId('transition-toggle')
    let n = 1
    for (const style of ['slide', 'zoom', 'cube', 'flip', 'wipe', 'cover', 'reveal', 'drop', 'fade', 'turn']) {
      await page.mouse.move(400, 300 + (n % 2))
      await picker.selectOption(style)
      await page.keyboard.press('ArrowRight')
      n = n === 7 ? 7 : n + 1
      await expect(overlay(page)).toHaveCount(0, { timeout: 5000 })
      if (n === 7) {
        await page.keyboard.press('Home')
        n = 1
        await expect(overlay(page)).toHaveCount(0, { timeout: 5000 })
      }
    }
    expect(errors).toEqual([])
  })

  test('reduced motion turns animations off', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openSingle(page)
    await page.keyboard.press('ArrowRight')
    await expect(page.locator('.single-stage .pdf-page')).toHaveAttribute('data-rendered-page', '1')
    await expect(overlay(page)).toHaveCount(0)
  })

  test('presentation: slides turn with an animation', async ({ page }) => {
    const errors = trackErrors(page)
    await openDemo(page, 'deck')
    await page.getByRole('button', { name: 'Present fullscreen' }).click()
    await expect(page.locator('[aria-label="Slide 1 of 7"]')).toHaveAttribute('data-status', 'rendered')
    await page.keyboard.press('ArrowRight')
    await expect(overlay(page)).toHaveCount(1)
    await expect(overlay(page)).toHaveCount(0, { timeout: 5000 })
    await expect(page.getByTestId('present-indicator')).toHaveText('2 / 7')
    await page.keyboard.press('ArrowLeft')
    await expect(overlay(page)).toHaveCount(1)
    await expect(overlay(page)).toHaveCount(0, { timeout: 5000 })
    await page.mouse.move(400, 400)
    await expect(page.getByTestId('transition-toggle')).toBeVisible()
    expect(errors).toEqual([])
  })
})
