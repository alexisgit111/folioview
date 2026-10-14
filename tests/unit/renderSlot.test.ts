import { describe, expect, it, vi } from 'vitest'
import { RenderSlot, type RenderablePage } from '../../src/lib/pdf/renderSlot'

/** A fake PDF page whose renders finish only when we say so. */
function fakePage(width = 600, height = 800) {
  const tasks: Array<{ resolve: () => void; reject: (e: unknown) => void; cancel: ReturnType<typeof vi.fn> }> = []
  const page: RenderablePage = {
    getViewport: ({ scale }) => ({ width: width * scale, height: height * scale }),
    render: () => {
      let resolve!: () => void
      let reject!: (e: unknown) => void
      const promise = new Promise<void>((res, rej) => {
        resolve = res
        reject = rej
      })
      const cancel = vi.fn(() => reject(Object.assign(new Error('cancelled'), { name: 'RenderingCancelledException' })))
      tasks.push({ resolve, reject, cancel })
      return { promise, cancel }
    },
  }
  return { page, tasks }
}

describe('RenderSlot', () => {
  it('sizes the canvas for the device pixel ratio and swaps it in when done', async () => {
    const host = document.createElement('div')
    const slot = new RenderSlot(host)
    const { page, tasks } = fakePage()
    const p = slot.render(page, { width: 300, height: 0 }, { dpr: 2, maxPixels: 1e8 })
    expect(host.querySelector('canvas')).toBeNull() // nothing shown until finished
    tasks[0].resolve()
    await expect(p).resolves.toBe('rendered')
    const canvas = host.querySelector('canvas')!
    expect(canvas.width).toBe(600)
    expect(canvas.height).toBe(800)
    expect(slot.pixels).toBe(600 * 800)
  })

  it('cancels a stale render when a newer one starts', async () => {
    const host = document.createElement('div')
    const slot = new RenderSlot(host)
    const { page, tasks } = fakePage()
    const first = slot.render(page, { width: 300, height: 0 }, { dpr: 1 })
    const second = slot.render(page, { width: 400, height: 0 }, { dpr: 1 })
    expect(tasks[0].cancel).toHaveBeenCalledOnce()
    await expect(first).resolves.toBe('cancelled')
    tasks[1].resolve()
    await expect(second).resolves.toBe('rendered')
    expect(host.querySelectorAll('canvas')).toHaveLength(1)
    expect(host.querySelector('canvas')!.width).toBe(400)
  })

  it('keeps the previous canvas visible until the next one is ready, then frees it', async () => {
    const host = document.createElement('div')
    const slot = new RenderSlot(host)
    const { page, tasks } = fakePage()
    const a = slot.render(page, { width: 300, height: 0 }, { dpr: 1 })
    tasks[0].resolve()
    await a
    const old = host.querySelector('canvas')!
    const b = slot.render(page, { width: 500, height: 0 }, { dpr: 1 })
    expect(host.querySelector('canvas')).toBe(old)
    tasks[1].resolve()
    await b
    expect(host.querySelector('canvas')).not.toBe(old)
    expect(old.width).toBe(0) // memory returned
  })

  it('release() cancels work and frees memory', async () => {
    const host = document.createElement('div')
    const slot = new RenderSlot(host)
    const { page, tasks } = fakePage()
    const a = slot.render(page, { width: 300, height: 0 }, { dpr: 1 })
    tasks[0].resolve()
    await a
    const pending = slot.render(page, { width: 300, height: 0 }, { dpr: 1 })
    slot.release()
    expect(tasks[1].cancel).toHaveBeenCalled()
    await expect(pending).resolves.toBe('cancelled')
    expect(host.childElementCount).toBe(0)
    expect(slot.pixels).toBe(0)
  })

  it('respects the canvas pixel budget', async () => {
    const host = document.createElement('div')
    const slot = new RenderSlot(host)
    const { page, tasks } = fakePage(600, 800)
    const p = slot.render(page, { width: 3000, height: 0 }, { dpr: 3, maxPixels: 4_000_000 })
    tasks[0].resolve()
    await p
    expect(slot.pixels).toBeLessThanOrEqual(4_000_000)
  })

  it('surfaces real render errors', async () => {
    const host = document.createElement('div')
    const slot = new RenderSlot(host)
    const { page, tasks } = fakePage()
    const p = slot.render(page, { width: 300, height: 0 }, { dpr: 1 })
    tasks[0].reject(new Error('bad image data'))
    await expect(p).rejects.toThrow('bad image data')
  })
})
