import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { announcer, canvasHasInk, fixture, trackErrors, uploadFixture, waitForFlipbook } from './helpers'

test.describe('uploading and validating PDFs', () => {
  test('opens a multi-page PDF from the file picker', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/')
    await uploadFixture(page, 'three-page.pdf')
    await expect(page).toHaveURL(/\/viewer/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('three page')
    await expect(page.getByText('3 pages · Local file, not uploaded')).toBeVisible()
    await waitForFlipbook(page)
    expect(errors).toEqual([])
  })

  test('opens a PDF dropped onto the window', async ({ page }) => {
    await page.goto('/')
    const bytes = await readFile(fixture('two-page.pdf'))
    const dataTransfer = await page.evaluateHandle((data) => {
      const dt = new DataTransfer()
      dt.items.add(new File([new Uint8Array(data)], 'dropped.pdf', { type: 'application/pdf' }))
      return dt
    }, Array.from(bytes))
    await page.dispatchEvent('body', 'dragenter', { dataTransfer })
    await expect(page.getByText('Drop PDF to open')).toBeVisible()
    await page.dispatchEvent('body', 'drop', { dataTransfer })
    await expect(page).toHaveURL(/\/viewer/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('dropped')
  })

  test('rejects a file that is not a PDF', async ({ page }) => {
    await page.goto('/')
    await uploadFixture(page, 'not-a-pdf.pdf')
    await expect(page.getByRole('heading', { name: 'That isn’t a PDF' })).toBeVisible()
    await expect(page.getByTestId('load-error')).toContainText('not a PDF file')
    await expect(page).toHaveURL(/\/$/)
  })

  test('reports a corrupted PDF clearly', async ({ page }) => {
    await page.goto('/')
    await uploadFixture(page, 'corrupt.pdf')
    await expect(page.getByRole('heading', { name: 'This PDF can’t be opened' })).toBeVisible()
    await expect(page.getByTestId('load-error')).toContainText('damaged or incomplete')
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
  })

  test('handles a truncated PDF without crashing', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/')
    await uploadFixture(page, 'truncated.pdf')
    // PDF.js may recover part of a truncated file or reject it; either way the
    // app must stay usable and say what happened.
    const opened = page.getByRole('heading', { level: 1, name: 'truncated' })
    const failed = page.getByRole('heading', { name: 'This PDF can’t be opened' })
    await expect(opened.or(failed)).toBeVisible()
    expect(errors.filter((e) => e.startsWith('pageerror'))).toEqual([])
  })

  test('password-protected PDF: prompts, rejects a wrong password, opens with the right one', async ({ page }) => {
    await page.goto('/')
    await uploadFixture(page, 'encrypted.pdf')
    const dialog = page.getByRole('dialog', { name: 'Password required' })
    await expect(dialog).toBeVisible()
    await expect(page.locator('#pdf-password')).toBeFocused()
    await page.locator('#pdf-password').fill('wrong')
    await page.getByRole('button', { name: 'Open PDF' }).click()
    await expect(page.getByText('That password is not correct')).toBeVisible()
    await page.locator('#pdf-password').fill('folio')
    await page.getByRole('button', { name: 'Open PDF' }).click()
    await expect(page).toHaveURL(/\/viewer/)
    await expect(page.getByText('3 pages · Local file')).toBeVisible()
  })

  test('cancelling the password prompt leaves the app idle', async ({ page }) => {
    await page.goto('/')
    await uploadFixture(page, 'encrypted.pdf')
    await expect(page.getByRole('dialog', { name: 'Password required' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page).toHaveURL(/\/$/)
  })

  test('revokes the previous object URL when another file is opened', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __created: string[]; __revoked: string[] }
      w.__created = []
      w.__revoked = []
      const create = URL.createObjectURL.bind(URL)
      const revoke = URL.revokeObjectURL.bind(URL)
      URL.createObjectURL = (o: Blob | MediaSource) => {
        const u = create(o)
        if (o instanceof File) w.__created.push(u)
        return u
      }
      URL.revokeObjectURL = (u: string) => {
        w.__revoked.push(u)
        revoke(u)
      }
    })
    await page.goto('/')
    await uploadFixture(page, 'two-page.pdf')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('two page')
    await uploadFixture(page, 'three-page.pdf')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('three page')
    const { created, revoked } = await page.evaluate(() => {
      const w = window as unknown as { __created: string[]; __revoked: string[] }
      return { created: w.__created, revoked: w.__revoked }
    })
    expect(created).toHaveLength(2)
    expect(revoked).toContain(created[0])
    expect(revoked).not.toContain(created[1])
  })

  test('A4 landscape keeps its aspect ratio', async ({ page }) => {
    await page.goto('/')
    await uploadFixture(page, 'a4-landscape.pdf')
    await page.getByRole('radio', { name: 'Single page' }).click()
    const pageEl = page.locator('.single-stage .pdf-page')
    await expect(pageEl).toHaveAttribute('data-status', 'rendered')
    const box = await pageEl.boundingBox()
    expect(box!.width / box!.height).toBeCloseTo(842 / 595, 1)
    expect(await canvasHasInk(page, '.single-stage canvas[data-pdf-canvas]')).toBe(true)
  })
})

