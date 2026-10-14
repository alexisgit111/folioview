// @vitest-environment node
/**
 * Loads the real fixture PDFs with PDF.js (legacy Node build) to prove the
 * fixtures cover what they claim and that our error mapping matches what
 * PDF.js actually throws.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { classifyPdfError } from '../../src/lib/pdf/errors'

const fx = (n: string) => path.join(__dirname, '..', 'fixtures', n)

async function open(name: string, password?: string) {
  const data = new Uint8Array(await readFile(fx(name)))
  const task = getDocument({ data, password, verbosity: 0, isEvalSupported: false } as Parameters<typeof getDocument>[0])
  return task.promise
}

describe('fixture PDFs through PDF.js', () => {
  it.each([
    ['one-page.pdf', 1],
    ['two-page.pdf', 2],
    ['three-page.pdf', 3],
    ['large-120.pdf', 120],
  ])('%s has %i pages', async (name, count) => {
    const doc = await open(name)
    expect(doc.numPages).toBe(count)
    await doc.loadingTask.destroy()
  })

  it('A4 portrait and landscape page sizes', async () => {
    const portrait = await open('one-page.pdf')
    const vp = (await portrait.getPage(1)).getViewport({ scale: 1 })
    expect([Math.round(vp.width), Math.round(vp.height)]).toEqual([595, 842])
    const landscape = await open('a4-landscape.pdf')
    const lv = (await landscape.getPage(1)).getViewport({ scale: 1 })
    expect([Math.round(lv.width), Math.round(lv.height)]).toEqual([842, 595])
    await portrait.loadingTask.destroy()
    await landscape.loadingTask.destroy()
  })

  it('encrypted PDF needs a password, rejects a wrong one, opens with the right one', async () => {
    expect(classifyPdfError(await open('encrypted.pdf').catch((e) => e)).kind).toBe('password-required')
    expect(classifyPdfError(await open('encrypted.pdf', 'nope').catch((e) => e)).kind).toBe('password-incorrect')
    const doc = await open('encrypted.pdf', 'folio')
    expect(doc.numPages).toBe(3)
    await doc.loadingTask.destroy()
  })

  it('corrupted PDF is classified as invalid', async () => {
    const err = await open('corrupt.pdf').catch((e) => e)
    expect(classifyPdfError(err, 'corrupt.pdf').kind).toBe('invalid')
  })
})
