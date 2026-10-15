import { expect, test, type Page } from '@playwright/test'
import { canvasHasInk, openDemo, trackErrors } from './helpers'

const indicator = (page: Page) => page.getByTestId('present-indicator')

async function startPresenting(page: Page) {
  await openDemo(page, 'deck')
  await page.getByRole('button', { name: 'Present fullscreen' }).click()
  await expect(page).toHaveURL(/\/present/)
  await expect(page.locator('.present-root .pdf-page').first()).toHaveAttribute('data-status', 'rendered')
}

test.describe('presentation mode', () => {
  test('enters fullscreen and keeps the slide aspect ratio', async ({ page }) => {
    const errors = trackErrors(page)
    await startPresenting(page)
    const fullscreenEnabled = await page.evaluate(() => document.fullscreenEnabled)
    if (fullscreenEnabled) {
      await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true)
      await expect(page.locator('.present-root')).toHaveAttribute('data-fullscreen', 'true')
    }
    const slide = page.locator('[aria-label="Slide 1 of 7"]')
    const box = await slide.boundingBox()
    expect(box!.width / box!.height).toBeCloseTo(960 / 540, 1)
    expect(await canvasHasInk(page, '[aria-label="Slide 1 of 7"] canvas')).toBe(true)
    expect(errors).toEqual([])
  })

  test('arrow keys and PageUp/PageDown change slides', async ({ page }) => {
    await startPresenting(page)
    await expect(indicator(page)).toHaveText('1 / 7')
    await page.keyboard.press('ArrowRight')
    await expect(indicator(page)).toHaveText('2 / 7')
    await page.keyboard.press('PageDown')
    await expect(indicator(page)).toHaveText('3 / 7')
    await page.keyboard.press('PageUp')
    await expect(indicator(page)).toHaveText('2 / 7')
    await page.keyboard.press('ArrowLeft')
    await expect(indicator(page)).toHaveText('1 / 7')
    await page.keyboard.press('End')
    await expect(indicator(page)).toHaveText('7 / 7')
    await expect(page.getByRole('button', { name: 'Next slide' })).toBeDisabled()
  })

  test('a mouse click anywhere on the slide advances', async ({ page }) => {
    await startPresenting(page)
    const vw = page.viewportSize()!.width
    await page.getByTestId('present-stage').click({ position: { x: vw * 0.8, y: 300 } })
    await expect(indicator(page)).toHaveText('2 / 7')
    await page.getByTestId('present-stage').click({ position: { x: vw * 0.1, y: 300 } })
    await expect(indicator(page)).toHaveText('3 / 7')
    // right-click does nothing
    await page.getByTestId('present-stage').click({ button: 'right', position: { x: vw * 0.5, y: 300 } })
    await expect(indicator(page)).toHaveText('3 / 7')
  })

  test('Space / Enter go forward; Shift+Space / Backspace / arrows go back', async ({ page }) => {
    await startPresenting(page)
    await page.keyboard.press('Space')
    await expect(indicator(page)).toHaveText('2 / 7')
    await page.keyboard.press('Enter')
    await expect(indicator(page)).toHaveText('3 / 7')
    await page.keyboard.press('ArrowDown')
    await expect(indicator(page)).toHaveText('4 / 7')
    await page.keyboard.press('Shift+Space')
    await expect(indicator(page)).toHaveText('3 / 7')
    await page.keyboard.press('Backspace')
    await expect(indicator(page)).toHaveText('2 / 7')
    await page.keyboard.press('ArrowUp')
    await expect(indicator(page)).toHaveText('1 / 7')
  })

  test('typing a number and Enter jumps to that slide', async ({ page }) => {
    await startPresenting(page)
    await page.keyboard.press('5')
    await expect(page.getByTestId('present-jump')).toContainText('5')
    await page.keyboard.press('Enter')
    await expect(indicator(page)).toHaveText('5 / 7')
    await expect(page.getByTestId('present-jump')).toHaveCount(0)
    // backspace edits the number instead of going back
    await page.keyboard.press('2')
    await page.keyboard.press('7')
    await page.keyboard.press('Backspace')
    await expect(page.getByTestId('present-jump')).toContainText('2')
    await page.keyboard.press('Enter')
    await expect(indicator(page)).toHaveText('2 / 7')
    // out of range shows a message and stays put
    await page.keyboard.press('9')
    await page.keyboard.press('9')
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('present-jump')).toContainText('No slide 99')
    await expect(indicator(page)).toHaveText('2 / 7')
    await expect(page.getByTestId('present-jump')).toHaveCount(0, { timeout: 3000 })
    // after it clears, Enter turns the page again
    await page.keyboard.press('Enter')
    await expect(indicator(page)).toHaveText('3 / 7')
  })

  test('keys turn pages without bringing the toolbar back', async ({ page }) => {
    await startPresenting(page)
    await page.mouse.move(400, 400)
    await expect(page.locator('.present-root')).toHaveAttribute('data-controls', 'hidden', { timeout: 6000 })
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Space')
    await expect(indicator(page)).toHaveText('3 / 7')
    await page.waitForTimeout(300)
    await expect(page.locator('.present-root')).toHaveAttribute('data-controls', 'hidden')
  })

  test('transition settings panel: keeps controls up, and closing it does not turn the page', async ({ page }) => {
    await startPresenting(page)
    await page.mouse.move(400, 400)
    await page.getByTestId('transition-settings').click()
    await page.getByTestId('transition-panel').getByRole('button', { name: 'Cube', exact: true }).click()
    await page.waitForTimeout(3200)
    await expect(page.locator('.present-root')).toHaveAttribute('data-controls', 'visible')
    await page.getByTestId('present-stage').click({ position: { x: 300, y: 400 } })
    await expect(page.getByTestId('transition-panel')).toHaveCount(0)
    await expect(indicator(page)).toHaveText('1 / 7')
    await page.getByTestId('present-stage').click({ position: { x: 300, y: 400 } })
    await expect(indicator(page)).toHaveText('2 / 7')
  })

  test('? shows the shortcut list', async ({ page }) => {
    await startPresenting(page)
    await page.keyboard.press('Shift+Slash')
    await expect(page.getByTestId('present-help')).toBeVisible()
    await expect(page.getByTestId('present-help')).toContainText('Type a number, then Enter to jump')
    await page.keyboard.press('Shift+Slash')
    await expect(page.getByTestId('present-help')).toHaveCount(0)
  })

  test('controls fade when idle and return on movement', async ({ page }) => {
    await startPresenting(page)
    await page.mouse.move(400, 400)
    await expect(page.locator('.present-root')).toHaveAttribute('data-controls', 'visible')
    await expect(page.locator('.present-root')).toHaveAttribute('data-controls', 'hidden', { timeout: 6000 })
    await page.mouse.move(420, 420)
    await expect(page.locator('.present-root')).toHaveAttribute('data-controls', 'visible')
  })

  test('Escape exits and returns to the viewer on the same page', async ({ page }) => {
    await startPresenting(page)
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect(indicator(page)).toHaveText('3 / 7')
    // In real fullscreen the browser consumes Escape and fires fullscreenchange;
    // headless browsers may not, so exercise both paths.
    const inFullscreen = await page.evaluate(() => !!document.fullscreenElement)
    if (inFullscreen) await page.evaluate(() => document.exitFullscreen())
    else await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/\/viewer/)
    // flipbook shows the spread containing slide 3
    await expect(page.getByTestId('page-announcer')).toHaveText(/^(Page 3|Pages 2–3) of 7$/)
    await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false)
  })

  test('the End presentation button exits', async ({ page }) => {
    await startPresenting(page)
    await page.mouse.move(300, 300)
    await page.getByRole('button', { name: 'End presentation' }).click()
    await expect(page).toHaveURL(/\/viewer/)
  })

  test('falls back to a full-window presentation without the Fullscreen API', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false })
      Element.prototype.requestFullscreen = undefined as unknown as Element['requestFullscreen']
      delete (Element.prototype as unknown as { webkitRequestFullscreen?: unknown }).webkitRequestFullscreen
    })
    const errors = trackErrors(page)
    await startPresenting(page)
    await expect(page.getByRole('note')).toContainText('Fullscreen isn’t available')
    await expect(page.getByRole('button', { name: 'Enter fullscreen' })).toHaveCount(0)
    const box = await page.locator('.present-root').boundingBox()
    const vp = page.viewportSize()!
    expect(box!.width).toBe(vp.width)
    expect(box!.height).toBe(vp.height)
    await page.keyboard.press('ArrowRight')
    await expect(indicator(page)).toHaveText('2 / 7')
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/\/viewer/)
    expect(errors).toEqual([])
  })
})
