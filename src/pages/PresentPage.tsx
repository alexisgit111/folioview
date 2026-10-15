import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDocument } from '../state/DocumentContext'
import { PdfPage } from '../components/viewer/PdfPage'
import { Icon } from '../components/ui/Icon'
import { IconButton } from '../components/ui/Button'
import { containSize } from '../lib/pdf/geometry'
import { isTypingTarget, useElementSize, useIdle, useReducedMotion, useSwipe } from '../lib/hooks'
import { enterFullscreen, exitFullscreen, fullscreenSupported, isFullscreen } from '../lib/features'
import { usePageTransition, useTransitionSettings } from '../lib/pageTransition'
import { TransitionSettings } from '../components/viewer/TransitionSettings'
import { AnnotationLayer } from '../components/annotations/AnnotationLayer'
import { AnnotationToolbar, PenToggle } from '../components/annotations/AnnotationToolbar'
import { useAnnotationShortcuts } from '../components/annotations/useAnnotationShortcuts'
import { useAnnotations } from '../state/AnnotationContext'

const IDLE_MS = 2500
const JUMP_TIMEOUT_MS = 4000

/** Only real mouse movement, wheel or a touch reveals the controls — not keys or clicks. */
const ACTIVITY = {
  events: ['pointermove', 'pointerdown', 'wheel'],
  filter: (e: Event) => {
    const p = e as PointerEvent
    if (e.type === 'pointerdown') return p.pointerType !== 'mouse'
    if (e.type === 'pointermove') return p.pointerType === 'mouse' && (Math.abs(p.movementX) + Math.abs(p.movementY) > 0 || p.movementX === undefined)
    return true
  },
} as const
const STAGE_MARGIN = 24

