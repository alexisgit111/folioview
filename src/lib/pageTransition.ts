import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

export type TransitionStyle =
  | 'turn'
  | 'slide'
  | 'zoom'
  | 'cube'
  | 'flip'
  | 'wipe'
  | 'cover'
  | 'reveal'
  | 'drop'
  | 'fade'
  | 'none'

export const TRANSITION_LABELS: Record<TransitionStyle, string> = {
  turn: 'Page turn',
  slide: 'Slide',
  zoom: 'Zoom',
  cube: 'Cube',
  flip: 'Flip',
  wipe: 'Wipe',
  cover: 'Cover / Stack',
  reveal: 'Reveal',
  drop: 'Drop',
  fade: 'Fade',
  none: 'No animation',
}

/** Menu order. */
export const TRANSITION_STYLES = Object.keys(TRANSITION_LABELS) as TransitionStyle[]

const STORAGE_KEY = 'fv.transition'

function isStyle(v: unknown): v is TransitionStyle {
  return typeof v === 'string' && v in TRANSITION_LABELS
}

function readStored(): TransitionStyle {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (isStyle(v)) return v
  } catch {
    /* storage unavailable */
  }
  return 'turn'
}

/** Remembered per browser; shared by single-page and presentation modes. */
export function useTransitionStyle(): [TransitionStyle, (next: TransitionStyle) => void] {
  const [style, setStyle] = useState<TransitionStyle>(readStored)
  const choose = useCallback((next: TransitionStyle) => {
    if (!isStyle(next)) return
    setStyle(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }, [])
  return [style, choose]
}

interface Pending {
  overlay: HTMLCanvasElement
  direction: 1 | -1
  safety: ReturnType<typeof setTimeout>
}

const TURN_MS = 650
const FADE_MS = 320
const DROP_MS = 820

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
    const ctx = overlay.getContext('2d')
    ctx?.drawImage(canvas, 0, 0)
    // Carry any drawn annotations along with the page.
    const annot = container.querySelector<HTMLCanvasElement>('canvas[data-annot-canvas]')
    if (ctx && annot && annot.width > 0) ctx.drawImage(annot, 0, 0, overlay.width, overlay.height)
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
    const done = () => overlay.remove()
    if (typeof overlay.animate !== 'function') return done()

    // The element holding the new page and its drawings; it moves as one.
    const incoming =
      container?.querySelector<HTMLElement>('[data-transition-target]') ?? container?.querySelector<HTMLElement>('.pdf-page') ?? null
    const stage = clipAncestor(container)
    const anims = runTransition(style, overlay, incoming, direction, stage)
    running.current.push(...anims)

    // Keep the stage from growing scrollbars while pages travel outside it.
    const restoreOverflow = stage && stage !== document.documentElement ? lockOverflow(stage) : () => {}
    const restoreZ = style === 'cover' && incoming ? raise(incoming) : () => {}
    const cleanup = () => {
      done()
      restoreOverflow()
      restoreZ()
    }
    if (!anims.length) return cleanup()
    Promise.allSettled(anims.map((a) => a.finished)).then(cleanup)
  }, [containerRef, style])

  useEffect(() => () => {
    finishRunning()
    clearPending()
  }, [])

  return animateOut
}

/* ------------------------------------------------------------------ */

const EASE_INOUT = 'cubic-bezier(0.65, 0, 0.35, 1)'
const EASE_OUT = 'cubic-bezier(0.22, 0.61, 0.36, 1)'

/**
 * Builds the animations for one page change. `old` is the snapshot of the
 * outgoing page (on top by default); `incoming` is the freshly rendered page.
 * Returns the animations; the first one is the main one.
 */
