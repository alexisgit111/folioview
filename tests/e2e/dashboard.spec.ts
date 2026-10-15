import { expect, test } from '@playwright/test'
import { noHorizontalOverflow, trackErrors } from './helpers'

test('dashboard shows the logo and local-only status, without the demo library', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/')
  await expect(page.getByTestId('local-status')).toContainText('Local-only')
  const logo = page.getByRole('link', { name: 'FolioView home' }).locator('img')
  await expect(logo).toBeVisible()
  expect(await logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
  await expect(page.getByRole('heading', { name: 'Demo library' })).toHaveCount(0)
  await expect(page.getByText('Private by design')).toHaveCount(0)
  await noHorizontalOverflow(page)
  expect(errors).toEqual([])
})

test('/?demo=<id> still opens a bundled sample', async ({ page }) => {
  await page.goto('/?demo=deck')
  await expect(page).toHaveURL(/\/viewer/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Vendor Meeting Deck')
})

test('viewer without a document shows an empty state', async ({ page }) => {
  await page.goto('/viewer')
  await expect(page.getByRole('heading', { name: 'No document open' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open a PDF' })).toBeVisible()
})

test('present without a document explains what to do', async ({ page }) => {
  await page.goto('/present')
  await expect(page.getByText('Nothing to present')).toBeVisible()
})

test('unknown routes show not found', async ({ page }) => {
  await page.goto('/library')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
})

test('unsupported browsers get a clear message instead of a broken app', async ({ page }) => {
  await page.addInitScript(() => {
    // Simulate an engine older than PDF.js 6 supports
    delete (Promise as unknown as { withResolvers?: unknown }).withResolvers
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'This browser can’t run FolioView' })).toBeVisible()
  await expect(page.getByTestId('unsupported-missing')).toContainText('Promise.withResolvers')
})

test('keyboard users see a focus ring and can reach the uploader', async ({ page }) => {
  await page.goto('/')
  const choose = page.getByTestId('choose-pdf')
  for (let i = 0; i < 6 && !(await choose.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press('Tab')
  }
  await expect(choose).toBeFocused()
  const outline = await choose.evaluate((el) => getComputedStyle(el).outlineStyle)
  expect(outline).toBe('solid')
})
