import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist'
import { config } from '../lib/config'
import { classifyPdfError, PdfError } from '../lib/pdf/errors'
import { loadPdf, readPageSizes, type PageSize } from '../lib/pdf/pdfjs'
import { displayNameFromFile, validatePdfFile } from '../lib/pdf/validate'
import type { DemoDocument } from '../lib/demos'

export interface OpenDocument {
  /** Changes every time a document is opened; used as a React key. */
  id: string
  pdf: PDFDocumentProxy
  title: string
  fileName: string
  sizeBytes?: number
  origin: 'local' | 'demo'
  pageCount: number
  /** Size of page 1 at scale 1; used until the rest are measured. */
  firstPageSize: PageSize
  /** All page sizes, filled in the background after opening. */
  pageSizes: PageSize[] | null
}

export type LoadState =
  | { status: 'idle' }
  | { status: 'loading'; fileName: string; progress: number | null }
  | { status: 'password'; fileName: string; retry: boolean }
  | { status: 'error'; error: PdfError; fileName?: string }
  | { status: 'ready' }

interface Source {
  url: string
  fileName: string
  title: string
  sizeBytes?: number
  origin: 'local' | 'demo'
  /** Object URLs we created and must revoke. */
  ownsUrl: boolean
}

interface DocumentContextValue {
  load: LoadState
  doc: OpenDocument | null
  page: number
  setPage: (index: number) => void
  openFile: (file: File) => Promise<boolean>
  openDemo: (demo: DemoDocument) => Promise<boolean>
  submitPassword: (password: string) => Promise<boolean>
  cancelLoad: () => void
  dismissError: () => void
  close: () => void
  getPageSize: (index: number) => PageSize
}

const Ctx = createContext<DocumentContextValue | null>(null)

let idCounter = 0

