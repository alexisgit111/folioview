export type PdfErrorKind =
  | 'empty'
  | 'too-large'
  | 'not-pdf'
  | 'password-required'
  | 'password-incorrect'
  | 'invalid'
  | 'network'
  | 'unknown'

export class PdfError extends Error {
  readonly kind: PdfErrorKind
  constructor(kind: PdfErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'PdfError'
    this.kind = kind
  }
}

// PDF.js PasswordResponses codes
const NEED_PASSWORD = 1
const INCORRECT_PASSWORD = 2

/**
 * Maps whatever PDF.js (or the browser) throws to a small set of user-facing
 * cases. We match on `name` rather than `instanceof` so this works across
 * module copies (e.g. tests using the legacy build).
 */
export function classifyPdfError(err: unknown, fileName = 'This file'): PdfError {
  if (err instanceof PdfError) return err
  const e = err as { name?: string; code?: number; message?: string } | undefined
  const name = e?.name ?? ''
  if (name === 'PasswordException') {
    return e?.code === INCORRECT_PASSWORD
      ? new PdfError('password-incorrect', 'That password is not correct. Try again.', { cause: err })
      : new PdfError(
          'password-required',
          `${quote(fileName)} is password protected. Enter its password to open it.`,
          { cause: err },
        )
  }
  if (e?.code === NEED_PASSWORD && /password/i.test(e?.message ?? '')) {
    return new PdfError('password-required', `${quote(fileName)} is password protected.`, { cause: err })
  }
  if (name === 'InvalidPDFException' || /invalid pdf|bad xref|no pdf header|startxref/i.test(e?.message ?? '')) {
    return new PdfError(
      'invalid',
      `${quote(fileName)} looks damaged or incomplete and can't be opened. Try re-exporting the PDF.`,
      { cause: err },
    )
  }
  if (name === 'ResponseException' || name === 'MissingPDFException') {
    return new PdfError('network', `${quote(fileName)} could not be read.`, { cause: err })
  }
  return new PdfError(
    'unknown',
    `Something went wrong opening ${quote(fileName)}. ${e?.message ? `(${e.message})` : ''}`.trim(),
    { cause: err },
  )
}

function quote(name: string) {
  return name === 'This file' ? name : `“${name}”`
}
