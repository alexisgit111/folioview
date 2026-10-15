import { expect, test, type Page } from '@playwright/test'
import { announcer, canvasHasInk, openDemo, trackErrors, uploadFixture, waitForFlipbook } from './helpers'

const layer = (page: Page, scope = '.single-stage') => page.locator(`${scope} canvas[data-annot-canvas]`)

async function draw(page: Page, scope = '.single-stage', from = [0.3, 0.3], to = [0.7, 0.6]) {
  const box = (await layer(page, scope).boundingBox())!
  const x0 = box.x + box.width * from[0], y0 = box.y + box.height * from[1]
  const x1 = box.x + box.width * to[0], y1 = box.y + box.height * to[1]
  await page.mouse.move(x0, y0)
  await page.mouse.down()
  for (let i = 1; i <= 12; i++) await page.mouse.move(x0 + ((x1 - x0) * i) / 12, y0 + ((y1 - y0) * i) / 12)
  await page.mouse.up()
}

async function openSingle(page: Page) {
  await openDemo(page, 'harbourview')
  await page.getByRole('radio', { name: 'Single page' }).click()
  await expect(page.locator('.single-stage .pdf-page')).toHaveAttribute('data-status', 'rendered')
}

test.describe('annotations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('draw, undo, erase and clear on a page', async ({ page }) => {
    const errors = trackErrors(page)
    await openSingle(page)
    await page.getByTestId('pen-toggle').click()
    await expect(page.getByTestId('annotation-toolbar')).toBeVisible()

    await draw(page)
    await expect(layer(page)).toHaveAttribute('data-strokes', '1')
    expect(await canvasHasInk(page, '.single-stage canvas[data-annot-canvas]')).toBe(true)

    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(layer(page)).toHaveAttribute('data-strokes', '0')

    // highlighter in a different colour
    await page.getByRole('button', { name: 'Highlighter' }).click()
    await page.getByRole('button', { name: 'Colour Blue' }).click()
    await draw(page, '.single-stage', [0.2, 0.5], [0.8, 0.5])
    await page.getByRole('button', { name: 'Pen', exact: true }).click()
    await draw(page, '.single-stage', [0.2, 0.2], [0.4, 0.25])
    await expect(layer(page)).toHaveAttribute('data-strokes', '2')

    // eraser removes the stroke it touches
    await page.getByRole('button', { name: 'Eraser' }).click()
    const box = (await layer(page).boundingBox())!
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5)
    await expect(layer(page)).toHaveAttribute('data-strokes', '1')

    await page.getByRole('button', { name: 'Clear this page' }).click()
    await expect(layer(page)).toHaveAttribute('data-strokes', '0')
    await page.keyboard.press('Control+z')
    await expect(layer(page)).toHaveAttribute('data-strokes', '1')
    expect(errors).toEqual([])
  })

  test('drawing does not turn pages; arrows still navigate; drawings stay on their page', async ({ page }) => {
    await openSingle(page)
    await page.keyboard.press('p')
    await expect(page.getByTestId('pen-toggle')).toHaveAttribute('aria-pressed', 'true')
    // a long horizontal stroke would be a swipe if drawing were off
    await draw(page, '.single-stage', [0.85, 0.5], [0.1, 0.5])
    expect(await announcer(page)).toBe('Page 1 of 12')
    await expect(layer(page)).toHaveAttribute('data-strokes', '1')

    await page.keyboard.press('ArrowRight')
    await expect(page.locator('.single-stage .pdf-page')).toHaveAttribute('data-rendered-page', '1')
    await expect(layer(page)).toHaveAttribute('data-strokes', '0')
    await page.keyboard.press('ArrowLeft')
    await expect(layer(page)).toHaveAttribute('data-strokes', '1')

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('pen-toggle')).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByTestId('annotation-toolbar')).toHaveCount(0)
  })

  test('drawings stay put when zooming', async ({ page }) => {
    await openSingle(page)
    await page.getByTestId('pen-toggle').click()
    await draw(page)
    await page.getByTestId('pen-toggle').click()
    await page.getByRole('button', { name: 'Zoom in' }).click()
    await page.getByRole('button', { name: 'Zoom in' }).click()
    await expect(layer(page)).toHaveAttribute('data-strokes', '1')
    expect(await canvasHasInk(page, '.single-stage canvas[data-annot-canvas]')).toBe(true)
  })

  test('drawings are remembered for the same PDF after a reload', async ({ page }) => {
    await page.goto('/')
    await uploadFixture(page, 'three-page.pdf')
    await page.getByRole('radio', { name: 'Single page' }).click()
    await expect(page.locator('.single-stage .pdf-page')).toHaveAttribute('data-status', 'rendered')
    await page.getByTestId('pen-toggle').click()
    await draw(page)
    await expect(layer(page)).toHaveAttribute('data-strokes', '1')

    await page.reload()
    await page.goto('/')
    await uploadFixture(page, 'three-page.pdf')
    await page.getByRole('radio', { name: 'Single page' }).click()
    await expect(layer(page)).toHaveAttribute('data-strokes', '1')
    // a different PDF starts clean
    await uploadFixture(page, 'two-page.pdf')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('two page')
    await expect(layer(page)).toHaveAttribute('data-strokes', '0')
  })

  test('picking up the pen in flipbook switches to single page; flipbook shows drawings', async ({ page }) => {
    await openDemo(page, 'harbourview')
    await waitForFlipbook(page)
    await page.getByTestId('pen-toggle').click()
    await expect(page.getByRole('radio', { name: 'Single page' })).toHaveAttribute('aria-checked', 'true')
    await expect(page.locator('.single-stage .pdf-page')).toHaveAttribute('data-status', 'rendered')
    await draw(page)
    await page.getByRole('button', { name: 'Done' }).click()
    await page.getByRole('radio', { name: 'Flipbook' }).click()
    await waitForFlipbook(page)
    await expect(page.locator('.flipbook-page[data-page-index="0"]')).toHaveAttribute('data-annotated', 'true')
  })

  test('presentation: draw on a slide; taps do not change slides while drawing', async ({ page }) => {
    const errors = trackErrors(page)
    await openDemo(page, 'deck')
    await page.getByRole('button', { name: 'Present fullscreen' }).click()
    await expect(page.locator('[aria-label="Slide 1 of 7"]')).toHaveAttribute('data-status', 'rendered')
    await page.mouse.move(300, 300)
    await page.getByTestId('pen-toggle').click()
    await expect(page.getByTestId('annotation-toolbar')).toBeVisible()
    await draw(page, '.present-root')
    await expect(layer(page, '.present-root')).toHaveAttribute('data-strokes', '1')
    const box = (await layer(page, '.present-root').boundingBox())!
    await page.mouse.click(box.x + box.width * 0.9, box.y + box.height * 0.2)
    await expect(page.getByTestId('present-indicator')).toHaveText('1 / 7')
    // controls stay visible while drawing
    await page.waitForTimeout(3000)
    await expect(page.locator('.present-root')).toHaveAttribute('data-controls', 'visible')
    await page.keyboard.press('ArrowRight')
    await expect(page.getByTestId('present-indicator')).toHaveText('2 / 7')
    expect(errors).toEqual([])
  })
})

test('drop transition: the old page falls away', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('fv.transition', 'drop'))
  await openSingle(page)
  await expect(page.getByTestId('transition-settings')).toHaveAttribute('aria-label', /Drop/)
  await page.keyboard.press('ArrowRight')
  const overlay = page.locator('.page-transition-overlay')
  await expect(overlay).toHaveCount(1)
  await expect(page.locator('.single-stage .pdf-page')).toHaveAttribute('data-rendered-page', '1')
  await page.waitForTimeout(400)
  if (await overlay.count()) {
    const t = await overlay.evaluate((el) => getComputedStyle(el).transform)
    expect(t).not.toBe('none')
  }
  await expect(overlay).toHaveCount(0, { timeout: 5000 })
})