test.describe('page-count edge cases in the flipbook', () => {
  test('1 page: shows the single page with navigation disabled', async ({ page }) => {
    await page.goto('/')
    await uploadFixture(page, 'one-page.pdf')
    await expect(page.locator('.flipbook-stage .pdf-page[data-status="rendered"]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next page' }).last()).toBeDisabled()
    expect(await announcer(page)).toBe('Page 1 of 1')
  })

  test('2 pages: front cover, then back cover on its own', async ({ page }) => {
    await page.goto('/')
    await uploadFixture(page, 'two-page.pdf')
    await waitForFlipbook(page)
    expect(await announcer(page)).toBe('Page 1 of 2')
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => announcer(page)).toBe('Page 2 of 2')
    await expect(page.getByRole('button', { name: 'Next page' }).last()).toBeDisabled()
  })

  test('3 pages: cover, then a final two-page spread', async ({ page }) => {
    await page.goto('/')
    await uploadFixture(page, 'three-page.pdf')
    await waitForFlipbook(page)
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => announcer(page)).toBe('Pages 2–3 of 3')
    await expect(page.getByRole('button', { name: 'Next page' }).last()).toBeDisabled()
    await page.keyboard.press('ArrowLeft')
    await expect.poll(() => announcer(page)).toBe('Page 1 of 3')
  })
})

test.describe('large documents', () => {
  test('120 pages: jumping deep keeps rendered pages bounded', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/')
    await uploadFixture(page, 'large-120.pdf')
    await waitForFlipbook(page)
    await page.getByTestId('page-input').fill('60')
    await page.getByTestId('page-input').press('Enter')
    await expect.poll(() => announcer(page)).toBe('Pages 60–61 of 120')
    await expect(page.locator('.flipbook-page[data-page-index="59"][data-rendered="true"]')).toBeAttached()
    const rendered = await page.locator('.flipbook-page img[src]').count()
    expect(rendered).toBeGreaterThan(0)
    expect(rendered).toBeLessThanOrEqual(10) // window of ±4 around the spread
    // pages far behind were released
    await expect(page.locator('.flipbook-page[data-page-index="0"] img[src]')).toHaveCount(0)

    await page.getByTestId('page-input').blur() // shortcuts are ignored while typing in the box
    await page.keyboard.press('End')
    await expect.poll(() => announcer(page)).toBe('Page 120 of 120')
    expect(errors).toEqual([])
  })

  test('120 pages: thumbnails render lazily', async ({ page }) => {
    await page.goto('/')
    await uploadFixture(page, 'large-120.pdf')
    await page.getByRole('radio', { name: 'Single page' }).click()
    await expect(page.locator('.thumb-rail .pdf-page[data-status="rendered"]').first()).toBeVisible()
    await page.waitForTimeout(500)
    const renderedThumbs = await page.locator('.thumb-rail .pdf-page[data-status="rendered"]').count()
    expect(renderedThumbs).toBeLessThan(30)
    expect(await page.locator('.thumb-rail li').count()).toBe(120)
  })

  test('rapid page changes cancel stale renders and settle on the right page', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/')
    await uploadFixture(page, 'large-120.pdf')
    await page.getByRole('radio', { name: 'Single page' }).click()
    await expect(page.locator('.single-stage .pdf-page')).toHaveAttribute('data-rendered-page', '0')
    for (let i = 0; i < 15; i++) await page.keyboard.press('ArrowRight')
    await expect(page.locator('.single-stage .pdf-page')).toHaveAttribute('data-rendered-page', '15')
    await expect(page.locator('.single-stage canvas[data-pdf-canvas]')).toHaveCount(1)
    expect(await announcer(page)).toBe('Page 16 of 120')
    expect(errors).toEqual([])
  })
})
