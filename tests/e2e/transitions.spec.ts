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

  test('transition style can be switched to fade and none, and is remembered', async ({ page }) => {
    await openSingle(page)
    const toggle = page.getByTestId('transition-toggle')
    await expect(toggle).toHaveAttribute('aria-label', /Page turn/)
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-label', /Fade/)
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-label', /No animation/)
    await page.keyboard.press('ArrowRight')
    await expect(page.locator('.single-stage .pdf-page')).toHaveAttribute('data-rendered-page', '1')
    await expect(overlay(page)).toHaveCount(0)
    await page.reload()
    await page.goto('/')
    await openSingle(page)
    await expect(page.getByTestId('transition-toggle')).toHaveAttribute('aria-label', /No animation/)
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
