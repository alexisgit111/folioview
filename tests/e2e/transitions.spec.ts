import { expect, test, type Page } from '@playwright/test'
import { announcer, openDemo, setTransition, trackErrors } from './helpers'

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

  test('transition settings: style, direction and speed are chosen in a panel and remembered', async ({ page }) => {
    await openSingle(page)
    const trigger = page.getByTestId('transition-settings')
    await expect(trigger).toHaveAttribute('aria-label', /Page turn/)
    await trigger.click()
    const panel = page.getByTestId('transition-panel')
    const names = await panel.getByRole('group', { name: 'Animation' }).getByRole('button').allTextContents()
    expect(names).toEqual(['Page turn', 'Slide', 'Zoom', 'Cube', 'Flip', 'Wipe', 'Cover / Stack', 'Reveal', 'Drop', 'Fade', 'No animation'])
    // Fade has no direction
    await panel.getByRole('button', { name: 'Fade', exact: true }).click()
    await expect(panel).toContainText('Fade looks the same in every direction')
    await panel.getByRole('button', { name: 'Slide', exact: true }).click()
    await panel.getByRole('radio', { name: 'From bottom' }).click()
    await panel.getByRole('radio', { name: 'Fast', exact: true }).click()
    // Escape closes the panel, not the page
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
    await expect(page).toHaveURL(/\/viewer/)

    await page.reload()
    await page.goto('/')
    await openSingle(page)
    await expect(page.getByTestId('transition-settings')).toHaveAttribute('aria-label', /Slide/)
    await page.getByTestId('transition-settings').click()
    await expect(page.getByRole('radio', { name: 'From bottom' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('radio', { name: 'Fast', exact: true })).toHaveAttribute('aria-checked', 'true')
  })

  test('direction and speed change the animation', async ({ page }) => {
    await openSingle(page)
    const sample = async () => {
      await page.keyboard.press('ArrowRight')
      await expect(overlay(page)).toHaveCount(1)
      const info = await page.evaluate(
        () =>
          new Promise<{ transform: string; duration: number }>((resolve) => {
            const tick = () => {
              const o = document.querySelector('.page-transition-overlay')
              const a = o?.getAnimations()[0]
              if (!a) return requestAnimationFrame(tick)
              const kf = (a.effect as KeyframeEffect).getKeyframes()
              resolve({ transform: String(kf[kf.length - 1].transform), duration: Number(a.effect!.getTiming().duration) })
            }
            tick()
          }),
      )
      await expect(overlay(page)).toHaveCount(0, { timeout: 5000 })
      return info
    }
    await setTransition(page, { style: 'Slide', direction: 'From right', speed: 'Normal' })
    const normal = await sample()
    expect(normal.transform).toMatch(/translateX\(-/) // old page leaves to the left
    await setTransition(page, { direction: 'From bottom', speed: 'Fast' })
    const fast = await sample()
    expect(fast.transform).toMatch(/translateY\(-/) // old page leaves upwards
    expect(fast.duration).toBeLessThan(normal.duration)
    await setTransition(page, { direction: 'From left', speed: 'Slow' })
    const slow = await sample()
    expect(slow.transform).toMatch(/translateX\(\d/) // old page leaves to the right
    expect(slow.duration).toBeGreaterThan(normal.duration)
  })

  const LABEL: Record<string, string> = { slide: 'Slide', zoom: 'Zoom', cube: 'Cube', flip: 'Flip', wipe: 'Wipe', cover: 'Cover / Stack', reveal: 'Reveal', drop: 'Drop', fade: 'Fade', turn: 'Page turn' }
  for (const style of ['slide', 'zoom', 'cube', 'flip', 'wipe', 'cover', 'reveal']) {
    test(`${style}: animates both ways, cleans up and leaves the page untouched`, async ({ page }) => {
      const errors = trackErrors(page)
      await openSingle(page)
      await setTransition(page, { style: LABEL[style] })
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
    test.setTimeout(120_000)
    const errors = trackErrors(page)
    await openDemo(page, 'deck')
    await page.getByRole('button', { name: 'Present fullscreen' }).click()
    await expect(page.locator('[aria-label="Slide 1 of 7"]')).toHaveAttribute('data-status', 'rendered')
    await page.mouse.move(400, 400)
    let n = 1
    for (const style of ['slide', 'zoom', 'cube', 'flip', 'wipe', 'cover', 'reveal', 'drop', 'fade', 'turn']) {
      await page.mouse.move(400, 300 + (n % 2))
      await setTransition(page, { style: LABEL[style], direction: n % 2 ? 'From bottom' : 'From right' })
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
    await expect(page.getByTestId('transition-settings')).toBeVisible()
    expect(errors).toEqual([])
  })
})
