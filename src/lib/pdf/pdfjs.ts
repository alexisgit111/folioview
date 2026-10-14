import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
} from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { classifyPdfError } from './errors'

// The worker is bundled by Vite as a separate asset and served from our origin.
GlobalWorkerOptions.workerSrc = workerUrl

const base = import.meta.env.BASE_URL.replace(/\/$/, '')

export interface LoadProgress {
  loaded: number
  total: number
}

export interface LoadOptions {
  password?: string
  fileName?: string
  onProgress?: (p: LoadProgress) => void
  /** Called with the task so callers can abort (e.g. user picks another file). */
  onTask?: (task: PDFDocumentLoadingTask) => void
}

/**
 * Opens a PDF from a same-origin URL (a blob: object URL for local files, or a
 * bundled demo path). Errors are normalised to PdfError.
 */
export async function loadPdf(url: string, options: LoadOptions = {}): Promise<PDFDocumentProxy> {
  const task = getDocument({
    url,
    password: options.password,
    cMapUrl: `${base}/pdfjs/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${base}/pdfjs/standard_fonts/`,
    wasmUrl: `${base}/pdfjs/wasm/`,
    iccUrl: `${base}/pdfjs/iccs/`,
    // Brochures are rendered as-is: no XFA forms, and FolioView never runs the
    // PDF.js scripting sandbox, so embedded PDF JavaScript is not executed.
    enableXfa: false,
  })
  options.onTask?.(task)
  if (options.onProgress) {
    task.onProgress = ({ loaded, total }: LoadProgress) => options.onProgress?.({ loaded, total })
  }
  // No onPassword handler: PDF.js then rejects with PasswordException (code 1 =
  // needed, 2 = incorrect) and the UI shows its own password dialog.
  try {
    return await task.promise
  } catch (err) {
    void task.destroy()
    throw classifyPdfError(err, options.fileName)
  }
}

export interface PageSize {
  width: number
  height: number
}

/** Page sizes at scale 1 (CSS px), honouring /Rotate. */
export async function readPageSizes(doc: PDFDocumentProxy, limit = Infinity): Promise<PageSize[]> {
  const count = Math.min(doc.numPages, limit)
  const sizes: PageSize[] = []
  for (let i = 1; i <= count; i++) {
    const page = await doc.getPage(i)
    const vp = page.getViewport({ scale: 1 })
    sizes.push({ width: vp.width, height: vp.height })
  }
  return sizes
}