export function DocumentProvider({ children }: { children: ReactNode }) {
  const [load, setLoad] = useState<LoadState>({ status: 'idle' })
  const [doc, setDoc] = useState<OpenDocument | null>(null)
  const [page, setPageState] = useState(0)

  const docRef = useRef<OpenDocument | null>(null)
  const sourceRef = useRef<Source | null>(null) // the document currently shown
  const pendingRef = useRef<Source | null>(null) // a document being opened
  const taskRef = useRef<PDFDocumentLoadingTask | null>(null)
  const tokenRef = useRef(0)

  const disposeSource = (src: Source | null) => {
    if (src?.ownsUrl) URL.revokeObjectURL(src.url)
  }

  const abortInFlight = useCallback(() => {
    tokenRef.current++
    if (taskRef.current) {
      void taskRef.current.destroy()
      taskRef.current = null
    }
    if (pendingRef.current && pendingRef.current !== sourceRef.current) disposeSource(pendingRef.current)
    pendingRef.current = null
  }, [])

  const openSource = useCallback(async (src: Source, password?: string): Promise<boolean> => {
    if (pendingRef.current !== src) abortInFlight()
    else {
      tokenRef.current++
      if (taskRef.current) void taskRef.current.destroy()
    }
    pendingRef.current = src
    const token = tokenRef.current
    setLoad({ status: 'loading', fileName: src.fileName, progress: null })

    try {
      const pdf = await loadPdf(src.url, {
        password,
        fileName: src.fileName,
        onTask: (t) => (taskRef.current = t),
        onProgress: ({ loaded, total }) => {
          if (token !== tokenRef.current) return
          const size = total || src.sizeBytes || 0
          setLoad({ status: 'loading', fileName: src.fileName, progress: size ? Math.min(1, loaded / size) : null })
        },
      })
      if (token !== tokenRef.current) {
        void pdf.loadingTask.destroy()
        return false
      }
      if (pdf.numPages < 1) throw new PdfError('invalid', `“${src.fileName}” has no pages.`)
      const first = await pdf.getPage(1)
      const vp = first.getViewport({ scale: 1 })
      if (token !== tokenRef.current) {
        void pdf.loadingTask.destroy()
        return false
      }

      // Swap in the new document, then tear down the old one.
      // The previous PDF is destroyed by the effect below, after the viewer unmounts.
      const previousSource = sourceRef.current
      const next: OpenDocument = {
        id: `doc-${++idCounter}`,
        pdf,
        title: src.title,
        fileName: src.fileName,
        sizeBytes: src.sizeBytes,
        origin: src.origin,
        pageCount: pdf.numPages,
        firstPageSize: { width: vp.width, height: vp.height },
        pageSizes: null,
      }
      docRef.current = next
      sourceRef.current = src
      pendingRef.current = null
      taskRef.current = null
      setDoc(next)
      setPageState(0)
      setLoad({ status: 'ready' })
      if (previousSource && previousSource !== src) disposeSource(previousSource)

      // Measure the remaining pages without blocking the first paint.
      readPageSizes(pdf)
        .then((sizes) => {
          if (docRef.current?.id === next.id) {
            const withSizes = { ...next, pageSizes: sizes }
            docRef.current = withSizes
            setDoc(withSizes)
          }
        })
        .catch(() => {
          /* document closed mid-way; sizes fall back to page 1 */
        })
      return true
    } catch (err) {
      if (token !== tokenRef.current) return false
      taskRef.current = null
      const error = classifyPdfError(err, src.fileName)
      if (error.kind === 'password-required' || error.kind === 'password-incorrect') {
        setLoad({ status: 'password', fileName: src.fileName, retry: error.kind === 'password-incorrect' })
        return false
      }
      if (pendingRef.current === src) {
        disposeSource(src)
        pendingRef.current = null
      }
      setLoad({ status: 'error', error, fileName: src.fileName })
      return false
    }
  }, [abortInFlight])

  const openFile = useCallback(async (file: File) => {
    abortInFlight()
    const token = tokenRef.current
    setLoad({ status: 'loading', fileName: file.name, progress: null })
    try {
      await validatePdfFile(file, config.maxUploadMb)
    } catch (err) {
      if (token === tokenRef.current) {
        setLoad({ status: 'error', error: classifyPdfError(err, file.name), fileName: file.name })
      }
      return false
    }
    if (token !== tokenRef.current) return false
    return openSource({
      url: URL.createObjectURL(file),
      fileName: file.name,
      title: displayNameFromFile(file.name),
      sizeBytes: file.size,
      origin: 'local',
      ownsUrl: true,
    })
  }, [abortInFlight, openSource])

  const openDemo = useCallback((demo: DemoDocument) => {
    abortInFlight()
    return openSource({
      url: demo.url,
      fileName: demo.url.split('/').pop() ?? demo.title,
      title: demo.title,
      origin: 'demo',
      ownsUrl: false,
    })
  }, [abortInFlight, openSource])

  const submitPassword = useCallback(async (password: string) => {
    const src = pendingRef.current
    if (!src) return false
    return openSource(src, password)
  }, [openSource])

  const cancelLoad = useCallback(() => {
    abortInFlight()
    setLoad(docRef.current ? { status: 'ready' } : { status: 'idle' })
  }, [abortInFlight])

  const dismissError = useCallback(() => {
    setLoad(docRef.current ? { status: 'ready' } : { status: 'idle' })
  }, [])

  const close = useCallback(() => {
    abortInFlight()
    docRef.current = null
    setDoc(null)
    setPageState(0)
    setLoad({ status: 'idle' })
    disposeSource(sourceRef.current)
    sourceRef.current = null
  }, [abortInFlight])

  const setPage = useCallback((index: number) => {
    const count = docRef.current?.pageCount ?? 1
    setPageState(Math.max(0, Math.min(count - 1, Math.round(index))))
  }, [])

  const getPageSize = useCallback(
    (index: number) => doc?.pageSizes?.[index] ?? doc?.firstPageSize ?? { width: 595, height: 842 },
    [doc],
  )

  // Destroy a PDF only after React has committed the change and the components
  // using it have unmounted (their cleanups cancel in-flight renders first).
  const activePdf = doc?.pdf ?? null
  useEffect(() => {
    if (!activePdf) return
    return () => {
      void activePdf.loadingTask.destroy()
    }
  }, [activePdf])

  // Free everything when the app unmounts (tab close is handled by the browser).
  useEffect(() => () => {
    tokenRef.current++
    void taskRef.current?.destroy()
    disposeSource(sourceRef.current)
    disposeSource(pendingRef.current)
  }, [])

  const value = useMemo<DocumentContextValue>(() => ({
    load, doc, page, setPage, openFile, openDemo, submitPassword, cancelLoad, dismissError, close, getPageSize,
  }), [load, doc, page, setPage, openFile, openDemo, submitPassword, cancelLoad, dismissError, close, getPageSize])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDocument(): DocumentContextValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useDocument must be used inside <DocumentProvider>')
  return v
}
