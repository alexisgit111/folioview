// Minimal typings for page-flip (StPageFlip) 2.x, which ships without .d.ts files.
declare module 'page-flip/dist/js/page-flip.module.js' {
  export type FlipCorner = 'top' | 'bottom'
  export type Orientation = 'portrait' | 'landscape'
  export type FlippingState = 'user_fold' | 'fold_corner' | 'flipping' | 'read'

  export interface PageFlipSettings {
    startPage?: number
    size?: 'fixed' | 'stretch'
    width: number
    height: number
    minWidth?: number
    maxWidth?: number
    minHeight?: number
    maxHeight?: number
    drawShadow?: boolean
    flippingTime?: number
    usePortrait?: boolean
    startZIndex?: number
    autoSize?: boolean
    maxShadowOpacity?: number
    showCover?: boolean
    mobileScrollSupport?: boolean
    swipeDistance?: number
    clickEventForward?: boolean
    useMouseEvents?: boolean
    showPageCorners?: boolean
    disableFlipByClick?: boolean
  }

  export interface WidgetEvent<T = unknown> {
    data: T
    object: PageFlip
  }

  export class PageFlip {
    constructor(element: HTMLElement, settings: PageFlipSettings)
    loadFromHTML(items: NodeListOf<HTMLElement> | HTMLElement[]): void
    updateFromHtml(items: NodeListOf<HTMLElement> | HTMLElement[]): void
    destroy(): void
    update(): void
    clear(): void
    getPageCount(): number
    getCurrentPageIndex(): number
    getOrientation(): Orientation
    turnToPage(pageNum: number): void
    turnToNextPage(): void
    turnToPrevPage(): void
    flip(pageNum: number, corner?: FlipCorner): void
    flipNext(corner?: FlipCorner): void
    flipPrev(corner?: FlipCorner): void
    on(event: 'flip', cb: (e: WidgetEvent<number>) => void): PageFlip
    on(event: 'changeOrientation', cb: (e: WidgetEvent<Orientation>) => void): PageFlip
    on(event: 'changeState', cb: (e: WidgetEvent<FlippingState>) => void): PageFlip
    on(event: 'init' | 'update', cb: (e: WidgetEvent<{ page: number; mode: Orientation }>) => void): PageFlip
    off(event: string): void
  }
}
