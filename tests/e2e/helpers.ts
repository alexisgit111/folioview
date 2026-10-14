import { expect, type Page } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
export const fixture = (name: string) => path.join(here, '..', 'fixtures', name)

/** Collects uncaught errors and console errors so tests can assert none happened. */
export function trackErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })
  return errors
}

export async function uploadFixture(page: Page, name: string) {
  await page.getByTestId('file-input').setInputFiles(fixture(name))
}

export async function openDemo(page: Page, id: 'harbourview' | 'portfolio' | 'deck') {
  await page.goto('/')
  await page.getByTestId(`demo-${id}`).click()
  await expect(page).toHaveURL(/\/viewer/)
}

/** Waits until the flipbook has initialised and the visible page images are rendered. */
export async function waitForFlipbook(page: Page) {
  await expect(page.locator('.flipbook-host[data-ready="true"]')).toBeVisible()
  await expect(page.locator('.flipbook-page[data-rendered="true"]').first()).toBeAttached()
}

export async function announcer(page: Page) {
  return (await page.getByTestId('page-announcer').textContent())?.trim()
}

/** True if a canvas (or img) has non-white pixels, i.e. something was actually drawn. */
export async function canvasHasInk(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((el) => {
    let source: CanvasImageSource = el as HTMLCanvasElement
    let w = (el as HTMLCanvasElement).width
    let h = (el as HTMLCanvasElement).height
    if (el instanceof HTMLImageElement) {
      source = el
      w = el.naturalWidth
      h = el.naturalHeight
    }
    if (!w || !h) return false
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 64
    const ctx = c.getContext('2d')!
    ctx.drawImage(source, 0, 0, 64, 64)
    const d = ctx.getImageData(0, 0, 64, 64).data
    let ink = 0
    for (let i = 0; i < d.length; i += 4) if (d[i] < 200 || d[i + 1] < 200 || d[i + 2] < 200) ink++
    return ink > 20
  })
}

export async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}
