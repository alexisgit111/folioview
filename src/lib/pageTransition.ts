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

/** Where the next page comes in from. Going backwards plays it in reverse. */
export type TransitionDirection = 'right' | 'left' | 'bottom' | 'top'
export type TransitionSpeed = 'slow' | 'normal' | 'fast'

export const DIRECTION_LABELS: Record<TransitionDirection, string> = {
  right: 'From right',
  left: 'From left',
  bottom: 'From bottom',
  top: 'From top',
}
export const SPEED_LABELS: Record<TransitionSpeed, string> = { slow: 'Slow', normal: 'Normal', fast: 'Fast' }
const SPEED_FACTOR: Record<TransitionSpeed, number> = { slow: 1.6, normal: 1, fast: 0.6 }

/** Styles where direction makes a visible difference. */
export const DIRECTIONAL: ReadonlySet<TransitionStyle> = new Set(['turn', 'slide', 'cube', 'flip', 'wipe', 'cover', 'reveal'])

export interface TransitionSettings {
  style: TransitionStyle
  direction: TransitionDirection
  speed: TransitionSpeed
}

const KEYS = { style: 'fv.transition', direction: 'fv.transition.direction', speed: 'fv.transition.speed' } as const
const DEFAULTS: TransitionSettings = { style: 'turn', direction: 'right', speed: 'normal' }

function isStyle(v: unknown): v is TransitionStyle {
  return typeof v === 'string' && v in TRANSITION_LABELS
}
const valid = {
  style: isStyle,
  direction: (v: unknown): v is TransitionDirection => typeof v === 'string' && v in DIRECTION_LABELS,
  speed: (v: unknown): v is TransitionSpeed => typeof v === 'string' && v in SPEED_LABELS,
}

function read<K extends keyof TransitionSettings>(key: K): TransitionSettings[K] {
  try {
    const v = localStorage.getItem(KEYS[key])
    if (valid[key](v)) return v as TransitionSettings[K]
  } catch {
    /* storage unavailable */
  }
  return DEFAULTS[key]
}

/** Remembered per browser; shared by single-page and presentation modes. */
export function useTransitionSettings(): [TransitionSettings, (change: Partial<TransitionSettings>) => void] {
  const [settings, setSettings] = useState<TransitionSettings>(() => ({
    style: read('style'),
    direction: read('direction'),
    speed: read('speed'),
  }))
  const update = useCallback((change: Partial<TransitionSettings>) => {
    setSettings((cur) => {
      const next = { ...cur }
      for (const k of Object.keys(change) as (keyof TransitionSettings)[]) {
        const v = change[k]
        if (!valid[k](v)) continue
        ;(next as Record<string, string>)[k] = v
        try {
          localStorage.setItem(KEYS[k], v)
        } catch {
          /* ignore */
        }
      }
      return next
    })
  }, [])
  return [settings, update]
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
  settings: TransitionSettings,
  reducedMotion: boolean,
): () => void {
  const { style, direction: towards, speed } = settings
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
    const axis = towards === 'top' || towards === 'bottom' ? 'y' : 'x'
    const sign = towards === 'left' || towards === 'top' ? -1 : 1
    const anims = runTransition(style, overlay, incoming, (direction * sign) as 1 | -1, stage, axis, SPEED_FACTOR[speed])
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
  }, [containerRef, style, towards, speed])

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
 * `dir` +1 means the new page arrives from the right (axis x) or bottom (axis y).
 */
