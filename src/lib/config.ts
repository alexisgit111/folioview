/**
 * Runtime limits. Values can be overridden at build time with VITE_* variables
 * (see .env.example). Nothing here is secret — it is compiled into the bundle.
 */
function numberFromEnv(value: string | undefined, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export const config = {
  /** Largest PDF accepted by the local uploader, in megabytes. */
  maxUploadMb: numberFromEnv(import.meta.env.VITE_MAX_UPLOAD_MB, 100),
  /**
   * Upper bound on the device pixels of any single rendered canvas.
   * iOS Safari refuses canvases above ~16.7M px, so we stay well below.
   */
  maxCanvasPixels: numberFromEnv(import.meta.env.VITE_MAX_CANVAS_PIXELS, 12_000_000),
  /** Flipbook keeps rendered pages within this many pages of the current one. */
  flipbookRenderWindow: numberFromEnv(import.meta.env.VITE_FLIPBOOK_RENDER_WINDOW, 4),
} as const

export const MB = 1024 * 1024
