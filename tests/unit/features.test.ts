import { describe, expect, it } from 'vitest'
import { checkBrowserSupport } from '../../src/lib/features'

describe('checkBrowserSupport', () => {
  it('reports each missing capability by name', () => {
    const fakeWin = {
      Worker: undefined,
      document,
      Promise: {},
      ReadableStream: function () {},
      structuredClone: () => {},
      URL: { createObjectURL: () => '' },
    } as unknown as Window & typeof globalThis
    const r = checkBrowserSupport(fakeWin)
    expect(r.supported).toBe(false)
    expect(r.missing).toContain('Web Workers')
    expect(r.missing).toContain('Promise.withResolvers')
  })
})
