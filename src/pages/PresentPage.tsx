import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDocument } from '../state/DocumentContext'
import { PdfPage } from '../components/viewer/PdfPage'
import { Icon } from '../components/ui/Icon'
import { IconButton } from '../components/ui/Button'
import { containSize } from '../lib/pdf/geometry'
import { isTypingTarget, useElementSize, useIdle, useReducedMotion, useSwipe } from '../lib/hooks'
import { enterFullscreen, exitFullscreen, fullscreenSupported, isFullscreen } from '../lib/features'
import { TRANSITION_LABELS, usePageTransition, useTransitionStyle } from '../lib/pageTransition'
import { AnnotationLayer } from '../components/annotations/AnnotationLayer'
import { AnnotationToolbar, PenToggle } from '../components/annotations/AnnotationToolbar'
import { useAnnotationShortcuts } from '../components/annotations/useAnnotationShortcuts'
import { useAnnotations } from '../state/AnnotationContext'

const IDLE_MS = 2500
const STAGE_MARGIN = 24

export function PresentPage() {
  const { doc, page, setPage, getPageSize } = useDocument()
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()
  const [stageRef, stage] = useElementSize<HTMLDivElement>()
  const [fullscreen, setFullscreen] = useState(isFullscreen)
  const [controlsFocused, setControlsFocused] = useState(false)
  const [idle, poke] = useIdle(IDLE_MS)
  const canFullscreen = fullscreenSupported()
  const wasFullscreen = useRef(isFullscreen())
  const [transition, cycleTransition] = useTransitionStyle()
  const slideWrapRef = useRef<HTMLDivElement>(null)
  const onSlideRendered = usePageTransition(slideWrapRef, page, transition, reducedMotion)
  const { active: drawing } = useAnnotations()
  useAnnotationShortcuts(Boolean(doc))

  const exit = useCallback(() => {
    void exitFullscreen()
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate('/viewer', { replace: true })
  }, [navigate])

  const next = useCallback(() => doc && setPage(Math.min(doc.pageCount - 1, page + 1)), [doc, page, setPage])
  const prev = useCallback(() => setPage(Math.max(0, page - 1)), [page, setPage])

  // Leaving fullscreen (ESC, browser UI, or our button) ends the presentation
  // if it started fullscreen; otherwise just track the state.
  useEffect(() => {
    const onChange = () => {
      const now = isFullscreen()
      setFullscreen(now)
      if (wasFullscreen.current && !now) exit()
      wasFullscreen.current = now
    }
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
    }
  }, [exit])

  // Exit fullscreen if the route unmounts some other way (e.g. browser back).
  useEffect(() => () => void exitFullscreen(), [])

  useEffect(() => {
    if (!doc) return
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.altKey || e.metaKey || e.ctrlKey) return
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          e.preventDefault()
          next()
          break
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault()
          prev()
          break
        case 'Home':
          e.preventDefault()
          setPage(0)
          break
        case 'End':
          e.preventDefault()
          setPage(doc.pageCount - 1)
          break
        case 'Escape':
          // In fullscreen the browser handles ESC and we react to fullscreenchange.
          if (!isFullscreen()) {
            e.preventDefault()
            exit()
          }
          break
        case 'f':
        case 'F':
          e.preventDefault()
          void toggleFullscreen()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, next, prev, setPage, exit])

  const toggleFullscreen = async () => {
    if (isFullscreen()) {
      wasFullscreen.current = false // stay in presentation, just leave fullscreen
      await exitFullscreen()
    } else {
      const ok = await enterFullscreen()
      if (ok) wasFullscreen.current = true
    }
  }

  const swipe = useSwipe((dir) => (dir === 'next' ? next() : prev()), { enabled: !drawing })
  const downAt = useRef<{ x: number; y: number } | null>(null)

  if (!doc) {
    return (
      <div className="grid h-dvh place-items-center bg-navy-deep px-6 text-center text-canvas">
        <div>
          <p className="font-display text-3xl">Nothing to present</p>
          <p className="mt-2 text-sm text-canvas/60">Open a PDF first, then choose Present.</p>
          <Link to="/" className="mt-6 inline-flex h-11 items-center rounded-full bg-canvas px-5 text-sm font-medium text-ink">
            Go to dashboard
          </Link>
        </div>
      </div>
    )
  }

  const size = getPageSize(page)
  const fit = containSize(size, {
    width: Math.max(0, stage.width - STAGE_MARGIN * 2),
    height: Math.max(0, stage.height - STAGE_MARGIN * 2),
  })
  const hidden = idle && !controlsFocused && !drawing
  const fade = reducedMotion ? '' : 'transition-opacity duration-500'

  return (
    <div
      className={`present-root fixed inset-0 select-none bg-navy-deep ${hidden ? 'cursor-none' : ''}`}
      data-controls={hidden ? 'hidden' : 'visible'}
      data-fullscreen={fullscreen}
      aria-label="Presentation"
      role="region"
    >
      <div
        ref={stageRef}
        className="absolute inset-0 isolate grid place-items-center overflow-hidden"
        style={{ touchAction: 'pan-y pinch-zoom' }}
        onPointerDown={(e) => {
          downAt.current = { x: e.clientX, y: e.clientY }
          swipe.onPointerDown(e)
        }}
        onPointerUp={(e) => {
          swipe.onPointerUp(e)
          const d = downAt.current
          downAt.current = null
          // A tap (not a swipe): left third goes back, elsewhere advances.
          if (!drawing && d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 10 && e.button === 0) {
            if (e.clientX < window.innerWidth / 3) prev()
            else next()
          }
        }}
        onPointerCancel={swipe.onPointerCancel}
        data-testid="present-stage"
      >
        {fit.width > 0 && (
          <div ref={slideWrapRef} className="relative" style={{ width: fit.width, height: fit.height }}>
            <PdfPage
              pdf={doc.pdf}
              pageIndex={page}
              width={fit.width}
              height={fit.height}
              label={`Slide ${page + 1} of ${doc.pageCount}`}
              className="shadow-[0_20px_80px_rgba(0,0,0,0.5)]"
              onRendered={onSlideRendered}
            />
            <AnnotationLayer pageIndex={page} width={fit.width} height={fit.height} />
          </div>
        )}
        {/* Warm the next page so advancing feels instant. */}
        {fit.width > 0 && page + 1 < doc.pageCount && (
          <div className="pointer-events-none invisible absolute" aria-hidden="true">
            <PdfPage
              pdf={doc.pdf}
              pageIndex={page + 1}
              width={containSize(getPageSize(page + 1), { width: fit.width, height: fit.height }).width}
              height={containSize(getPageSize(page + 1), { width: fit.width, height: fit.height }).height}
              label=""
            />
          </div>
        )}
      </div>

      {/* Controls */}
      <div
        className={`${fade} ${hidden ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
        onFocusCapture={() => setControlsFocused(true)}
        onBlurCapture={() => setControlsFocused(false)}
        onPointerMove={poke}
        data-testid="present-controls"
      >
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-4 bg-gradient-to-b from-black/50 to-transparent p-4">
          <p className="max-w-[60%] truncate pt-2 text-sm text-canvas/80">{doc.title}</p>
          <div className="flex items-center gap-1">
            <PenToggle tone="dark" />
            <button
              type="button"
              onClick={cycleTransition}
              className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-canvas/85 hover:bg-white/10 hover:text-canvas"
              aria-label={`Page transition: ${TRANSITION_LABELS[transition]}. Click to change.`}
              title="Change page transition"
              data-testid="transition-toggle"
            >
              <Icon name="book" size={16} />
              {TRANSITION_LABELS[transition]}
            </button>
            {canFullscreen && (
              <IconButton
                variant="dark"
                icon={fullscreen ? 'shrink' : 'expand'}
                label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                onClick={() => void toggleFullscreen()}
              />
            )}
            <IconButton variant="dark" icon="close" label="End presentation" onClick={exit} />
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 bg-gradient-to-t from-black/50 to-transparent p-5">
          <AnnotationToolbar page={page} tone="dark" />
          <div className="flex items-center gap-2 rounded-full bg-black/40 px-2 py-1 text-canvas backdrop-blur">
            <IconButton variant="dark" icon="arrow-left" label="Previous slide" onClick={prev} disabled={page === 0} />
            <span className="min-w-16 text-center text-sm tabular-nums" data-testid="present-indicator">
              {page + 1} / {doc.pageCount}
            </span>
            <IconButton variant="dark" icon="arrow-right" label="Next slide" onClick={next} disabled={page >= doc.pageCount - 1} />
          </div>
        </div>
        {!canFullscreen && (
          <p role="note" className="absolute left-1/2 top-16 -translate-x-1/2 rounded-full bg-black/50 px-4 py-2 text-xs text-canvas/80">
            <Icon name="alert" size={14} className="mr-1 inline" /> Fullscreen isn’t available in this browser — presenting in the window.
          </p>
        )}
      </div>

      <p className="sr-only" aria-live="polite">Slide {page + 1} of {doc.pageCount}</p>
    </div>
  )
}
