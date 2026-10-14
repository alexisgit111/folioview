/**
 * PDF.js 6 needs a modern engine (roughly Chrome/Edge 118+, Firefox 121+,
 * Safari 17.4+). We check the specific features it and FolioView rely on
 * instead of sniffing user agents.
 */
export interface SupportReport {
  supported: boolean
  missing: string[]
}

export function checkBrowserSupport(win: Window & typeof globalThis = window): SupportReport {
  const checks: Array<[string, () => boolean]> = [
    ['Web Workers', () => typeof win.Worker === 'function'],
    ['Canvas 2D', () => {
      const c = win.document.createElement('canvas')
      return typeof c.getContext === 'function' && !!c.getContext('2d')
    }],
    ['Promise.withResolvers', () => typeof (win.Promise as unknown as { withResolvers?: unknown }).withResolvers === 'function'],
    ['ReadableStream', () => typeof win.ReadableStream === 'function'],
    ['structuredClone', () => typeof win.structuredClone === 'function'],
    ['URL.createObjectURL', () => typeof win.URL?.createObjectURL === 'function'],
  ]
  const missing = checks.filter(([, test]) => {
    try {
      return !test()
    } catch {
      return true
    }
  }).map(([name]) => name)
  return { supported: missing.length === 0, missing }
}

export function fullscreenSupported(doc: Document = document): boolean {
  const el = doc.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void }
  return Boolean(doc.fullscreenEnabled ?? (doc as unknown as { webkitFullscreenEnabled?: boolean }).webkitFullscreenEnabled) &&
    (typeof el.requestFullscreen === 'function' || typeof el.webkitRequestFullscreen === 'function')
}

export async function enterFullscreen(el: HTMLElement = document.documentElement): Promise<boolean> {
  if (!fullscreenSupported()) return false
  try {
    const anyEl = el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void }
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' })
    else if (anyEl.webkitRequestFullscreen) await anyEl.webkitRequestFullscreen()
    else return false
    return true
  } catch {
    return false
  }
}

export async function exitFullscreen(): Promise<void> {
  const d = document as Document & { webkitExitFullscreen?: () => Promise<void> | void; webkitFullscreenElement?: Element }
  try {
    if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen()
    else if (d.webkitFullscreenElement && d.webkitExitFullscreen) await d.webkitExitFullscreen()
  } catch {
    /* already exited */
  }
}

export function isFullscreen(): boolean {
  const d = document as Document & { webkitFullscreenElement?: Element }
  return Boolean(document.fullscreenElement ?? d.webkitFullscreenElement)
}

export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
