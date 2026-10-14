import { describe, expect, it } from 'vitest'
import { describeSpread, renderWindow, spreadForPage, spreadsWithCover } from '../../src/lib/pdf/spreads'

describe('book spreads with a cover', () => {
  it.each([
    [1, [[0]]],
    [2, [[0], [1]]],
    [3, [[0], [1, 2]]],
    [4, [[0], [1, 2], [3]]],
    [12, [[0], [1, 2], [3, 4], [5, 6], [7, 8], [9, 10], [11]]],
  ])('%i pages', (count, expected) => {
    expect(spreadsWithCover(count)).toEqual(expected)
  })

  it('finds the spread for any page', () => {
    expect(spreadForPage(4, 12)).toEqual([3, 4])
    expect(spreadForPage(11, 12)).toEqual([11])
    expect(spreadForPage(0, 0)).toEqual([0])
  })

  it('describes spreads for screen readers', () => {
    expect(describeSpread([0], 12)).toBe('Page 1 of 12')
    expect(describeSpread([1, 2], 12)).toBe('Pages 2–3 of 12')
  })

  it('keeps the render window bounded and inside the document', () => {
    expect([...renderWindow(0, 120, 4)]).toEqual([0, 1, 2, 3, 4, 5])
    const mid = renderWindow(60, 120, 4)
    expect(mid.size).toBe(10)
    expect(Math.min(...mid)).toBe(56)
    expect([...renderWindow(119, 120, 4)].every((i) => i < 120)).toBe(true)
  })
})
