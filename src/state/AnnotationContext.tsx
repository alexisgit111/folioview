import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useDocument } from './DocumentContext'

/**
 * Freehand annotations.
 *
 * Coordinates are stored in "page units": the page is always 1000 units wide
 * and (1000 × height/width) tall, so strokes stay attached to the same spot
 * at any zoom level, screen size or viewer mode.
 */
export const PAGE_UNITS = 1000

export type AnnotationTool = 'pen' | 'highlighter' | 'eraser'

export interface Stroke {
  id: string
  tool: 'pen' | 'highlighter'
  color: string
  /** Line width in page units. */
  size: number
  /** Flat [x0, y0, x1, y1, …] in page units. */
  points: number[]
}

type PageStrokes = Record<number, Stroke[]>

type HistoryEntry =
  | { type: 'add'; page: number; stroke: Stroke }
  | { type: 'remove'; page: number; strokes: Stroke[] }

export const PEN_COLORS = [
  { name: 'Red', value: '#D23B2E' },
  { name: 'Gold', value: '#C7A878' },
  { name: 'Blue', value: '#2F6FD6' },
  { name: 'Ink', value: '#151A22' },
  { name: 'White', value: '#FFFFFF' },
] as const

export const PEN_SIZES = { pen: [2.5, 5, 9], highlighter: [16, 26, 38] } as const

interface AnnotationContextValue {
  /** Monotonic counter that changes whenever any stroke changes. */
  version: number
  strokesFor: (page: number) => Stroke[]
  addStroke: (page: number, stroke: Stroke) => void
  eraseStrokes: (page: number, ids: string[]) => void
  clearPage: (page: number) => void
  undo: () => void
  canUndo: boolean
  totalStrokes: number
  // drawing state (shared by single-page and presentation)
  active: boolean
  setActive: (on: boolean) => void
  tool: AnnotationTool
  setTool: (t: AnnotationTool) => void
  color: string
  setColor: (c: string) => void
  sizeIndex: number
  setSizeIndex: (i: number) => void
  /** Whether annotations are stored in this browser for the current PDF. */
  persisted: boolean
}

const Ctx = createContext<AnnotationContextValue | null>(null)

const STORAGE_PREFIX = 'fv.annot.'

function storageKey(fingerprint: string | null | undefined) {
  return fingerprint ? STORAGE_PREFIX + fingerprint : null
}

