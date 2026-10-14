import { expect, test } from '@playwright/test'
import { canvasHasInk, noHorizontalOverflow, trackErrors } from './helpers'

test('dashboard shows local-only status and demo cards with real thumbnails', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/')
  await expect(page.getByTestId('local-status')).toContainText('Local-only')
  await expect(page.getByRole('heading', { name: 'Demo library' })).toBeVisible()
  for (const id of ['harbourview', 'portfolio', 'deck']) {
    const card = page.getByTestId(`demo-${id}`)
    await expect(card).toBeVisible()
    await expect(card.locator('.pdf-page[data-status="rendered"]')).toBeVisible()
  }
  expect(await canvasHasInk(page, '[data-testid="demo-harbourview"] canvas')).toBe(true)
  await noHorizontalOverflow(page)
  expect(errors).toEqual([])
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