export function PresentPage() {
  const { doc, page, setPage, getPageSize } = useDocument()
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()
  const [stageRef, stage] = useElementSize<HTMLDivElement>()
  const [fullscreen, setFullscreen] = useState(isFullscreen)
  const [controlsFocused, setControlsFocused] = useState(false)
  const [idle, poke] = useIdle(IDLE_MS, true, ACTIVITY)
  const canFullscreen = fullscreenSupported()
  const wasFullscreen = useRef(isFullscreen())
  const [transition, setTransition] = useTransitionSettings()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const dismissEvent = useRef<Event | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  // Typed slide number (e.g. "1", "12") waiting for Enter.
  const [jump, setJumpState] = useState<{ text: string; error?: boolean }>({ text: '' })
  const jumpRef = useRef('')
  const jumpTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const setJump = (text: string, error = false) => {
    jumpRef.current = error ? '' : text
    setJumpState({ text, error })
    clearTimeout(jumpTimer.current)
    if (text) jumpTimer.current = setTimeout(() => setJump(''), error ? 1400 : JUMP_TIMEOUT_MS)
  }
  useEffect(() => () => clearTimeout(jumpTimer.current), [])
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
      // Enter / Space on a focused button should press that button, not turn the page.
      const onControl = (e.target as HTMLElement | null)?.closest?.('button, a, [role="dialog"]')

      // Number + Enter jumps to that slide.
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        const text = (jumpRef.current + e.key).replace(/^0+/, '').slice(0, 4)
        setJump(text)
        return
      }
      if (jumpRef.current) {
        if (e.key === 'Enter') {
          e.preventDefault()
          const n = parseInt(jumpRef.current, 10)
          if (n >= 1 && n <= doc.pageCount) {
            setPage(n - 1)
            setJump('')
          } else {
            setJump(jumpRef.current, true)
          }
          return
        }
        if (e.key === 'Backspace') {
          e.preventDefault()
          setJump(jumpRef.current.slice(0, -1))
          return
        }
        if (e.key === 'Escape' && !isFullscreen()) {
          e.preventDefault()
          setJump('')
          return
        }
      }

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
          e.preventDefault()
          next()
          break
        case 'Enter':
        case ' ':
          if (onControl) return
          e.preventDefault()
          if (e.key === ' ' && e.shiftKey) prev()
          else next()
          break
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
        case 'Backspace':
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
          if (showHelpRef.current) {
            e.preventDefault()
            setShowHelp(false)
          } else if (!isFullscreen()) {
            e.preventDefault()
            exit()
          }
          break
        case 'f':
        case 'F':
          e.preventDefault()
          void toggleFullscreen()
          break
        case '?':
        case 'h':
        case 'H':
          e.preventDefault()
          setShowHelp((v) => !v)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, next, prev, setPage, exit])
  const showHelpRef = useRef(false)
  showHelpRef.current = showHelp

  const toggleFullscreen = async () => {
    if (isFullscreen()) {
      wasFullscreen.current = false // stay in presentation, just leave fullscreen
      await exitFullscreen()
    } else {
      const ok = await enterFullscreen()
      if (ok) wasFullscreen.current = true
    }
  }

  const swipe = useSwipe((dir) => (dir === 'next' ? next() : prev()), { enabled: !drawing, vertical: true })
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
  const hidden = idle && !controlsFocused && !drawing && !settingsOpen && !showHelp
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
        style={{ touchAction: 'pinch-zoom' }}
        onPointerDown={(e) => {
          // A click that only closes an open menu or help shouldn't also turn the page.
          const dismissing = settingsOpen || dismissEvent.current === e.nativeEvent || showHelp
          downAt.current = dismissing ? null : { x: e.clientX, y: e.clientY }
          if (showHelp) setShowHelp(false)
          swipe.onPointerDown(e)
        }}
        onPointerUp={(e) => {
          swipe.onPointerUp(e)
          const d = downAt.current
          downAt.current = null
          if (drawing || !d || e.button !== 0 || Math.hypot(e.clientX - d.x, e.clientY - d.y) >= 10) return
          // Mouse click: next slide. Touch/pen tap: left third goes back, elsewhere advances.
          if (e.pointerType !== 'mouse' && e.clientX < window.innerWidth / 3) prev()
          else next()
        }}
        onPointerCancel={swipe.onPointerCancel}
        data-testid="present-stage"
      >
        {fit.width > 0 && (
          <div ref={slideWrapRef} className="relative" style={{ width: fit.width, height: fit.height }}>
            <div className="absolute inset-0" data-transition-target="">
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
        onFocusCapture={(e) => setControlsFocused((e.target as HTMLElement).matches(':focus-visible'))}
        onBlurCapture={() => setControlsFocused(false)}
        onPointerMove={poke}
        data-testid="present-controls"
      >
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-4 bg-gradient-to-b from-black/50 to-transparent p-4">
          <p className="max-w-[60%] truncate pt-2 text-sm text-canvas/80">{doc.title}</p>
          <div className="flex items-center gap-1">
            <PenToggle tone="dark" />
            <TransitionSettings
              settings={transition}
              onChange={setTransition}
              tone="dark"
              placement="down"
              align="right"
              onOpenChange={(o, closedBy) => {
                setSettingsOpen(o)
                dismissEvent.current = closedBy ?? null
              }}
            />
            <IconButton variant="dark" icon="keyboard" label="Keyboard shortcuts" pressed={showHelp} onClick={() => setShowHelp((v) => !v)} className="max-sm:hidden" />
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

      {jump.text && (
        <div
          role="status"
          data-testid="present-jump"
          className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg px-6 py-4 text-center text-canvas shadow-dialog backdrop-blur ${
            jump.error ? 'bg-[#9B3B2E]/90' : 'bg-ink/85 ring-1 ring-white/10'
          }`}
        >
          {jump.error ? (
            <p className="text-lg font-semibold">
              No slide {jump.text} — choose 1 to {doc.pageCount}
            </p>
          ) : (
            <>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Go to slide</p>
              <p className="mt-1 font-display text-5xl tabular-nums">
                {jump.text}
                <span className="text-canvas/40"> / {doc.pageCount}</span>
              </p>
              <p className="mt-2 text-xs text-canvas/60">Press Enter ↵ to jump · Backspace to edit</p>
            </>
          )}
        </div>
      )}

      {showHelp && <ShortcutHelp onClose={() => setShowHelp(false)} />}

      <p className="sr-only" aria-live="polite">Slide {page + 1} of {doc.pageCount}</p>
    </div>
  )
}

const SHORTCUTS: Array<[string[], string]> = [
  [['→', '↓', 'Space', 'Enter'], 'Next slide'],
  [['←', '↑', 'Shift+Space', 'Backspace'], 'Previous slide'],
  [['1', '2', '…', 'Enter'], 'Type a number, then Enter to jump'],
  [['Home', 'End'], 'First / last slide'],
  [['Click'], 'Next slide (tap the left third on touch screens to go back)'],
  [['Swipe'], 'Next / previous on phone and iPad'],
  [['P'], 'Draw on the slide'],
  [['F'], 'Toggle fullscreen'],
  [['Esc'], 'Leave fullscreen / end presentation'],
  [['?'], 'Show or hide this list'],
]

function ShortcutHelp({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-label="Keyboard shortcuts"
      data-testid="present-help"
      className="absolute left-1/2 top-1/2 z-20 w-[440px] max-w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-[#0a2a5c]/95 p-5 text-canvas shadow-dialog ring-1 ring-white/10 backdrop-blur"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <p className="font-display text-xl">Presenting shortcuts</p>
        <IconButton variant="dark" size="sm" icon="close" label="Close shortcuts" onClick={onClose} />
      </div>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {SHORTCUTS.map(([keys, what]) => (
          <div key={what} className="contents">
            <dt className="flex flex-wrap content-start items-start gap-1">
              {keys.map((k) => (
                <kbd key={k} className="rounded border border-white/20 bg-white/10 px-1.5 font-sans text-xs font-semibold leading-5">
                  {k}
                </kbd>
              ))}
            </dt>
            <dd className="text-canvas/80">{what}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
