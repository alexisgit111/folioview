/** Imperative navigation exposed by each viewer mode to the toolbar/keyboard. */
export interface NavigationHandle {
  next(): void
  prev(): void
}

export type ViewerMode = 'flipbook' | 'single'

export function isViewerMode(v: string | null): v is ViewerMode {
  return v === 'flipbook' || v === 'single'
}
