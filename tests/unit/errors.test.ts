import { describe, expect, it } from 'vitest'
import { classifyPdfError, PdfError } from '../../src/lib/pdf/errors'

describe('classifyPdfError', () => {
  it('distinguishes password needed from password wrong', () => {
    expect(classifyPdfError({ name: 'PasswordException', code: 1 }, 'a.pdf').kind).toBe('password-required')
    expect(classifyPdfError({ name: 'PasswordException', code: 2 }, 'a.pdf').kind).toBe('password-incorrect')
  })
  it('maps invalid PDF errors to a friendly message', () => {
    const e = classifyPdfError({ name: 'InvalidPDFException', message: 'Invalid PDF structure.' }, 'a.pdf')
    expect(e.kind).toBe('invalid')
    expect(e.message).toContain('“a.pdf”')
    expect(e.message).toContain('damaged')
  })
  it('passes PdfError through unchanged', () => {
    const original = new PdfError('too-large', 'big')
    expect(classifyPdfError(original)).toBe(original)
  })
  it('falls back to unknown and keeps the cause', () => {
    const cause = new Error('boom')
    const e = classifyPdfError(cause, 'a.pdf')
    expect(e.kind).toBe('unknown')
    expect(e.cause).toBe(cause)
  })
})
