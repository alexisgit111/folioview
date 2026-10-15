import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useDocument } from '../state/DocumentContext'
import { useFilePicker } from '../components/FilePicker'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { DEMO_DOCUMENTS } from '../lib/demos'
import { config } from '../lib/config'

export function DashboardPage() {
  const { doc, openDemo, load } = useDocument()
  const openPicker = useFilePicker()
  const busy = load.status === 'loading'

  // The bundled samples are no longer listed, but `/?demo=<id>` still opens one.
  const [params, setParams] = useSearchParams()
  const demoId = params.get('demo')
  useEffect(() => {
    const demo = DEMO_DOCUMENTS.find((d) => d.id === demoId)
    if (!demo) return
    setParams({}, { replace: true })
    void openDemo(demo)
  }, [demoId, openDemo, setParams])

  return (
    <div className="flex min-h-dvh flex-col bg-ink text-ink">
      <div className="flex min-h-dvh flex-1 flex-col bg-ink text-canvas">
        <header className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-10 lg:px-16">
          <Wordmark />
          <p className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-canvas/85 sm:px-4 sm:py-2 sm:text-sm" data-testid="local-status">
            <Icon name="shield" size={15} className="text-accent" />
            <span>Local-only<span className="hidden sm:inline"> · files never leave this device</span></span>
          </p>
        </header>

        <section className="mx-auto grid w-full max-w-[1600px] flex-1 content-center gap-10 px-5 py-10 sm:px-10 md:grid-cols-[1.15fr_1fr] md:items-center md:gap-16 lg:px-16 lg:py-16 xl:gap-24">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent sm:text-sm sm:tracking-[0.22em] xl:text-base">Harcourts Golden Links · Internal Platform</p>
            <h1 className="mt-5 font-display text-[clamp(2.6rem,5.4vw,6.25rem)] leading-[1.02] tracking-[-0.02em]">
              <span className="sm:whitespace-nowrap">Bring every PDF</span> <br className="hidden sm:block" />
              <span className="whitespace-nowrap text-accent">to life.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-canvas/75 sm:text-xl xl:text-2xl xl:leading-relaxed">
              Turn property brochures, portfolios, and presentations into interactive, page-turning experiences. Designed exclusively for the
              Harcourts Golden Links team.
            </p>
          </div>

          <DropZone onPick={openPicker} disabled={busy} />
        </section>
      </div>

      {doc && (
      <main className="bg-canvas">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        {(
          <section className="flex flex-col gap-4 rounded-md border border-stone border-l-4 border-l-accent bg-mist p-5 sm:flex-row sm:items-center sm:justify-between" aria-label="Currently open">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink/50">Open in this tab</p>
              <p className="mt-1 truncate font-display text-xl">{doc.title}</p>
              <p className="text-sm text-ink/55">{doc.pageCount} pages · not saved — closing the tab clears it</p>
            </div>
            <Link to="/viewer" className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded bg-ink px-5 text-sm font-semibold text-canvas hover:bg-accent hover:text-ink">
              Continue viewing <Icon name="arrow-right" size={18} />
            </Link>
          </section>
        )}
        </div>
      </main>
      )}
    </div>
  )
}

function Wordmark() {
  return (
    <Link to="/" className="inline-flex items-center" aria-label="FolioView home">
      <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="Harcourts Golden Links" className="h-7 w-auto sm:h-10 2xl:h-12" />
    </Link>
  )
}

function DropZone({ onPick, disabled }: { onPick: () => void; disabled: boolean }) {
  return (
    <div className="relative rounded-lg bg-canvas p-8 text-center text-ink shadow-dialog ring-1 ring-white/10 sm:p-14 xl:p-20">
      <div className="pointer-events-none absolute inset-3 rounded-md border-2 border-dashed border-stone" aria-hidden="true" />
      <div className="relative mx-auto grid h-14 w-14 place-items-center rounded-md bg-accent text-ink xl:h-20 xl:w-20">
        <Icon name="upload" size={24} />
      </div>
      <p className="relative mt-6 font-display text-2xl sm:text-3xl xl:text-4xl">Drop a PDF anywhere</p>
      <p className="mt-2 text-base text-ink/60 xl:text-lg">or choose one from your device</p>
      <Button variant="primary" size="xl" className="mt-8" onClick={onPick} disabled={disabled} data-testid="choose-pdf">
        Choose PDF
      </Button>
      <p className="mt-6 text-xs text-ink/50 sm:text-sm">Up to {config.maxUploadMb} MB · password-protected PDFs supported</p>
    </div>
  )
}