function runTransition(
  style: TransitionStyle,
  old: HTMLCanvasElement,
  incoming: HTMLElement | null,
  dir: 1 | -1,
  stage: HTMLElement | null,
  axis: 'x' | 'y',
  speed: number,
): Animation[] {
  const out: Animation[] = []
  const anim = (el: Element | null, frames: Keyframe[], opts: KeyframeAnimationOptions) => {
    if (!el) return
    const o = { ...opts }
    if (typeof o.duration === 'number') o.duration *= speed
    if (o.delay) o.delay *= speed
    out.push(el.animate(frames, o))
  }
  const v = axis === 'y'
  const size = v ? old.offsetHeight : old.offsetWidth
  const persp = `perspective(${Math.round(Math.max(2200, size * 2.6))}px)`
  // Far enough to leave the visible stage entirely.
  const stageSize = v ? (stage?.clientHeight ?? window.innerHeight) : (stage?.clientWidth ?? window.innerWidth)
  const travel = Math.round(Math.max(stageSize, size) + 24)
  // Axis-aware building blocks. Rotations are mirrored for the vertical axis so
  // "towards the viewer" stays towards the viewer.
  const move = (n: number, unit = 'px') => (v ? `translateY(${n}${unit})` : `translateX(${n}${unit})`)
  const rot = (deg: number) => (v ? `rotateX(${-deg}deg)` : `rotateY(${deg}deg)`)
  const edge = (side: 1 | -1) => (v ? (side > 0 ? 'center bottom' : 'center top') : side > 0 ? 'right center' : 'left center')

  switch (style) {
    case 'fade':
      anim(old, [{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: 'ease-out' })
      break

    case 'slide': {
      const ms = 520
      anim(old, [{ transform: move(0) }, { transform: move(-dir * travel) }], { duration: ms, easing: EASE_INOUT })
      anim(incoming, [{ transform: move(dir * travel) }, { transform: move(0) }], { duration: ms, easing: EASE_INOUT })
      break
    }

    case 'zoom': {
      // Forward: the old page grows past you and fades; the new one rises up
      // from behind. Backward is the reverse.
      const ms = 480
      const fwd = dir > 0
      anim(old, [{ transform: 'scale(1)', opacity: 1 }, { transform: `scale(${fwd ? 1.18 : 0.82})`, opacity: 0 }], { duration: ms, easing: EASE_OUT })
      anim(incoming, [{ transform: `scale(${fwd ? 0.82 : 1.18})`, opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: ms, easing: EASE_OUT })
      break
    }

    case 'cube': {
      // Two faces of a cube sharing an edge, rotating a quarter turn.
      const ms = 720
      old.style.transformOrigin = edge(dir)
      if (incoming) incoming.style.transformOrigin = edge((-dir) as 1 | -1)
      anim(
        old,
        [
          { transform: `${persp} ${move(0)} ${rot(0)}`, filter: 'brightness(1)' },
          { transform: `${persp} ${move(-dir * 100, '%')} ${rot(-dir * 90)}`, filter: 'brightness(0.45)' },
        ],
        { duration: ms, easing: EASE_INOUT },
      )
      anim(
        incoming,
        [
          { transform: `${persp} ${move(dir * 100, '%')} ${rot(dir * 90)}`, filter: 'brightness(0.45)' },
          { transform: `${persp} ${move(0)} ${rot(0)}`, filter: 'brightness(1)' },
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
          { transform: `${persp} ${rot(0)}`, filter: 'brightness(1)' },
          { transform: `${persp} ${rot(-dir * 90)}`, filter: 'brightness(0.6)' },
        ],
        { duration: half, easing: 'cubic-bezier(0.5, 0, 0.9, 0.5)', fill: 'forwards' },
      )
      anim(
        incoming,
        [
          { transform: `${persp} ${rot(dir * 90)}`, filter: 'brightness(0.6)' },
          { transform: `${persp} ${rot(0)}`, filter: 'brightness(1)' },
        ],
        { duration: half, delay: half, easing: 'cubic-bezier(0.1, 0.5, 0.5, 1)', fill: 'backwards' },
      )
      break
    }

    case 'wipe': {
      // A straight edge sweeps across, uncovering the new page from the side it comes from.
      const ms = 560
      const end = v
        ? dir > 0
          ? 'inset(0 0 100% 0)'
          : 'inset(100% 0 0 0)'
        : dir > 0
          ? 'inset(0 100% 0 0)'
          : 'inset(0 0 0 100%)'
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
          { transform: move(dir * travel), boxShadow: '0 0 0 rgba(0,0,0,0)' },
          { transform: move(0), boxShadow: '0 20px 60px rgba(0,20,58,0.35)', offset: 0.85 },
          { transform: move(0), boxShadow: '0 0 0 rgba(0,0,0,0)' },
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
      anim(old, [{ transform: move(0) }, { transform: move(-dir * travel) }], { duration: ms, easing: EASE_INOUT })
      anim(incoming, [{ transform: 'scale(0.94)', filter: 'brightness(0.6)' }, { transform: 'scale(1)', filter: 'brightness(1)' }], {
        duration: ms,
        easing: EASE_OUT,
      })
      break
    }

    case 'drop': {
      // The sheet slides a little sideways, tips, then falls away under
      // "gravity" (accelerating ease-in) and fades as it leaves.
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
      // Page turn: the old sheet hinges on the edge opposite where the new page
      // comes from and swings toward the viewer, darkening as it turns.
      old.style.transformOrigin = edge((-dir) as 1 | -1)
      old.style.boxShadow = '0 0 40px rgba(0,0,0,0.25)'
      const angle = dir > 0 ? -95 : 95
      anim(
        old,
        [
          { transform: `${persp} ${rot(0)}`, filter: 'brightness(1)', opacity: 1 },
          { transform: `${persp} ${rot(angle * 0.55)}`, filter: 'brightness(0.85)', opacity: 1, offset: 0.55 },
          { transform: `${persp} ${rot(angle)}`, filter: 'brightness(0.55)', opacity: 0 },
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
