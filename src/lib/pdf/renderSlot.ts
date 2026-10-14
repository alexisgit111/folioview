import { config } from '../config'
import { outputScaleFor, type Size } from './geometry'

/** The subset of PDFPageProxy that rendering needs (keeps this unit-testable). */
export interface RenderablePage<V extends { width: number; height: number } = { width: number; height: number }> {
  getViewport(params: { scale: number }): V
  render(params: { canvas: HTMLCanvasElement; viewport: V }): {
    promise: Promise<unknown>
    cancel(): void
  }
}

export type RenderResult = 'rendered' | 'cancelled'

export interface RenderOptions {
  dpr?: number
  maxPixels?: number
}

/**
 * Owns one visible canvas inside `host`. Each render draws into a fresh,
 * off-DOM canvas and swaps it in only when PDF.js finishes, so the old page
 * stays visible meanwhile (no white flash), and any in-flight render is
 * cancelled the moment a newer one is requested.
 */
export class RenderSlot {
  private host: HTMLElement
  private current: HTMLCanvasElement | null = null
  private pending: { cancel(): void } | null = null
  private pendingCanvas: HTMLCanvasElement | null = null
  private generation = 0
  private disposed = false

  constructor(host: HTMLElement) {
    this.host = host
  }

  /** Device pixels currently held by this slot's visible canvas. */
  get pixels(): number {
    return this.current ? this.current.width * this.current.height : 0
  }

  get hasContent(): boolean {
    return this.current !== null
  }

  async render<V extends Size>(page: RenderablePage<V>, css: Size, options: RenderOptions = {}): Promise<RenderResult> {
    if (this.disposed) return 'cancelled'
    this.cancelPending()
    const generation = ++this.generation

    const base = page.getViewport({ scale: 1 })
    const cssScale = css.width / base.width
    const cssHeight = base.height * cssScale
    const out = outputScaleFor(
      { width: css.width, height: cssHeight },
      options.dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio : 1),
      options.maxPixels ?? config.maxCanvasPixels,
    )
    const viewport = page.getViewport({ scale: cssScale * out })

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.floor(viewport.width))
    canvas.height = Math.max(1, Math.floor(viewport.height))
    // The host element owns the CSS size; the canvas fills it. While a newer,
    // sharper render is in flight the old bitmap simply scales with the host.
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'
    canvas.setAttribute('aria-hidden', 'true')
    canvas.dataset.pdfCanvas = ''

    const task = page.render({ canvas, viewport })
    this.pending = task
    this.pendingCanvas = canvas
    try {
      await task.promise
    } catch (err) {
      releaseCanvas(canvas)
      if (isCancellation(err) || generation !== this.generation) return 'cancelled'
      throw err
    } finally {
      if (generation === this.generation) {
        this.pending = null
        this.pendingCanvas = null
      }
    }

    if (generation !== this.generation || this.disposed) {
      releaseCanvas(canvas)
      return 'cancelled'
    }
    const previous = this.current
    this.current = canvas
    this.host.replaceChildren(canvas)
    if (previous) releaseCanvas(previous)
    return 'rendered'
  }

  /** Cancel work and free the canvas memory, keeping the slot reusable. */
  release(): void {
    this.cancelPending()
    this.generation++
    if (this.current) {
      releaseCanvas(this.current)
      this.current = null
    }
    this.host.replaceChildren()
  }

  dispose(): void {
    this.release()
    this.disposed = true
  }

  private cancelPending() {
    if (this.pending) {
      this.pending.cancel()
      this.pending = null
    }
    if (this.pendingCanvas) {
      releaseCanvas(this.pendingCanvas)
      this.pendingCanvas = null
    }
  }
}

/** Shrinking a canvas to zero is the reliable way to return its memory. */
export function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0
  canvas.height = 0
}

export function isCancellation(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name
  return name === 'RenderingCancelledException' || name === 'AbortException'
}
