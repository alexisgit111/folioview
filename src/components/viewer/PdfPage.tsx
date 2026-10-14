import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { RenderSlot } from '../../lib/pdf/renderSlot'
import { useDebounced } from '../../lib/hooks'

interface PdfPageProps {
  pdf: PDFDocumentProxy
  /** Zero-based page index. */
  pageIndex: number
  /** CSS size the page should occupy (aspect ratio must match the page). */
  width: number
  height: number
  /** Accessible label, e.g. "Page 3 of 12". Empty = decorative (e.g. inside a labelled button). */
  label: string
  /** Render only while near the viewport, and free the canvas when far away. */
  lazy?: boolean
  /** Root used for lazy visibility checks (defaults to the viewport). */
  scrollRoot?: Element | null
  className?: string
  /** Called after each successful render (used by tests and fade-ins). */
  onRendered?: () => void
}

type Status = 'idle' | 'rendering' | 'rendered' | 'error'

/**
 * Renders a single PDF page into a canvas sized for the device pixel ratio.
 * Size changes are debounced and stale renders are cancelled by RenderSlot.
 */
export function PdfPage({ pdf, pageIndex, width, height, label, lazy = false, scrollRoot, className = '', onRendered }: PdfPageProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const slotRef = useRef<RenderSlot | null>(null)
  const [visible, setVisible] = useState(!lazy)
  const [status, setStatus] = useState<Status>('idle')
  const [renderedPage, setRenderedPage] = useState<number | null>(null)
  const renderWidth = useDebounced(Math.round(width), 90)
  const onRenderedRef = useRef(onRendered)
  onRenderedRef.current = onRendered

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const slot = new RenderSlot(host)
    slotRef.current = slot
    return () => {
      slot.dispose()
      slotRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!lazy) {
      setVisible(true)
      return
    }
    const wrapper = hostRef.current?.parentElement
    if (!wrapper || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { root: scrollRoot ?? null, rootMargin: '300px' },
    )
    io.observe(wrapper)
    return () => io.disconnect()
  }, [lazy, scrollRoot])

  useEffect(() => {
    const slot = slotRef.current
    if (!slot) return
    if (!visible) {
      slot.release()
      setStatus('idle')
      setRenderedPage(null)
      return
    }
    if (renderWidth < 2) return
    let cancelled = false
    setStatus((s) => (s === 'rendered' ? s : 'rendering'))
    pdf
      .getPage(pageIndex + 1)
      .then((page) => (cancelled ? 'cancelled' : slot.render(page, { width: renderWidth, height: 0 })))
      .then((result) => {
        if (!cancelled && result === 'rendered') {
          setStatus('rendered')
          setRenderedPage(pageIndex)
          onRenderedRef.current?.()
        }
      })
      .catch((err) => {
        if (cancelled) return
        console.error(`FolioView: failed to render page ${pageIndex + 1}`, err)
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [pdf, pageIndex, renderWidth, visible])

  return (
    <div
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      data-page-index={pageIndex}
      data-status={status}
      data-rendered-page={renderedPage ?? undefined}
      className={`pdf-page relative overflow-hidden bg-white ${className}`}
      style={{ width, height }}
    >
      <div ref={hostRef} className="absolute inset-0" />
      {status !== 'rendered' && status !== 'error' && (
        <div className="pdf-page-placeholder absolute inset-0" aria-hidden="true" />
      )}
      {status === 'error' && (
        <div className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-ink/70">
          This page couldn’t be displayed.
        </div>
      )}
    </div>
  )
}