function runTransition(
  style: TransitionStyle,
  old: HTMLCanvasElement,
  incoming: HTMLElement | null,
  dir: 1 | -1,
  stage: HTMLElement | null,
): Animation[] {
  const out: Animation[] = []
  const anim = (el: Element | null, frames: Keyframe[], opts: KeyframeAnimationOptions) => {
    if (!el) return
    out.push(el.animate(frames, opts))
  }
  const w = old.offsetWidth
  const persp = `perspective(${Math.round(Math.max(2200, w * 2.6))}px)`
  // Far enough to leave the visible stage entirely.
  const travel = Math.round(Math.max(stage?.clientWidth ?? window.innerWidth, w) + 24)

  switch (style) {
    case 'fade':
      anim(old, [{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: 'ease-out' })
      break

    case 'slide': {
      const ms = 520
      anim(old, [{ transform: 'translateX(0)' }, { transform: `translateX(${-dir * travel}px)` }], { duration: ms, easing: EASE_INOUT })
      anim(incoming, [{ transform: `translateX(${dir * travel}px)` }, { transform: 'translateX(0)' }], { duration: ms, easing: EASE_INOUT })
      break
    }

    case 'zoom': {
      // Forward: the old page grows past you and fades; the new one rises up
      // from behind. Backward is the reverse.
      const ms = 480
      const oldTo = dir > 0 ? 1.18 : 0.82
      const newFrom = dir > 0 ? 0.82 : 1.18
      anim(old, [{ transform: 'scale(1)', opacity: 1 }, { transform: `scale(${oldTo})`, opacity: 0 }], { duration: ms, easing: EASE_OUT })
      anim(incoming, [{ transform: `scale(${newFrom})`, opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: ms, easing: EASE_OUT })
      break
    }

    case 'cube': {
      // Two faces of a cube sharing an edge, rotating a quarter turn.
      const ms = 720
      old.style.transformOrigin = dir > 0 ? 'right center' : 'left center'
      if (incoming) incoming.style.transformOrigin = dir > 0 ? 'left center' : 'right center'
      anim(
        old,
        [
          { transform: `${persp} translateX(0) rotateY(0deg)`, filter: 'brightness(1)' },
          { transform: `${persp} translateX(${-dir * 100}%) rotateY(${-dir * 90}deg)`, filter: 'brightness(0.45)' },
        ],
        { duration: ms, easing: EASE_INOUT },
      )
      anim(
        incoming,
        [
          { transform: `${persp} translateX(${dir * 100}%) rotateY(${dir * 90}deg)`, filter: 'brightness(0.45)' },
          { transform: `${persp} translateX(0) rotateY(0deg)`, filter: 'brightness(1)' },
        ],
        { duration: ms, easing: EASE_INOUT },
      )
      if (incoming) {
        const reset = () => void (incoming.style.transformOrigin = '')
        out[out.length - 1].finished.then(reset, reset)
      }
      break
    }

    case 'flip': {
      // A card flipping over: the old face turns edge-on, the new face turns in.
      const half = 320
      anim(
        old,
        [
          { transform: `${persp} rotateY(0deg)`, filter: 'brightness(1)' },
          { transform: `${persp} rotateY(${-dir * 90}deg)`, filter: 'brightness(0.6)' },
        ],
        { duration: half, easing: 'cubic-bezier(0.5, 0, 0.9, 0.5)', fill: 'forwards' },
      )
      anim(
        incoming,
        [
          { transform: `${persp} rotateY(${dir * 90}deg)`, filter: 'brightness(0.6)' },
          { transform: `${persp} rotateY(0deg)`, filter: 'brightness(1)' },
        ],
        { duration: half, delay: half, easing: 'cubic-bezier(0.1, 0.5, 0.5, 1)', fill: 'backwards' },
      )
      break
    }

    case 'wipe': {
      // A straight edge sweeps across in the reading direction, uncovering the new page.
      const ms = 560
      const end = dir > 0 ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)'
      anim(old, [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: end }], { duration: ms, easing: EASE_INOUT })
      break
    }

    case 'cover': {
      // The new page slides in on top of the old one, which sinks back into the stack.
      const ms = 560
      old.style.zIndex = '0'
      anim(
        incoming,
        [
          { transform: `translateX(${dir * travel}px)`, boxShadow: '0 0 0 rgba(0,0,0,0)' },
          { transform: 'translateX(0)', boxShadow: '0 20px 60px rgba(0,20,58,0.35)', offset: 0.85 },
          { transform: 'translateX(0)', boxShadow: '0 0 0 rgba(0,0,0,0)' },
        ],
        { duration: ms, easing: EASE_OUT },
      )
      anim(old, [{ transform: 'scale(1)', filter: 'brightness(1)' }, { transform: 'scale(0.92)', filter: 'brightness(0.55)' }], {
        duration: ms,
        easing: EASE_OUT,
        fill: 'forwards',
      })
      break
    }

    case 'reveal': {
      // The old page slides away, revealing the new page waiting underneath.
      const ms = 560
      old.style.boxShadow = '0 20px 60px rgba(0,20,58,0.35)'
      anim(old, [{ transform: 'translateX(0)' }, { transform: `translateX(${-dir * travel}px)` }], { duration: ms, easing: EASE_INOUT })
      anim(incoming, [{ transform: 'scale(0.94)', filter: 'brightness(0.6)' }, { transform: 'scale(1)', filter: 'brightness(1)' }], {
        duration: ms,
        easing: EASE_OUT,
      })
      break
    }

    case 'drop': {
      // The sheet slides a little in the reading direction, tips, then falls
      // away under "gravity" (accelerating ease-in) and fades as it leaves.
      const fall = Math.round((stage?.clientHeight ?? window.innerHeight) * 1.1)
      const side = dir > 0 ? -1 : 1
      old.style.transformOrigin = dir > 0 ? 'left bottom' : 'right bottom'
      old.style.boxShadow = '0 24px 60px rgba(0,0,0,0.3)'
      anim(
        old,
        [
          { transform: 'translate(0, 0) rotate(0deg)', opacity: 1, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' },
          { transform: `translate(${side * 6}%, -2%) rotate(${side * -3}deg)`, opacity: 1, offset: 0.22, easing: 'cubic-bezier(0.55, 0, 0.9, 0.4)' },
          { transform: `translate(${side * 14}%, ${fall}px) rotate(${side * 14}deg)`, opacity: 0.6 },
        ],
        { duration: DROP_MS },
      )
      anim(incoming, [{ transform: 'scale(0.97)', filter: 'brightness(0.8)' }, { transform: 'scale(1)', filter: 'brightness(1)' }], {
        duration: DROP_MS * 0.7,
        easing: 'ease-out',
        delay: DROP_MS * 0.15,
        fill: 'backwards',
      })
      break
    }

    case 'turn':
    default: {
      // Page turn: the old sheet hinges on its spine edge and swings toward the
      // viewer, darkening as it turns, while the new page brightens beneath it.
      old.style.transformOrigin = dir > 0 ? 'left center' : 'right center'
      old.style.boxShadow = '0 0 40px rgba(0,0,0,0.25)'
      const angle = dir > 0 ? -95 : 95
      anim(
        old,
        [
          { transform: `${persp} rotateY(0deg)`, filter: 'brightness(1)', opacity: 1 },
          { transform: `${persp} rotateY(${angle * 0.55}deg)`, filter: 'brightness(0.85)', opacity: 1, offset: 0.55 },
          { transform: `${persp} rotateY(${angle}deg)`, filter: 'brightness(0.55)', opacity: 0 },
        ],
        { duration: TURN_MS, easing: 'cubic-bezier(0.45, 0.05, 0.35, 1)' },
      )
      anim(incoming, [{ filter: 'brightness(0.72)' }, { filter: 'brightness(1)' }], { duration: TURN_MS, easing: 'ease-out' })
    }
  }
  return out
}

/** Nearest ancestor that clips or scrolls its content (the visible stage). */
function clipAncestor(el: HTMLElement | null | undefined): HTMLElement | null {
  let n = el?.parentElement ?? null
  while (n && n !== document.body) {
    const o = getComputedStyle(n)
    if (/(auto|scroll|hidden|clip)/.test(o.overflowX + o.overflowY)) return n
    n = n.parentElement
  }
  return null
}

/**
 * While pages fly outside the stage, stop it from briefly gaining scrollbars.
 * Only done when it isn't already scrollable, so nothing visibly shifts.
 */
function lockOverflow(stage: HTMLElement): () => void {
  if (stage.scrollWidth > stage.clientWidth + 1 || stage.scrollHeight > stage.clientHeight + 1) return () => {}
  const prev = stage.style.overflow
  stage.style.overflow = 'hidden'
  return () => {
    stage.style.overflow = prev
  }
}

function raise(el: HTMLElement): () => void {
  const prev = el.style.zIndex
  el.style.zIndex = '6'
  return () => {
    el.style.zIndex = prev
  }
}
