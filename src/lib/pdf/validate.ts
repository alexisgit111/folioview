import { MB } from '../config'
import { PdfError } from './errors'

/**
 * The PDF spec lets readers tolerate junk before the header; Acrobat looks in
 * the first 1024 bytes. We do the same so legitimate files with a preamble
 * (some scanners, email gateways) are not rejected.
 */
export const SIGNATURE_SEARCH_BYTES = 1024
const SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d] // "%PDF-"

export function findPdfSignature(bytes: Uint8Array): number {
  const limit = Math.min(bytes.length, SIGNATURE_SEARCH_BYTES) - SIGNATURE.length
  for (let i = 0; i <= limit; i++) {
    let match = true
    for (let j = 0; j < SIGNATURE.length; j++) {
      if (bytes[i + j] !== SIGNATURE[j]) {
        match = false
        break
      }
    }
    if (match) return i
  }
  return -1
}

export interface ValidatedFile {
  file: File
  name: string
  sizeBytes: number
}

/**
 * Checks a user-supplied file before it reaches PDF.js. The MIME type is only
 * advisory (it is often empty or wrong), so the byte signature is what decides.
 */
export async function validatePdfFile(file: File, maxMb: number): Promise<ValidatedFile> {
  if (file.size === 0) {
    throw new PdfError('empty', `“${file.name}” is empty.`)
  }
  if (file.size > maxMb * MB) {
    throw new PdfError(
      'too-large',
      `“${file.name}” is ${(file.size / MB).toFixed(1)} MB. The limit is ${maxMb} MB.`,
    )
  }
  const head = new Uint8Array(await readSlice(file, 0, SIGNATURE_SEARCH_BYTES))
  if (findPdfSignature(head) === -1) {
    throw new PdfError('not-pdf', `“${file.name}” is not a PDF file.`)
  }
  return { file, name: file.name, sizeBytes: file.size }
}

function readSlice(file: Blob, start: number, end: number): Promise<ArrayBuffer> {
  const blob = file.slice(start, end)
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer()
  // jsdom and some older engines lack Blob#arrayBuffer
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })
}

export function displayNameFromFile(name: string): string {
  return name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim() || 'Untitled document'
}
