import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

export type TransitionStyle = 'turn' | 'fade' | 'none'

export const TRANSITION_LABELS: Record<TransitionStyle, string> = {
  turn: 'Page turn',
  fade: 'Fade',
  none: 'No animation',
}

const STORAGE_KEY = 'fv.transition'
const ORDER: TransitionStyle[] = ['turn', 'fade', 'none']

function readStored(): TransitionStyle {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'turn' || v === 'fade' || v === 'none') return v
  } catch {
    /* storage unavailable */
  }
  return 'turn'
}

/** Remembered per browser; shared by single-page and presentation modes. */
export function useTransitionStyle(): [TransitionStyle, () => void] {
  const [style, setStyle] = useState<TransitionStyle>(readStored)
  const cycle = useCallback(() => {
    setStyle((s) => {
      const next = ORDER[(ORDER.indexOf(s) + 1) % ORDER.length]
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])
  return [style, cycle]
}

interface Pending {
  overlay: HTMLCanvasElement
  direction: 1 | -1
  safety: ReturnType<typeof setTimeout>
}

const TURN_MS = 650
const FADE_MS = 320

/**
 * Animates page changes for a single rendered page.
 *
 * Before the new page renders, the currently visible canvas is copied into an
 * overlay positioned exactly on top of it. When the new page has rendered
 * underneath (`onRendered`), the overlay is animated away — turned over like
 * a sheet of paper, or faded — and then removed. The real canvases are never
 * transformed, so the page stays pixel-sharp.
 */
export function usePageTransition(
  containerRef: RefObject<HTMLElement | null>,
  page: number,
  style: TransitionStyle,
  reducedMotion: boolean,
): () => void {
  const prevPage = useRef(page)
  const pending = useRef<Pending | null>(null)
  const running = useRef<Animation[]>([])

  const clearPending = () => {
    if (!pending.current) return
    clearTimeout(pending.current.safety)
    pending.current.overlay.remove()
    pending.current = null
  }
  const finishRunning = () => {
    running.current.forEach((a) => a.finish())
    running.current = []
  }

  useLayoutEffect(() => {
    const from = prevPage.current
    prevPage.current = page
    if (from === page) return
    finishRunning()
    clearPending()
    if (style === 'none' || reducedMotion) return

    const container = containerRef.current
    const canvas = container?.querySelector<HTMLCanvasElement>('canvas[data-pdf-canvas]')
    if (!container || !canvas || canvas.width === 0) return
    const cRect = container.getBoundingClientRect()
    const pRect = canvas.getBoundingClientRect()
    if (pRect.width === 0) return

    const overlay = document.createElement('canvas')
    overlay.width = canvas.width
    overlay.height = canvas.height
    overlay.getContext('2d')?.drawImage(canvas, 0, 0)
    overlay.className = 'page-transition-overlay'
    overlay.setAttribute('aria-hidden', 'true')
    Object.assign(overlay.style, {
      position: 'absolute',
      left: `${pRect.left - cRect.left + container.scrollLeft}px`,
      top: `${pRect.top - cRect.top + container.scrollTop}px`,
      width: `${pRect.width}px`,
      height: `${pRect.height}px`,
      pointerEvents: 'none',
      zIndex: '5',
      backfaceVisibility: 'hidden',
    })
    container.appendChild(overlay)
    const direction: 1 | -1 = page > from ? 1 : -1
    // If the new page never renders (error, very slow), don't leave the old one on top.
    const safety = setTimeout(() => {
      if (pending.current?.overlay === overlay) animateOut()
    }, 4000)
    pending.current = { overlay, direction, safety }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const animateOut = useCallback(() => {
    const p = pending.current
    if (!p) return
    pending.current = null
    clearTimeout(p.safety)
    const { overlay, direction } = p
    const container = containerRef.current
    const newPage = container?.querySelector<HTMLElement>('.pdf-page')
    const done = () => overlay.remove()

    if (style === 'fade' || typeof overlay.animate !== 'function') {
      if (typeof overlay.animate !== 'function') return done()
      const a = overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: 'ease-out' })
      running.current.push(a)
      a.onfinish = a.oncancel = done
      return
    }

    // Page turn: the old sheet hinges on its spine edge and swings toward the
    // viewer, darkening as it turns, while the new page brightens beneath it.
    overlay.style.transformOrigin = direction > 0 ? 'left center' : 'right center'
    overlay.style.boxShadow = '0 0 40px rgba(0,0,0,0.25)'
    const angle = direction > 0 ? -95 : 95
    // Scale the perspective with the page so wide slides don't distort.
    const persp = `perspective(${Math.round(Math.max(2200, overlay.offsetWidth * 2.6))}px)`
    const a = overlay.animate(
      [
        { transform: `${persp} rotateY(0deg)`, filter: 'brightness(1)', opacity: 1 },
        { transform: `${persp} rotateY(${angle * 0.55}deg)`, filter: 'brightness(0.85)', opacity: 1, offset: 0.55 },
        { transform: `${persp} rotateY(${angle}deg)`, filter: 'brightness(0.55)', opacity: 0 },
      ],
      { duration: TURN_MS, easing: 'cubic-bezier(0.45, 0.05, 0.35, 1)' },
    )
    running.current.push(a)
    a.onfinish = a.oncancel = done
    if (newPage) {
      const b = newPage.animate(
        [{ filter: 'brightness(0.72)' }, { filter: 'brightness(1)' }],
        { duration: TURN_MS, easing: 'ease-out' },
      )
      running.current.push(b)
    }
  }, [containerRef, style])

  useEffect(() => () => {
    finishRunning()
    clearPending()
  }, [])

  return animateOut
}
