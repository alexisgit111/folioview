import { describe, expect, it } from 'vitest'
import { displayNameFromFile, findPdfSignature, validatePdfFile } from '../../src/lib/pdf/validate'
import { PdfError } from '../../src/lib/pdf/errors'

const enc = (s: string) => new TextEncoder().encode(s)
const file = (bytes: Uint8Array | string, name = 'brochure.pdf', type = 'application/pdf') =>
  new File([(typeof bytes === 'string' ? enc(bytes) : bytes) as BlobPart], name, { type })

describe('findPdfSignature', () => {
  it('finds the header at the start', () => expect(findPdfSignature(enc('%PDF-1.7\n'))).toBe(0))
  it('tolerates a short preamble', () => expect(findPdfSignature(enc('junk\r\n%PDF-1.4'))).toBe(6))
  it('ignores headers beyond the first 1024 bytes', () => {
    expect(findPdfSignature(enc(' '.repeat(1030) + '%PDF-1.4'))).toBe(-1)
  })
  it('rejects other formats', () => {
    expect(findPdfSignature(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(-1)
    expect(findPdfSignature(enc('%PD'))).toBe(-1)
  })
})

describe('validatePdfFile', () => {
  it('accepts a PDF even when the browser gives no MIME type', async () => {
    await expect(validatePdfFile(file('%PDF-1.7 body', 'x.pdf', ''), 10)).resolves.toMatchObject({ name: 'x.pdf' })
  })

  it('rejects empty files', async () => {
    await expect(validatePdfFile(file(''), 10)).rejects.toMatchObject({ kind: 'empty' })
  })

  it('rejects files over the size limit before reading them', async () => {
    const big = new Uint8Array(2 * 1024 * 1024)
    big.set(enc('%PDF-1.7'))
    const err = await validatePdfFile(file(big), 1).catch((e) => e)
    expect(err).toBeInstanceOf(PdfError)
    expect(err.kind).toBe('too-large')
    expect(err.message).toContain('limit is 1 MB')
  })

  it('rejects a renamed image by its signature', async () => {
    await expect(validatePdfFile(file(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0])), 10)).rejects.toMatchObject({
      kind: 'not-pdf',
    })
  })
})

describe('displayNameFromFile', () => {
  it('turns file names into titles', () => {
    expect(displayNameFromFile('12_kauri-rise.PDF')).toBe('12 kauri rise')
    expect(displayNameFromFile('.pdf')).toBe('Untitled document')
  })
})
