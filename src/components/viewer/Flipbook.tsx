import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { PageFlip } from 'page-flip/dist/js/page-flip.module.js'
import 'page-flip/src/Style/stPageFlip.css'
import type { OpenDocument } from '../../state/DocumentContext'
import { config } from '../../lib/config'
import { useDebounced, useElementSize } from '../../lib/hooks'
import { renderPageToObjectUrl } from '../../lib/pdf/renderImage'
import { renderWindow, spreadForPage } from '../../lib/pdf/spreads'
import { PdfPage } from './PdfPage'
import type { NavigationHandle } from './types'

interface FlipbookProps {
  doc: OpenDocument
  page: number
  onPageChange: (page: number) => void
  reducedMotion: boolean
  /** Force single-page (portrait) book, e.g. on phones. */
  portrait: boolean
  /** Reports whether the book currently shows single pages (true) or spreads. */
  onOrientationChange?: (portrait: boolean) => void
}

interface PageEntry {
  el: HTMLDivElement
  img: HTMLImageElement
  url: string | null
  renderedWidth: number
  controller: AbortController | null
}

const MIN_LANDSCAPE_STAGE = 640

/**
 * Book-style viewer. StPageFlip owns the DOM inside `bookEl` (we create it
 * imperatively so React never reconciles nodes the library has moved), and we
 * stream rendered page images into the pages near the reader.
 */
