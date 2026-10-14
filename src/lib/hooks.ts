import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

export interface ElementSize {
  width: number
  height: number
}

/** Content-box size of an element, updated through ResizeObserver. */
export function useElementSize<T extends HTMLElement>(): [RefObject<T | null>, ElementSize] {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      const w = r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      const h = r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
      setSize((prev) =>
        Math.abs(prev.width - w) < 0.5 && Math.abs(prev.height - h) < 0.5 ? prev : { width: Math.max(0, w), height: Math.max(0, h) },
      )
    }
    update()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update)
      return () => window.removeEventListener('resize', update)
    }
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size]
}

export function useMediaQuery(query: string): boolean {
  const get = () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches
  const [matches, setMatches] = useState(get)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}

export const useReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)')
export const useIsNarrow = () => useMediaQuery('(max-width: 767px)')

/** Debounced copy of a value (used for resize/zoom → re-render). */
export function useDebounced<T>(value: T, delay: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}

/**
 * True after `timeout` ms with no pointer, touch or key activity.
 * `poke` lets callers register activity explicitly.
 */
export function useIdle(timeout: number, enabled = true): [boolean, () => void] {
  const [idle, setIdle] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const poke = useCallback(() => {
    setIdle(false)
    clearTimeout(timer.current)
    if (enabled) timer.current = setTimeout(() => setIdle(true), timeout)
  }, [timeout, enabled])
  useEffect(() => {
    poke()
    const events = ['pointermove', 'pointerdown', 'keydown', 'touchstart', 'wheel'] as const
    events.forEach((e) => window.addEventListener(e, poke, { passive: true }))
    return () => {
      clearTimeout(timer.current)
      events.forEach((e) => window.removeEventListener(e, poke))
    }
  }, [poke])
  return [idle, poke]
}

export interface SwipeHandlers {
  onPointerDown: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
  onPointerCancel: () => void
}

/**
 * Horizontal swipe detection on pointer events (touch, pen or mouse).
 * Ignores mostly-vertical gestures so pages can still scroll.
 */
export function useSwipe(
  onSwipe: (direction: 'next' | 'prev') => void,
  { threshold = 50, enabled = true }: { threshold?: number; enabled?: boolean } = {},
): SwipeHandlers {
  const start = useRef<{ x: number; y: number; id: number; t: number } | null>(null)
  return {
    onPointerDown: (e) => {
      if (!enabled || (e.pointerType === 'mouse' && e.button !== 0)) return
      start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, t: performance.now() }
    },
    onPointerUp: (e) => {
      const s = start.current
      start.current = null
      if (!enabled || !s || s.id !== e.pointerId) return
      const dx = e.clientX - s.x
      const dy = e.clientY - s.y
      if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5) return
      if (performance.now() - s.t > 1200) return
      onSwipe(dx < 0 ? 'next' : 'prev')
    },
    onPointerCancel: () => {
      start.current = null
    },
  }
}

/** Ignore key events typed into form fields. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}
