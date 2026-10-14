export interface Size {
  width: number
  height: number
}

export type ZoomMode = 'fit-width' | 'fit-page' | 'custom'

export const ZOOM_MIN = 0.25
export const ZOOM_MAX = 4
export const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4]

/** CSS scale (1 = 72dpi PDF points → CSS px) that fits a page to a box. */
export function fitScale(page: Size, box: Size, mode: Exclude<ZoomMode, 'custom'>): number {
  if (page.width <= 0 || page.height <= 0 || box.width <= 0 || box.height <= 0) return 1
  const sx = box.width / page.width
  if (mode === 'fit-width') return sx
  return Math.min(sx, box.height / page.height)
}

/** Largest size with the page's aspect ratio that fits inside `box`. */
export function containSize(page: Size, box: Size): Size {
  const s = fitScale(page, box, 'fit-page')
  return { width: Math.floor(page.width * s), height: Math.floor(page.height * s) }
}

export function nextZoom(current: number, direction: 1 | -1): number {
  if (direction > 0) {
    return ZOOM_STEPS.find((z) => z > current + 0.001) ?? ZOOM_MAX
  }
  return [...ZOOM_STEPS].reverse().find((z) => z < current - 0.001) ?? ZOOM_MIN
}

export function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))
}

/**
 * Device-pixel ratio to render at for a canvas of the given CSS size, reduced
 * when needed so the backing store stays under `maxPixels`.
 */
export function outputScaleFor(css: Size, dpr: number, maxPixels: number): number {
  const ratio = Math.max(1, dpr || 1)
  const area = css.width * css.height
  if (area <= 0) return ratio
  const maxRatio = Math.sqrt(maxPixels / area)
  return Math.max(0.25, Math.min(ratio, maxRatio))
}
