import { config } from '../config'
import { outputScaleFor } from './geometry'
import { isCancellation, releaseCanvas, type RenderablePage } from './renderSlot'

/**
 * Renders a page to an image object URL.
 *
 * The flipbook needs <img> rather than <canvas>: StPageFlip animates soft
 * pages by cloning their DOM node, and a cloned canvas is blank whereas a
 * cloned <img> keeps its picture. The intermediate canvas is freed at once.
 * Resolves to null if `signal` aborts first.
 */
export async function renderPageToObjectUrl<V extends { width: number; height: number }>(
  page: RenderablePage<V>,
  cssWidth: number,
  signal: AbortSignal,
  options: { dpr?: number; maxPixels?: number; paint?: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void } = {},
): Promise<string | null> {
  const base = page.getViewport({ scale: 1 })
  const cssScale = cssWidth / base.width
  const out = outputScaleFor(
    { width: cssWidth, height: base.height * cssScale },
    options.dpr ?? window.devicePixelRatio ?? 1,
    options.maxPixels ?? config.maxCanvasPixels,
  )
  const viewport = page.getViewport({ scale: cssScale * out })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(viewport.width))
  canvas.height = Math.max(1, Math.floor(viewport.height))

  const task = page.render({ canvas, viewport })
  const onAbort = () => task.cancel()
  signal.addEventListener('abort', onAbort, { once: true })
  try {
    await task.promise
  } catch (err) {
    releaseCanvas(canvas)
    if (isCancellation(err) || signal.aborted) return null
    throw err
  } finally {
    signal.removeEventListener('abort', onAbort)
  }
  if (signal.aborted) {
    releaseCanvas(canvas)
    return null
  }
  if (options.paint) {
    const ctx = canvas.getContext('2d')
    if (ctx) options.paint(ctx, canvas)
  }
  const blob = await canvasToBlob(canvas)
  releaseCanvas(canvas)
  if (signal.aborted || !blob) return null
  return URL.createObjectURL(blob)
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    // WebP keeps brochure photography crisp at a fraction of PNG's size;
    // browsers without WebP encoding fall back to PNG automatically.
    canvas.toBlob((b) => resolve(b), 'image/webp', 0.92)
  })
}
