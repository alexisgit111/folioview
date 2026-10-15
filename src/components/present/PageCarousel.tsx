import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { renderPageToObjectUrl } from '../../lib/pdf/renderImage'
import { PAGE_UNITS, drawStrokes, useAnnotations } from '../../state/AnnotationContext'
import { IconButton } from '../ui/Button'

interface Props {
  pdf: PDFDocumentProxy
  pageCount: number
  /** Page the carousel opens on (0-based). */
  current: number
  getPageSize: (index: number) => { width: number; height: number }
  reducedMotion: boolean
  onPick: (index: number) => void
  onClose: () => void
}

const STEP_DEG = 24 // angle between neighbouring pages on the ring
const VISIBLE = 4 // pages shown either side of the focused one
const ROTATE_MS = 650

/**
 * A 3D "carousel" overview: pages stand on the outside of a slowly turning
 * cylinder. Browse with arrows, wheel, drag or swipe; click a page (or press
 * Enter) to present it.
 */
export function PageCarousel({ pdf, pageCount, current, getPageSize, reducedMotion, onPick, onClose }: Props) {
  const [pos, setPos] = useState(current) // may be fractional while dragging
  const [dragging, setDragging] = useState(false)
  const [leaving, setLeaving] = useState<number | null>(null)
  const [vw, setVw] = useState(() => window.innerWidth)
  const [vh, setVh] = useState(() => window.innerHeight)
  const focus = clamp(Math.round(pos), 0, pageCount - 1)
  const { strokesFor, version } = useAnnotations()
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onResize = () => {
      setVw(window.innerWidth)
      setVh(window.innerHeight)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Card size: the largest first-page box that leaves room for its neighbours.
  const base = getPageSize(focus)
  const cardW = Math.round(Math.min(vw * 0.34, (vh * 0.52 * base.width) / base.height, 720))
  const radius = Math.round((cardW * 1.14) / (2 * Math.sin((STEP_DEG * Math.PI) / 360)))
  const perspective = Math.round(radius * 2.4)

  // ---------------------------------------------------------------- thumbnails
  const [urls, setUrls] = useState<Record<number, string>>({})
  const urlsRef = useRef(urls)
  urlsRef.current = urls
  const thumbW = Math.min(cardW, 640)
  useEffect(() => {
    const ctrl = new AbortController()
    const wanted: number[] = []
    for (let d = 0; d <= VISIBLE + 2; d++) {
      for (const i of d === 0 ? [focus] : [focus + d, focus - d]) if (i >= 0 && i < pageCount && !urlsRef.current[i]) wanted.push(i)
    }
    ;(async () => {
      for (const i of wanted) {
        if (ctrl.signal.aborted) return
        try {
          const page = await pdf.getPage(i + 1)
          const strokes = strokesFor(i)
          const url = await renderPageToObjectUrl(page, thumbW, ctrl.signal, {
            dpr: Math.min(window.devicePixelRatio || 1, 2),
            maxPixels: 1_600_000,
            paint: strokes.length ? (ctx, canvas) => drawStrokes(ctx, strokes, canvas.width / PAGE_UNITS) : undefined,
          })
          if (url) setUrls((u) => ({ ...u, [i]: url }))
        } catch {
          /* a broken page just stays a placeholder */
        }
      }
    })()
    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, pdf, pageCount, thumbW, version])
  useEffect(() => () => Object.values(urlsRef.current).forEach((u) => URL.revokeObjectURL(u)), [])

  // ---------------------------------------------------------------- navigation
  const go = useCallback((to: number) => setPos(clamp(to, 0, pageCount - 1)), [pageCount])
  const pick = useCallback(
    (i: number) => {
      if (leaving !== null) return
      setPos(i)
      setLeaving(i)
      // let the ring turn and the chosen page come forward, then hand over
      window.setTimeout(() => onPick(i), reducedMotion ? 0 : Math.abs(i - pos) > 0.5 ? ROTATE_MS : 380)
    },
    [leaving, onPick, pos, reducedMotion],
  )

  // Keys are captured so the presentation underneath doesn't also react.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key
      const handled = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', 'Enter', ' ', 'Escape'].includes(k)
      if (!handled && !/^[a-z?]$/i.test(k)) return
      e.preventDefault()
      e.stopImmediatePropagation()
      if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown') go(focus + 1)
      else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp') go(focus - 1)
      else if (k === 'Home') go(0)
      else if (k === 'End') go(pageCount - 1)
      else if (k === 'Enter' || k === ' ') pick(focus)
      else if (k === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [focus, go, pick, onClose, pageCount])

  // Wheel / trackpad: one notch or flick moves one page.
  const wheel = useRef({ acc: 0, until: 0 })
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey) return
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      const w = wheel.current
      const now = performance.now()
      if (now < w.until) return
      w.acc += e.deltaMode === 1 ? d * 40 : d
      if (Math.abs(w.acc) >= 40) {
        setPos((p) => clamp(Math.round(p) + (w.acc > 0 ? 1 : -1), 0, pageCount - 1))
        w.acc = 0
        w.until = now + 140
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [pageCount])

  // Drag / swipe to spin; a tap on a card picks it.
  const drag = useRef<{ x: number; start: number; moved: boolean; id: number } | null>(null)
  const pxPerPage = cardW * 0.9
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    drag.current = { x: e.clientX, start: pos, moved: false, id: e.pointerId }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const dx = e.clientX - d.x
    if (!d.moved && Math.abs(dx) < 6) return
    if (!d.moved) {
      d.moved = true
      setDragging(true)
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }
    setPos(clamp(d.start - dx / pxPerPage, -0.4, pageCount - 0.6))
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (!d || d.id !== e.pointerId) return
    if (d.moved) {
      setDragging(false)
      setPos((p) => clamp(Math.round(p), 0, pageCount - 1))
      return
    }
    const card = (e.target as HTMLElement).closest<HTMLElement>('[data-carousel-index]')
    if (card) pick(Number(card.dataset.carouselIndex))
  }

  // ---------------------------------------------------------------- render
  const items = useMemo(() => {
    const list: number[] = []
    for (let i = Math.max(0, focus - VISIBLE - 1); i <= Math.min(pageCount - 1, focus + VISIBLE + 1); i++) list.push(i)
    return list
  }, [focus, pageCount])
  const ease = dragging || reducedMotion ? 'none' : `transform ${ROTATE_MS}ms cubic-bezier(0.22, 0.8, 0.25, 1), opacity ${ROTATE_MS}ms ease`

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label="Page carousel"
      data-testid="page-carousel"
      className="carousel-root fixed inset-0 z-40 select-none overflow-hidden text-canvas"
      style={{ touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        drag.current = null
        setDragging(false)
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,#0b2a5c_0%,#00143a_55%,#000a1f_100%)]" aria-hidden="true" />

      <div className="absolute inset-0 grid place-items-center" style={{ perspective: `${perspective}px`, perspectiveOrigin: '50% 45%' }}>
        <div
          className="relative"
          style={{
            width: cardW,
            height: Math.round((cardW * base.height) / base.width),
            transformStyle: 'preserve-3d',
            transform: `translateZ(${-radius}px)`,
          }}
        >
          {items.map((i) => {
            const size = getPageSize(i)
            const h = Math.round((cardW * size.height) / size.width)
            const off = i - pos
            const angle = off * STEP_DEG
            const hidden = Math.abs(off) > VISIBLE + 0.5
            const chosen = leaving === i
            const isFocus = i === focus
            return (
              <button
                key={i}
                type="button"
                data-carousel-index={i}
                aria-label={`Present page ${i + 1}`}
                aria-current={isFocus ? 'true' : undefined}
                tabIndex={isFocus ? 0 : -1}
                className="carousel-card absolute left-0 top-1/2 block cursor-pointer outline-none"
                style={{
                  width: cardW,
                  height: h,
                  marginTop: -h / 2,
                  transform: `rotateY(${angle}deg) translateZ(${radius + (chosen ? cardW * 0.35 : 0)}px)`,
                  opacity: hidden || (leaving !== null && !chosen) ? 0 : 1,
                  transition: ease,
                  backfaceVisibility: 'hidden',
                  pointerEvents: hidden ? 'none' : 'auto',
                }}
              >
                <span
                  className={`block h-full w-full overflow-hidden rounded-sm bg-white shadow-[0_30px_80px_rgba(0,0,0,0.55)] ring-1 transition-[box-shadow,filter] duration-300 ${
                    isFocus ? 'ring-2 ring-accent' : 'ring-white/10'
                  }`}
                  style={{ filter: `brightness(${Math.max(0.45, 1 - Math.abs(off) * 0.16)})` }}
                >
                  {urls[i] ? (
                    <img src={urls[i]} alt="" draggable={false} className="h-full w-full object-contain" />
                  ) : (
                    <span className="pdf-page-placeholder block h-full w-full" />
                  )}
                </span>
                <span
                  className="carousel-reflection pointer-events-none absolute inset-x-0 top-full mt-2 block h-1/3 overflow-hidden rounded-sm opacity-25"
                  aria-hidden="true"
                  style={{ maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent 85%)', WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent 85%)' }}
                >
                  {urls[i] && <img src={urls[i]} alt="" draggable={false} className="block w-full -scale-y-100" style={{ height: h }} />}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Caption + hints */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 pb-8 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-accent">Page carousel</p>
        <p className="font-display text-3xl tabular-nums" data-testid="carousel-indicator" aria-live="polite">
          {focus + 1} <span className="text-canvas/45">/ {pageCount}</span>
        </p>
        <p className="text-sm text-canvas/60">Click a page to present it · ← → or scroll to browse · Esc to go back</p>
      </div>

      <div className="absolute right-4 top-4" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
        <IconButton variant="dark" icon="close" label="Close carousel" onClick={onClose} className="bg-black/40" />
      </div>
      <div
        className="absolute inset-y-0 left-4 flex items-center max-sm:hidden"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        <IconButton variant="dark" size="lg" icon="arrow-left" label="Previous in carousel" onClick={() => go(focus - 1)} disabled={focus === 0} className="bg-black/40" />
      </div>
      <div
        className="absolute inset-y-0 right-4 flex items-center max-sm:hidden"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        <IconButton
          variant="dark"
          size="lg"
          icon="arrow-right"
          label="Next in carousel"
          onClick={() => go(focus + 1)}
          disabled={focus >= pageCount - 1}
          className="bg-black/40"
        />
      </div>
    </div>
  )
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n))
}
