import { describe, expect, it } from 'vitest'
import { clampZoom, containSize, fitScale, nextZoom, outputScaleFor } from '../../src/lib/pdf/geometry'

const A4 = { width: 595, height: 842 }

describe('fit calculations', () => {
  it('fit-width uses the box width only', () => {
    expect(fitScale(A4, { width: 1190, height: 100 }, 'fit-width')).toBeCloseTo(2)
  })
  it('fit-page uses the tighter dimension', () => {
    expect(fitScale(A4, { width: 1190, height: 842 }, 'fit-page')).toBeCloseTo(1)
  })
  it('containSize preserves aspect ratio', () => {
    const s = containSize({ width: 960, height: 540 }, { width: 400, height: 800 })
    expect(s.width).toBe(400)
    expect(s.width / s.height).toBeCloseTo(16 / 9, 1)
  })
  it('handles zero-sized boxes without NaN', () => {
    expect(fitScale(A4, { width: 0, height: 0 }, 'fit-page')).toBe(1)
  })
})

describe('zoom steps', () => {
  it('steps up and down through presets', () => {
    expect(nextZoom(1, 1)).toBe(1.1)
    expect(nextZoom(1, -1)).toBe(0.9)
    expect(nextZoom(0.6, 1)).toBe(0.67)
    expect(nextZoom(4, 1)).toBe(4)
    expect(nextZoom(0.25, -1)).toBe(0.25)
  })
  it('clamps', () => {
    expect(clampZoom(10)).toBe(4)
    expect(clampZoom(0.01)).toBe(0.25)
  })
})

describe('outputScaleFor', () => {
  it('uses the device pixel ratio when within budget', () => {
    expect(outputScaleFor({ width: 800, height: 1100 }, 2, 12_000_000)).toBe(2)
  })
  it('caps the backing store under the pixel budget', () => {
    const css = { width: 3000, height: 4000 }
    const s = outputScaleFor(css, 3, 12_000_000)
    expect(css.width * s * css.height * s).toBeLessThanOrEqual(12_000_000 + 1)
  })
  it('treats missing dpr as 1', () => {
    expect(outputScaleFor({ width: 10, height: 10 }, 0, 1e6)).toBe(1)
  })
})