function load(key: string | null): PageStrokes {
  if (!key) return {}
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as PageStrokes
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function AnnotationProvider({ children }: { children: ReactNode }) {
  const { doc } = useDocument()
  const key = storageKey(doc?.pdf.fingerprints?.[0])
  const [pages, setPages] = useState<PageStrokes>(() => load(key))
  const [version, setVersion] = useState(0)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [active, setActive] = useState(false)
  const [tool, setTool] = useState<AnnotationTool>('pen')
  const [color, setColor] = useState<string>(PEN_COLORS[0].value)
  const [sizeIndex, setSizeIndex] = useState(1)
  const [persisted, setPersisted] = useState(true)
  const keyRef = useRef(key)
  const pagesRef = useRef(pages)
  pagesRef.current = pages

  // New document: load its saved annotations and reset history/tools.
  useEffect(() => {
    keyRef.current = key
    const loaded = load(key)
    pagesRef.current = loaded
    setPages(loaded)
    setHistory([])
    setActive(false)
    setVersion((v) => v + 1)
  }, [key, doc?.id])

  const commit = useCallback((next: PageStrokes) => {
    pagesRef.current = next
    setPages(next)
    setVersion((v) => v + 1)
    const k = keyRef.current
    if (!k) return
    try {
      const empty = Object.values(next).every((s) => s.length === 0)
      if (empty) localStorage.removeItem(k)
      else localStorage.setItem(k, JSON.stringify(next))
      setPersisted(true)
    } catch {
      setPersisted(false) // storage full or blocked: keep working in memory
    }
  }, [])

  const addStroke = useCallback((page: number, stroke: Stroke) => {
    const cur = pagesRef.current
    commit({ ...cur, [page]: [...(cur[page] ?? []), stroke] })
    setHistory((h) => [...h.slice(-99), { type: 'add', page, stroke }])
  }, [commit])

  const eraseStrokes = useCallback((page: number, ids: string[]) => {
    const cur = pagesRef.current
    const list = cur[page] ?? []
    const removed = list.filter((s) => ids.includes(s.id))
    if (!removed.length) return
    commit({ ...cur, [page]: list.filter((s) => !ids.includes(s.id)) })
    setHistory((h) => [...h.slice(-99), { type: 'remove', page, strokes: removed }])
  }, [commit])

  const clearPage = useCallback((page: number) => {
    const cur = pagesRef.current
    const list = cur[page] ?? []
    if (!list.length) return
    commit({ ...cur, [page]: [] })
    setHistory((h) => [...h.slice(-99), { type: 'remove', page, strokes: list }])
  }, [commit])

  const historyRef = useRef(history)
  historyRef.current = history

  const undo = useCallback(() => {
    const h = historyRef.current
    const last = h[h.length - 1]
    if (!last) return
    const cur = pagesRef.current
    const list = cur[last.page] ?? []
    if (last.type === 'add') {
      commit({ ...cur, [last.page]: list.filter((s) => s.id !== last.stroke.id) })
    } else {
      commit({ ...cur, [last.page]: [...list, ...last.strokes] })
    }
    historyRef.current = h.slice(0, -1)
    setHistory(historyRef.current)
  }, [commit])

  const strokesFor = useCallback((page: number) => pages[page] ?? [], [pages])
  const totalStrokes = useMemo(() => Object.values(pages).reduce((n, s) => n + s.length, 0), [pages])

  const value = useMemo<AnnotationContextValue>(() => ({
    version, strokesFor, addStroke, eraseStrokes, clearPage, undo, canUndo: history.length > 0, totalStrokes,
    active, setActive, tool, setTool, color, setColor, sizeIndex, setSizeIndex, persisted,
  }), [version, strokesFor, addStroke, eraseStrokes, clearPage, undo, history.length, totalStrokes, active, tool, color, sizeIndex, persisted])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAnnotations(): AnnotationContextValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAnnotations must be used inside <AnnotationProvider>')
  return v
}

let strokeCounter = 0
export function newStrokeId() {
  return `s${Date.now().toString(36)}${(strokeCounter++).toString(36)}`
}

/** Draws strokes onto a 2D context whose coordinate space is `scale` px per page unit. */
export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[], scale: number) {
  for (const s of strokes) drawStroke(ctx, s, scale)
}

export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, scale: number) {
  const p = s.points
  if (p.length < 2) return
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = s.color
  ctx.lineWidth = s.size * scale
  if (s.tool === 'highlighter') {
    ctx.globalAlpha = 0.35
    ctx.globalCompositeOperation = 'multiply'
    ctx.lineCap = 'butt'
  }
  ctx.beginPath()
  ctx.moveTo(p[0] * scale, p[1] * scale)
  if (p.length === 2) {
    // a dot
    ctx.lineTo(p[0] * scale + 0.01, p[1] * scale)
  } else {
    // smooth with quadratic curves through midpoints
    for (let i = 2; i < p.length - 2; i += 2) {
      const mx = ((p[i] + p[i + 2]) / 2) * scale
      const my = ((p[i + 1] + p[i + 3]) / 2) * scale
      ctx.quadraticCurveTo(p[i] * scale, p[i + 1] * scale, mx, my)
    }
    ctx.lineTo(p[p.length - 2] * scale, p[p.length - 1] * scale)
  }
  ctx.stroke()
  ctx.restore()
}

/** Ids of strokes passing within `radius` page units of (x, y). */
export function hitStrokes(strokes: Stroke[], x: number, y: number, radius: number): string[] {
  const hits: string[] = []
  for (const s of strokes) {
    const r = radius + s.size / 2
    const r2 = r * r
    const p = s.points
    for (let i = 0; i < p.length; i += 2) {
      // distance to segment (p[i], p[i+2])
      const ax = p[i], ay = p[i + 1]
      const bx = p[i + 2] ?? ax, by = p[i + 3] ?? ay
      const dx = bx - ax, dy = by - ay
      const len2 = dx * dx + dy * dy
      const t = len2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2)) : 0
      const cx = ax + t * dx - x, cy = ay + t * dy - y
      if (cx * cx + cy * cy <= r2) {
        hits.push(s.id)
        break
      }
    }
  }
  return hits
}
