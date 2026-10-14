import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useDocument } from '../state/DocumentContext'
import { useFilePicker } from '../components/FilePicker'
import { Button, IconButton } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { Flipbook } from '../components/viewer/Flipbook'
import { SinglePage } from '../components/viewer/SinglePage'
import { isViewerMode, type NavigationHandle, type ViewerMode } from '../components/viewer/types'
import { isTypingTarget, useIsNarrow, useReducedMotion } from '../lib/hooks'
import { clampZoom, nextZoom, type ZoomMode } from '../lib/pdf/geometry'
import { describeSpread, spreadForPage } from '../lib/pdf/spreads'
import { enterFullscreen } from '../lib/features'
import { EmptyState } from '../components/EmptyState'
import { TRANSITION_LABELS, useTransitionStyle } from '../lib/pageTransition'

export function ViewerPage() {
  const { doc, page, setPage, getPageSize } = useDocument()
  const openPicker = useFilePicker()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const narrow = useIsNarrow()
  const reducedMotion = useReducedMotion()

  const requested = params.get('mode')
  const mode: ViewerMode = isViewerMode(requested) ? requested : narrow ? 'single' : 'flipbook'
  const setMode = useCallback((m: ViewerMode) => setParams((p) => {
    p.set('mode', m)
    return p
  }, { replace: true }), [setParams])

  // Pin the screen-size default into the URL once, so rotating a tablet or
  // resizing the window never switches modes under the reader.
  useEffect(() => {
    if (!isViewerMode(requested)) setMode(mode)
  }, [requested, mode, setMode])

  const [zoomMode, setZoomMode] = useState<ZoomMode>(narrow ? 'fit-width' : 'fit-page')
  const [zoom, setZoom] = useState(1)
  const [effectiveZoom, setEffectiveZoom] = useState(1)
  const [showThumbs, setShowThumbs] = useState(true)
  const [flipPortrait, setFlipPortrait] = useState(false)
  const navRef = useRef<NavigationHandle>(null)
  const [transition, cycleTransition] = useTransitionStyle()

  const pageCount = doc?.pageCount ?? 0
  const spread = mode === 'flipbook' && !flipPortrait && !narrow ? spreadForPage(page, pageCount) : [page]
  const atStart = spread[0] <= 0
  const atEnd = spread[spread.length - 1] >= pageCount - 1

  const next = useCallback(() => navRef.current?.next(), [])
  const prev = useCallback(() => navRef.current?.prev(), [])

  const zoomBy = useCallback((dir: 1 | -1) => {
    setZoom(clampZoom(nextZoom(effectiveZoom, dir)))
    setZoomMode('custom')
  }, [effectiveZoom])

  const present = async () => {
    // Must run inside the click so the browser accepts the fullscreen request.
    await enterFullscreen()
    navigate('/present')
  }

  useEffect(() => {
    if (!doc) return
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isTypingTarget(e.target) || e.altKey || e.metaKey || e.ctrlKey) return
      if (document.querySelector('dialog[open]')) return
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
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
        case '+':
        case '=':
          if (mode === 'single') {
            e.preventDefault()
            zoomBy(1)
          }
          break
        case '-':
          if (mode === 'single') {
            e.preventDefault()
            zoomBy(-1)
          }
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doc, mode, next, prev, setPage, zoomBy])

  if (!doc) {
    return (
      <EmptyState
        title="No document open"
        body="Open a PDF from your device or pick a demo document. Files are read in this browser tab only and are not saved anywhere."
        actions={
          <>
            <Button variant="primary" icon="upload" onClick={openPicker}>Open a PDF</Button>
            <Link to="/" className="inline-flex h-11 items-center rounded-full px-4 text-sm font-medium text-ink/80 hover:bg-stone/50">
              Back to dashboard
            </Link>
          </>
        }
      />
    )
  }

  const pageLabel = describeSpread(spread, pageCount)

  return (
    <div className="flex h-dvh flex-col bg-canvas text-ink">
      {/* Top bar */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-stone/80 px-2 sm:gap-3 sm:px-4">
        <Link
          to="/"
          aria-label="Back to dashboard"
          title="Back to dashboard"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink/80 hover:bg-stone/50"
        >
          <Icon name="back" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg leading-tight sm:text-xl" title={doc.title}>{doc.title}</h1>
          <p className="truncate text-xs text-ink/55">
            {pageCount} {pageCount === 1 ? 'page' : 'pages'} · {doc.origin === 'demo' ? 'Bundled demo' : 'Local file, not uploaded'}
          </p>
        </div>

        <div role="radiogroup" aria-label="View mode" className="flex shrink-0 rounded-full border border-stone bg-white/60 p-1">
          {([
            ['flipbook', 'Flipbook', 'book'],
            ['single', 'Single page', 'page'],
          ] as const).map(([m, label, icon]) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              aria-label={label}
              title={label}
              onClick={() => setMode(m)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors ${mode === m ? 'bg-ink text-canvas' : 'text-ink/70 hover:text-ink'}`}
            >
              <Icon name={icon} size={17} />
              <span className="hidden lg:inline">{label}</span>
            </button>
          ))}
        </div>

        <Button variant="primary" icon="present" onClick={present} className="shrink-0 max-sm:w-11 max-sm:px-0" aria-label="Present fullscreen">
          <span className="hidden sm:inline">Present</span>
        </Button>
        <IconButton icon="upload" label="Open another PDF" onClick={openPicker} className="max-sm:hidden" />
      </header>

      {/* Stage */}
      <main className={`relative min-h-0 flex-1 ${mode === 'flipbook' ? 'flip-stage-bg' : 'bg-[#EEEDE8]'}`} aria-label="Document viewer">
        {mode === 'flipbook' ? (
          <div className="absolute inset-0 px-3 py-6 sm:px-16 sm:py-10">
            <Flipbook
              key={doc.id}
              ref={navRef}
              doc={doc}
              page={page}
              onPageChange={setPage}
              reducedMotion={reducedMotion}
              portrait={narrow}
              onOrientationChange={setFlipPortrait}
            />
            <SideArrow side="left" disabled={atStart} onClick={prev} />
            <SideArrow side="right" disabled={atEnd} onClick={next} />
          </div>
        ) : (
          <SinglePage
            key={doc.id}
            ref={navRef}
            doc={doc}
            page={page}
            onPageChange={setPage}
            zoomMode={zoomMode}
            zoom={zoom}
            onEffectiveZoom={setEffectiveZoom}
            showThumbnails={showThumbs}
            getPageSize={getPageSize}
            transition={transition}
            reducedMotion={reducedMotion}
          />
        )}
      </main>

      {/* Bottom bar */}
      <footer className="flex h-16 shrink-0 items-center justify-between gap-2 border-t border-stone/80 bg-canvas px-2 sm:px-4">
        <div className="flex items-center gap-1">
          {mode === 'single' && (
            <IconButton
              icon="thumbs"
              label={showThumbs ? 'Hide thumbnails' : 'Show thumbnails'}
              pressed={showThumbs}
              onClick={() => setShowThumbs((v) => !v)}
              className="max-md:hidden"
            />
          )}
          {mode === 'single' && (
            <button
              type="button"
              onClick={cycleTransition}
              className="inline-flex h-11 items-center gap-1.5 rounded-full px-2 text-xs font-medium text-ink/70 hover:bg-stone/50 hover:text-ink sm:px-3"
              aria-label={`Page transition: ${TRANSITION_LABELS[transition]}. Click to change.`}
              title="Change page transition"
              data-testid="transition-toggle"
            >
              <Icon name="book" size={17} />
              <span className="hidden lg:inline">{TRANSITION_LABELS[transition]}</span>
            </button>
          )}
        </div>

        <nav aria-label="Page navigation" className="flex items-center gap-1 sm:gap-2">
          <IconButton icon="arrow-left" label="Previous page" onClick={prev} disabled={atStart} />
          <PageInput page={spread[0]} spread={spread} pageCount={pageCount} onGo={setPage} />
          <IconButton icon="arrow-right" label="Next page" onClick={next} disabled={atEnd} />
        </nav>

        <div className="flex items-center gap-0.5">
          {mode === 'single' && (
            <>
              <IconButton icon="minus" label="Zoom out" size="sm" onClick={() => zoomBy(-1)} disabled={effectiveZoom <= 0.26} />
              <span className="w-12 text-center text-xs tabular-nums text-ink/70" aria-live="polite" aria-label={`Zoom ${Math.round(effectiveZoom * 100)} percent`}>
                {Math.round(effectiveZoom * 100)}%
              </span>
              <IconButton icon="plus" label="Zoom in" size="sm" onClick={() => zoomBy(1)} disabled={effectiveZoom >= 3.99} />
              <IconButton icon="fit-width" label="Fit width" size="sm" pressed={zoomMode === 'fit-width'} onClick={() => setZoomMode('fit-width')} className="max-sm:hidden" />
              <IconButton icon="fit-page" label="Fit page" size="sm" pressed={zoomMode === 'fit-page'} onClick={() => setZoomMode('fit-page')} className="max-sm:hidden" />
            </>
          )}
        </div>
      </footer>

      <p className="sr-only" aria-live="polite" data-testid="page-announcer">{pageLabel}</p>
    </div>
  )
}

function SideArrow({ side, disabled, onClick }: { side: 'left' | 'right'; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === 'left' ? 'Previous page' : 'Next page'}
      tabIndex={-1}
      className={`absolute top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-canvas/80 text-ink shadow-sm ring-1 ring-stone backdrop-blur transition-opacity hover:bg-canvas disabled:pointer-events-none disabled:opacity-0 max-sm:hidden ${side === 'left' ? 'left-2' : 'right-2'}`}
    >
      <Icon name={side === 'left' ? 'arrow-left' : 'arrow-right'} />
    </button>
  )
}

function PageInput({ page, spread, pageCount, onGo }: { page: number; spread: number[]; pageCount: number; onGo: (i: number) => void }) {
  const [value, setValue] = useState(String(page + 1))
  useEffect(() => setValue(String(page + 1)), [page])
  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    const n = parseInt(value, 10)
    if (Number.isFinite(n)) onGo(Math.max(1, Math.min(pageCount, n)) - 1)
    else setValue(String(page + 1))
  }
  return (
    <form onSubmit={submit} className="flex items-center gap-1.5 text-sm tabular-nums">
      <label htmlFor="page-input" className="sr-only">Go to page</label>
      <input
        id="page-input"
        inputMode="numeric"
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={() => submit()}
        onFocus={(e) => e.target.select()}
        className="h-9 w-12 rounded-md border border-stone bg-white text-center outline-none focus:border-ink/40"
        data-testid="page-input"
      />
      <span className="whitespace-nowrap text-ink/60" data-testid="page-indicator">
        {spread.length > 1 ? `–${spread[1] + 1} ` : ''}/ {pageCount}
      </span>
    </form>
  )
}
