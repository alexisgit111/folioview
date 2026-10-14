import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { useDocument } from '../state/DocumentContext'
import { useFilePicker } from '../components/FilePicker'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { PdfPage } from '../components/viewer/PdfPage'
import { DEMO_DOCUMENTS, type DemoDocument } from '../lib/demos'
import { loadPdf } from '../lib/pdf/pdfjs'
import { config } from '../lib/config'

export function DashboardPage() {
  const { doc, openDemo, load } = useDocument()
  const openPicker = useFilePicker()
  const busy = load.status === 'loading'

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Wordmark />
        <p className="inline-flex items-center gap-2 rounded-full border border-sage/60 bg-sage/15 px-3 py-1.5 text-xs font-medium text-ink/80" data-testid="local-status">
          <Icon name="shield" size={15} className="text-[#5F6B58]" />
          <span>Local-only<span className="hidden sm:inline"> · files never leave this device</span></span>
        </p>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
        <section className="grid gap-10 pb-14 pt-8 md:grid-cols-[1.05fr_1fr] md:items-center md:gap-14 md:pt-14">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8C7347]">Brochures · Portfolios · Presentations</p>
            <h1 className="mt-4 font-display text-[clamp(2.4rem,5.5vw,4.1rem)] font-[380] leading-[1.02] tracking-[-0.02em]">
              Turn any PDF into a<br className="hidden sm:block" /> <em className="font-[340] text-[#7A6440]">page-turning</em> folio.
            </h1>
            <p className="mt-5 max-w-md text-[16px] leading-relaxed text-ink/65">
              Flip through brochures like print, read page by page with zoom, or present fullscreen in a meeting — straight from your browser.
            </p>
          </div>

          <DropZone onPick={openPicker} disabled={busy} />
        </section>

        {doc && (
          <section className="mb-12 flex flex-col gap-4 rounded-2xl border border-stone bg-white/70 p-5 sm:flex-row sm:items-center sm:justify-between" aria-label="Currently open">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink/50">Open in this tab</p>
              <p className="mt-1 truncate font-display text-xl">{doc.title}</p>
              <p className="text-sm text-ink/55">{doc.pageCount} pages · not saved — closing the tab clears it</p>
            </div>
            <Link to="/viewer" className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-canvas hover:bg-ink/90">
              Continue viewing <Icon name="arrow-right" size={18} />
            </Link>
          </section>
        )}

        <section aria-labelledby="demo-heading">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-stone pb-4">
            <div>
              <h2 id="demo-heading" className="font-display text-2xl">Demo library</h2>
              <p className="mt-1 text-sm text-ink/60">Fictional sample documents bundled with the app — try every mode without your own files.</p>
            </div>
          </div>
          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {DEMO_DOCUMENTS.map((demo) => (
              <li key={demo.id}>
                <DemoCard demo={demo} onOpen={() => void openDemo(demo)} disabled={busy} />
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-16 grid gap-6 border-t border-stone pt-8 text-sm text-ink/60 sm:grid-cols-3">
          <Note title="Private by design">PDFs are read in this browser tab with PDF.js. Nothing is uploaded, stored or tracked.</Note>
          <Note title="Not saved yet">Closing or reloading the tab clears the open document. A saved library arrives in a later milestone.</Note>
          <Note title="Keyboard friendly">← → or Page Up/Down to turn pages, F for fullscreen in Present, Esc to exit.</Note>
        </section>
      </main>
    </div>
  )
}

function Wordmark() {
  return (
    <Link to="/" className="inline-flex items-center gap-2.5" aria-label="FolioView home">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <rect x="3" y="5" width="10.5" height="18" rx="1.5" fill="#151A22" />
        <path d="M14.5 5h9a1.5 1.5 0 011.5 1.5v15a1.5 1.5 0 01-1.5 1.5h-9z" fill="#C7A878" />
      </svg>
      <span className="font-display text-[22px] tracking-[-0.01em]">FolioView</span>
    </Link>
  )
}

function DropZone({ onPick, disabled }: { onPick: () => void; disabled: boolean }) {
  return (
    <div className="relative rounded-[28px] border border-dashed border-ink/25 bg-white/60 p-8 text-center shadow-[0_1px_0_rgba(21,26,34,0.04)] sm:p-12">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-ink text-canvas">
        <Icon name="upload" size={24} />
      </div>
      <p className="mt-5 font-display text-2xl">Drop a PDF anywhere</p>
      <p className="mt-1.5 text-sm text-ink/60">or choose one from your device</p>
      <Button variant="primary" size="lg" className="mt-6" onClick={onPick} disabled={disabled} data-testid="choose-pdf">
        Choose PDF
      </Button>
      <p className="mt-5 text-xs text-ink/50">Up to {config.maxUploadMb} MB · password-protected PDFs supported</p>
    </div>
  )
}

function DemoCard({ demo, onOpen, disabled }: { demo: DemoDocument; onOpen: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled}
      className="group block w-full rounded-2xl text-left disabled:opacity-60"
      aria-label={`Open demo: ${demo.title}`}
      data-testid={`demo-${demo.id}`}
    >
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl bg-[#ECEBE5] ring-1 ring-stone transition group-hover:ring-ink/25">
        <DemoThumb url={demo.url} />
      </div>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{demo.title}</p>
          <p className="text-sm text-ink/55">{demo.subtitle}</p>
        </div>
        <span className="mt-0.5 shrink-0 rounded-full bg-stone/60 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-ink/70">
          {demo.kind}
        </span>
      </div>
    </button>
  )
}

/** Renders page 1 of a bundled demo as its cover image. */
function DemoThumb({ url }: { url: string }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    let loaded: PDFDocumentProxy | null = null
    loadPdf(url)
      .then(async (d) => {
        loaded = d
        const p = await d.getPage(1)
        const vp = p.getViewport({ scale: 1 })
        if (!alive) return
        setSize({ width: vp.width, height: vp.height })
        setPdf(d)
      })
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
      // Give the thumbnail's own cleanup a tick to cancel rendering first.
      setTimeout(() => void loaded?.loadingTask.destroy(), 0)
    }
  }, [url])

  if (failed) return <span className="text-sm text-ink/50">Preview unavailable</span>
  if (!pdf || !size) return <div className="pdf-page-placeholder h-[70%] w-[50%] rounded-sm" aria-hidden="true" />
  const box = { width: 260, height: 170 }
  const s = Math.min(box.width / size.width, box.height / size.height)
  return (
    <PdfPage
      pdf={pdf}
      pageIndex={0}
      width={Math.round(size.width * s)}
      height={Math.round(size.height * s)}
      label=""
      lazy
      className="shadow-page transition-transform duration-300 group-hover:-translate-y-0.5"
    />
  )
}

function Note({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-medium text-ink">{title}</p>
      <p className="mt-1 leading-relaxed">{children}</p>
    </div>
  )
}
