import { useEffect, useRef } from 'react'
import {
  PAGE_UNITS,
  PEN_SIZES,
  drawStroke,
  drawStrokes,
  hitStrokes,
  newStrokeId,
  useAnnotations,
  type Stroke,
} from '../../state/AnnotationContext'
import { config } from '../../lib/config'

interface AnnotationLayerProps {
  pageIndex: number
  /** CSS size of the page this layer covers. */
  width: number
  height: number
}

const ERASER_RADIUS = 14 // page units

/**
 * A transparent canvas over a rendered page. Shows the page's strokes and,
 * while the pen is active, captures pointer input (mouse, touch or stylus).
 */
export function AnnotationLayer({ pageIndex, width, height }: AnnotationLayerProps) {
  const { strokesFor, addStroke, eraseStrokes, active, tool, color, sizeIndex, version } = useAnnotations()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef<{ stroke: Stroke; pointerId: number } | null>(null)
  const strokes = strokesFor(pageIndex)

  const unitsPerPx = PAGE_UNITS / Math.max(1, width)

  // Size the backing store for the device pixel ratio and repaint.
  useEffect(() => {
    const c = canvasRef.current
    if (!c || width < 1 || height < 1) return
    const dpr = Math.min(window.devicePixelRatio || 1, Math.sqrt(config.maxCanvasPixels / (width * height)))
    c.width = Math.max(1, Math.round(width * dpr))
    c.height = Math.max(1, Math.round(height * dpr))
    repaint()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, pageIndex, version])

  function repaint() {
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    ctx.clearRect(0, 0, c.width, c.height)
    drawStrokes(ctx, strokesFor(pageIndex), c.width / PAGE_UNITS)
    if (drawing.current) drawStroke(ctx, drawing.current.stroke, c.width / PAGE_UNITS)
  }

  const toUnits = (e: React.PointerEvent | PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const k = PAGE_UNITS / rect.width
    return [round((e.clientX - rect.left) * k), round((e.clientY - rect.top) * k)] as const
  }

  const erase = (e: React.PointerEvent) => {
    const [x, y] = toUnits(e)
    const hits = hitStrokes(strokesFor(pageIndex), x, y, ERASER_RADIUS)
    if (hits.length) eraseStrokes(pageIndex, hits)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!active) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    if (tool === 'eraser') {
      drawing.current = null
      erase(e)
      return
    }
    const [x, y] = toUnits(e)
    const size = PEN_SIZES[tool][sizeIndex] ?? PEN_SIZES[tool][1]
    drawing.current = {
      pointerId: e.pointerId,
      stroke: { id: newStrokeId(), tool, color, size, points: [x, y] },
    }
    repaint()
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!active) return
    if (tool === 'eraser') {
      if (e.buttons & 1 || e.pointerType !== 'mouse') {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) erase(e)
      }
      return
    }
    const d = drawing.current
    if (!d || d.pointerId !== e.pointerId) return
    e.preventDefault()
    const events = typeof e.nativeEvent.getCoalescedEvents === 'function' ? e.nativeEvent.getCoalescedEvents() : [e.nativeEvent]
    const pts = d.stroke.points
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const [x, y] = toUnits(ev)
      const lx = pts[pts.length - 2], ly = pts[pts.length - 1]
      if (Math.abs(x - lx) + Math.abs(y - ly) < 0.6) continue
      pts.push(x, y)
    }
    repaint()
  }

  const finish = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drawing.current
    if (!d || d.pointerId !== e.pointerId) return
    drawing.current = null
    addStroke(pageIndex, d.stroke)
  }

  return (
    <canvas
      ref={canvasRef}
      data-annot-canvas=""
      data-strokes={strokes.length}
      aria-hidden="true"
      className={`annotation-layer absolute inset-0 h-full w-full ${active ? (tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair') : 'pointer-events-none'}`}
      style={{ touchAction: active ? 'none' : 'auto', zIndex: 2 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      onClick={(e) => active && e.stopPropagation()}
      data-units-per-px={unitsPerPx}
    />
  )
}

function round(n: number) {
  return Math.round(n * 10) / 10
}
