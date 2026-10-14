/**
 * Book layout with a single front cover: [0] [1 2] [3 4] … and, when the page
 * count is even, a single back cover. Indices are zero-based.
 * This mirrors StPageFlip's `showCover: true` landscape behaviour so the page
 * indicator and "go to page" agree with what the flipbook shows.
 */
export function spreadsWithCover(pageCount: number): number[][] {
  if (pageCount <= 0) return []
  const spreads: number[][] = [[0]]
  for (let i = 1; i < pageCount; i += 2) {
    spreads.push(i + 1 < pageCount ? [i, i + 1] : [i])
  }
  return spreads
}

export function spreadForPage(pageIndex: number, pageCount: number): number[] {
  const spreads = spreadsWithCover(pageCount)
  return spreads.find((s) => s.includes(pageIndex)) ?? [Math.max(0, Math.min(pageIndex, pageCount - 1))]
}

/** "Page 1", "Pages 2–3" — 1-based, for labels and screen readers. */
export function describeSpread(spread: number[], pageCount: number): string {
  if (spread.length === 0) return ''
  if (spread.length === 1) return `Page ${spread[0] + 1} of ${pageCount}`
  return `Pages ${spread[0] + 1}–${spread[spread.length - 1] + 1} of ${pageCount}`
}

/** Pages worth keeping rendered around the current page (inclusive window). */
export function renderWindow(current: number, pageCount: number, radius: number): Set<number> {
  const keep = new Set<number>()
  for (let i = current - radius; i <= current + radius + 1; i++) {
    if (i >= 0 && i < pageCount) keep.add(i)
  }
  return keep
}