export const Flipbook = forwardRef<NavigationHandle, FlipbookProps>(function Flipbook(
  { doc, page, onPageChange, reducedMotion, portrait: forcePortrait, onOrientationChange },
  ref,
) {
  const [stageRef, stage] = useElementSize<HTMLDivElement>()
  const hostRef = useRef<HTMLDivElement>(null)
  const flipRef = useRef<PageFlip | null>(null)
  const pagesRef = useRef<PageEntry[]>([])
  const currentRef = useRef(page)
  const onPageChangeRef = useRef(onPageChange)
  onPageChangeRef.current = onPageChange
  const [ready, setReady] = useState(false)
  const busyRef = useRef(false)
  const queuedRef = useRef<(() => void) | null>(null)
  const [renderTick, setRenderTick] = useState(0)

  const { width: pw, height: ph } = doc.firstPageSize
  const aspect = pw / ph
  const portrait = forcePortrait || stage.width < MIN_LANDSCAPE_STAGE
  const single = doc.pageCount === 1

  // Fit the book (one or two pages wide) inside the stage.
  const pagesAcross = portrait ? 1 : 2
  const fitW = Math.max(0, Math.min(stage.width / pagesAcross, stage.height * aspect))
  const pageWidth = Math.floor(fitW)
  const pageHeight = Math.floor(fitW / aspect)
  const renderWidth = useDebounced(pageWidth, 150)

  useEffect(() => {
    onOrientationChange?.(portrait)
  }, [portrait, onOrientationChange])

  // ---- create / recreate the PageFlip instance (doc or orientation change)
  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host || single || pageWidth < 40) return
    setReady(false)

    const bookEl = document.createElement('div')
    bookEl.className = 'flipbook-book'
    bookEl.style.width = `${pageWidth * pagesAcross}px`
    host.replaceChildren(bookEl)

    const entries: PageEntry[] = []
    for (let i = 0; i < doc.pageCount; i++) {
      const el = document.createElement('div')
      el.className = 'flipbook-page'
      el.dataset.pageIndex = String(i)
      el.setAttribute('role', 'img')
      el.setAttribute('aria-label', `Page ${i + 1} of ${doc.pageCount}`)
      const img = document.createElement('img')
      img.alt = ''
      img.decoding = 'async'
      img.draggable = false
      img.dataset.pdfImage = ''
      el.appendChild(img)
      bookEl.appendChild(el)
      entries.push({ el, img, url: null, renderedWidth: 0, controller: null })
    }
    pagesRef.current = entries

    const flip = new PageFlip(bookEl, {
      width: Math.round(aspect * 1000),
      height: 1000,
      size: 'stretch',
      // StPageFlip switches to portrait when the block is < 2 × minWidth.
      minWidth: portrait ? pageWidth : 1,
      maxWidth: 10000,
      minHeight: 1,
      maxHeight: 10000,
      autoSize: true,
      usePortrait: true,
      showCover: true,
      startPage: Math.min(currentRef.current, doc.pageCount - 1),
      flippingTime: reducedMotion ? 250 : 800,
      drawShadow: !reducedMotion,
      maxShadowOpacity: 0.35,
      showPageCorners: !reducedMotion,
      mobileScrollSupport: true,
      swipeDistance: 30,
    })
    flip.on('flip', (e) => {
      currentRef.current = e.data
      onPageChangeRef.current(e.data)
    })
    flip.on('init', () => setReady(true))
    // A turn requested mid-animation is ignored by StPageFlip; replay it when
    // the page settles so quick double-taps on "next" are not lost.
    flip.on('changeState', (e) => {
      busyRef.current = e.data !== 'read'
      if (!busyRef.current && queuedRef.current) {
        const run = queuedRef.current
        queuedRef.current = null
        setTimeout(run, 0) // let StPageFlip finish its own bookkeeping first
      }
    })
    flip.loadFromHTML(entries.map((p) => p.el))
    flipRef.current = flip
    setRenderTick((t) => t + 1)

    return () => {
      flipRef.current = null
      for (const p of entries) {
        p.controller?.abort()
        if (p.url) URL.revokeObjectURL(p.url)
        p.img.removeAttribute('src')
      }
      pagesRef.current = []
      try {
        flip.destroy() // also removes bookEl
      } catch {
        host.replaceChildren()
      }
    }
    // pageWidth intentionally excluded: size changes are handled by update()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id, doc.pageCount, aspect, portrait, single, pageWidth >= 40, reducedMotion])

  // ---- live resize without recreating the book
  useEffect(() => {
    const flip = flipRef.current
    const bookEl = hostRef.current?.firstElementChild as HTMLElement | null
    if (!flip || !bookEl || pageWidth < 40) return
    bookEl.style.width = `${pageWidth * pagesAcross}px`
    try {
      flip.update()
    } catch {
      /* not initialised yet */
    }
  }, [pageWidth, pagesAcross])

  // ---- follow external navigation (toolbar, go-to-page, keyboard)
  useEffect(() => {
    currentRef.current = page
    const flip = flipRef.current
    if (!flip || !ready) return
    const shown = flip.getCurrentPageIndex()
    const sameSpread = portrait ? shown === page : spreadForPage(shown, doc.pageCount).includes(page)
    if (sameSpread) return
    const distance = Math.abs(page - shown)
    if (reducedMotion || distance > 6) flip.turnToPage(page)
    else flip.flip(page)
  }, [page, ready, portrait, reducedMotion, doc.pageCount])

  // ---- render images near the current page; free the rest
  useEffect(() => {
    const entries = pagesRef.current
    if (!entries.length || renderWidth < 40) return
    const keep = renderWindow(page, doc.pageCount, config.flipbookRenderWindow)
    entries.forEach((entry, i) => {
      if (!keep.has(i)) {
        entry.controller?.abort()
        entry.controller = null
        if (entry.url) {
          entry.img.removeAttribute('src')
          URL.revokeObjectURL(entry.url)
          entry.url = null
          entry.renderedWidth = 0
          entry.el.dataset.rendered = 'false'
        }
        return
      }
      const sharpEnough = entry.url && entry.renderedWidth >= renderWidth * 0.98 && entry.renderedWidth <= renderWidth * 1.5
      if (sharpEnough || entry.controller) return
      const controller = new AbortController()
      entry.controller = controller
      doc.pdf
        .getPage(i + 1)
        .then((p) => renderPageToObjectUrl(p, renderWidth, controller.signal))
        .then((url) => {
          if (entry.controller === controller) entry.controller = null
          if (!url) return
          if (controller.signal.aborted || pagesRef.current !== entries) {
            URL.revokeObjectURL(url)
            return
          }
          const old = entry.url
          entry.url = url
          entry.renderedWidth = renderWidth
          entry.img.src = url
          entry.el.dataset.rendered = 'true'
          if (old) setTimeout(() => URL.revokeObjectURL(old), 1000)
        })
        .catch((err) => {
          if (entry.controller === controller) entry.controller = null
          if (!controller.signal.aborted) console.error(`FolioView: failed to render page ${i + 1}`, err)
        })
    })
  }, [page, renderWidth, doc, renderTick])

  useImperativeHandle(ref, () => {
    const turn = (dir: 'next' | 'prev') => {
      const flip = flipRef.current
      if (!flip) return
      if (busyRef.current) {
        queuedRef.current = () => turn(dir)
        return
      }
      if (reducedMotion) {
        if (dir === 'next') flip.turnToNextPage()
        else flip.turnToPrevPage()
        // turnTo* does not emit 'flip'; sync explicitly
        onPageChangeRef.current(flip.getCurrentPageIndex())
      } else if (dir === 'next') flip.flipNext()
      else flip.flipPrev()
    }
    return { next: () => turn('next'), prev: () => turn('prev') }
  }, [reducedMotion])

  return (
    <div ref={stageRef} className="flipbook-stage relative h-full w-full" data-orientation={portrait ? 'portrait' : 'landscape'}>
      {single ? (
        <div className="grid h-full place-items-center">
          <PdfPage
            pdf={doc.pdf}
            pageIndex={0}
            width={pageWidth}
            height={pageHeight}
            label={`Page 1 of 1`}
            className="shadow-page"
          />
        </div>
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <div ref={hostRef} className="flipbook-host" data-ready={ready} />
        </div>
      )}
      {!ready && !single && (
        <div role="status" className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-ink/60">
          Preparing pages…
        </div>
      )}
    </div>
  )
})
