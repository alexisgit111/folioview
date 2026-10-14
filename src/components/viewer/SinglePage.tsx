import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { OpenDocument } from '../../state/DocumentContext'
import { useElementSize, useSwipe } from '../../lib/hooks'
import { fitScale, type ZoomMode } from '../../lib/pdf/geometry'
import { PdfPage } from './PdfPage'
import { usePageTransition, type TransitionStyle } from '../../lib/pageTransition'
import { AnnotationLayer } from '../annotations/AnnotationLayer'
import { AnnotationToolbar } from '../annotations/AnnotationToolbar'
import { useAnnotations } from '../../state/AnnotationContext'
import type { NavigationHandle } from './types'

/** PDF.js convention: "100%" shows 72pt as 96 CSS px. */
export const CSS_UNITS = 96 / 72

interface SinglePageProps {
  doc: OpenDocument
  page: number
  onPageChange: (page: number) => void
  zoomMode: ZoomMode
  /** Custom zoom (1 = 100%) used when zoomMode is 'custom'. */
  zoom: number
  /** Reports the effective zoom so the toolbar can show it. */
  onEffectiveZoom: (zoom: number) => void
  showThumbnails: boolean
  getPageSize: (index: number) => { width: number; height: number }
  transition: TransitionStyle
  reducedMotion: boolean
}

const STAGE_PADDING = 24

export const SinglePage = forwardRef<NavigationHandle, SinglePageProps>(function SinglePage(
  { doc, page, onPageChange, zoomMode, zoom, onEffectiveZoom, showThumbnails, getPageSize, transition, reducedMotion },
  ref,
) {
  const [stageRef, stage] = useElementSize<HTMLDivElement>()
  const pageWrapRef = useRef<HTMLDivElement>(null)
  const onPageRendered = usePageTransition(pageWrapRef, page, transition, reducedMotion)
  const { active: drawing } = useAnnotations()
  const size = getPageSize(page)
  // useElementSize reports the content box, i.e. already inside the padding.
  const box = { width: Math.max(0, stage.width), height: Math.max(0, stage.height) }
  const scale = zoomMode === 'custom' ? zoom * CSS_UNITS : fitScale(size, box, zoomMode)
  const width = Math.max(1, Math.floor(size.width * scale))
  const height = Math.max(1, Math.floor(size.height * scale))
  const overflowsX = width > box.width + 1

  useEffect(() => {
    if (stage.width > 0) onEffectiveZoom(scale / CSS_UNITS)
  }, [scale, stage.width, onEffectiveZoom])

  // Return to the top of a page when it changes.
  useEffect(() => {
    stageRef.current?.scrollTo({ top: 0, left: stageRef.current.scrollLeft })
  }, [page, stageRef])

  useImperativeHandle(ref, () => ({
    next: () => onPageChange(Math.min(doc.pageCount - 1, page + 1)),
    prev: () => onPageChange(Math.max(0, page - 1)),
  }), [doc.pageCount, page, onPageChange])

  const swipe = useSwipe((dir) => onPageChange(dir === 'next' ? page + 1 : page - 1), { enabled: !overflowsX && !drawing })

  return (
    <div className="flex h-full min-h-0 w-full">
      {showThumbnails && (
        <ThumbnailRail doc={doc} page={page} onSelect={onPageChange} getPageSize={getPageSize} />
      )}
      <div className="relative flex min-w-0 flex-1">
      {drawing && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-3">
          <div className="pointer-events-auto">
            <AnnotationToolbar page={page} />
          </div>
        </div>
      )}
      <div
        ref={stageRef}
        className="single-stage relative min-w-0 flex-1 overflow-auto overscroll-contain"
        style={{
          padding: STAGE_PADDING,
          // leave room for the floating drawing toolbar
          paddingTop: drawing ? STAGE_PADDING + 64 : STAGE_PADDING,
          touchAction: overflowsX ? 'auto' : 'pan-y pinch-zoom',
        }}
        {...swipe}
        data-testid="single-stage"
        data-drawing={drawing}
      >
        {stage.width > 0 && (
          <div
            ref={pageWrapRef}
            className="relative mx-auto flex min-h-full items-center justify-center"
            style={{ width: Math.max(width, box.width) }}
          >
            <div className="relative" style={{ width, height }}>
              <PdfPage
                onRendered={onPageRendered}
                pdf={doc.pdf}
                pageIndex={page}
                width={width}
                height={height}
                label={`Page ${page + 1} of ${doc.pageCount}`}
                className="shadow-page"
              />
              <AnnotationLayer pageIndex={page} width={width} height={height} />
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  )
})

const THUMB_WIDTH = 104

function ThumbnailRail({
  doc,
  page,
  onSelect,
  getPageSize,
}: {
  doc: OpenDocument
  page: number
  onSelect: (i: number) => void
  getPageSize: (i: number) => { width: number; height: number }
}) {
  // Callback ref + state so the lazy thumbnails observe the rail itself.
  const [rail, setRail] = useState<HTMLElement | null>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [page])

  return (
    <nav
      ref={setRail}
      aria-label="Page thumbnails"
      className="thumb-rail hidden w-[152px] shrink-0 overflow-y-auto border-r border-stone/70 bg-canvas/60 px-4 py-4 md:block"
    >
      <ol className="space-y-4">
        {Array.from({ length: doc.pageCount }, (_, i) => {
          const s = getPageSize(i)
          const h = Math.round((THUMB_WIDTH * s.height) / s.width)
          const active = i === page
          return (
            <li key={i}>
              <button
                ref={active ? activeRef : undefined}
                type="button"
                onClick={() => onSelect(i)}
                aria-label={`Go to page ${i + 1}`}
                aria-current={active ? 'page' : undefined}
                className={`thumb group block w-full rounded-sm p-1 text-center transition-colors ${active ? 'bg-accent/25' : 'hover:bg-stone/50'}`}
              >
                <PdfPage
                  pdf={doc.pdf}
                  pageIndex={i}
                  width={THUMB_WIDTH}
                  height={h}
                  label=""
                  lazy
                  scrollRoot={rail}
                  className={`mx-auto ring-1 ${active ? 'ring-accent' : 'ring-stone'}`}
                />
                <span className={`mt-1.5 block text-[11px] tabular-nums ${active ? 'font-semibold text-ink' : 'text-ink/60'}`}>
                  {i + 1}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
