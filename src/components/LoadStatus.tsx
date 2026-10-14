import { useState, type FormEvent } from 'react'
import { useDocument } from '../state/DocumentContext'
import { Button } from './ui/Button'
import { Dialog } from './ui/Dialog'
import { Icon } from './ui/Icon'

const errorTitles: Record<string, string> = {
  'not-pdf': 'That isn’t a PDF',
  'too-large': 'File is too large',
  empty: 'File is empty',
  invalid: 'This PDF can’t be opened',
  network: 'File couldn’t be read',
  unknown: 'Something went wrong',
}

/** Global loading toast, password prompt and error dialog for opening documents. */
export function LoadStatus({ onChooseAnother }: { onChooseAnother?: () => void }) {
  const { load, cancelLoad, dismissError, submitPassword } = useDocument()
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!password) return
    setSubmitting(true)
    await submitPassword(password)
    setSubmitting(false)
    setPassword('')
  }

  return (
    <>
      {load.status === 'loading' && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-auto flex w-full max-w-sm items-center gap-4 rounded-2xl border border-stone bg-canvas/95 px-5 py-4 shadow-dialog backdrop-blur"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">Opening {load.fileName}…</p>
              <div
                className="mt-2 h-1 overflow-hidden rounded-full bg-stone"
                role="progressbar"
                aria-label="Loading progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={load.progress === null ? undefined : Math.round(load.progress * 100)}
              >
                <div
                  className={`h-full rounded-full bg-gold ${load.progress === null ? 'progress-indeterminate w-1/3' : 'transition-[width]'}`}
                  style={load.progress === null ? undefined : { width: `${Math.max(4, load.progress * 100)}%` }}
                />
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={cancelLoad}>Cancel</Button>
          </div>
        </div>
      )}

      <Dialog
        open={load.status === 'password'}
        onClose={cancelLoad}
        title="Password required"
        initialFocusId="pdf-password"
        description={
          load.status === 'password' ? (
            <>
              <span className="font-medium text-ink">{load.fileName}</span> is protected. The password is only used in
              this browser tab to decrypt the file.
            </>
          ) : null
        }
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink/60">
              <Icon name="lock" size={14} /> Password
            </span>
            <input
              id="pdf-password"
              type="password"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={load.status === 'password' && load.retry}
              aria-describedby={load.status === 'password' && load.retry ? 'pdf-password-error' : undefined}
              className="h-11 w-full rounded-lg border border-stone bg-white px-3 text-[15px] outline-none focus:border-ink/40"
            />
          </label>
          {load.status === 'password' && load.retry && (
            <p id="pdf-password-error" role="alert" className="text-sm text-[#9B3B2E]">
              That password is not correct. Try again.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={cancelLoad}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={!password || submitting}>
              {submitting ? 'Opening…' : 'Open PDF'}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={load.status === 'error'}
        onClose={dismissError}
        title={load.status === 'error' ? errorTitles[load.error.kind] ?? errorTitles.unknown : ''}
        description={load.status === 'error' ? <span data-testid="load-error">{load.error.message}</span> : null}
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={dismissError}>Close</Button>
          {onChooseAnother && (
            <Button
              variant="primary"
              icon="upload"
              onClick={() => {
                dismissError()
                onChooseAnother()
              }}
            >
              Choose another file
            </Button>
          )}
        </div>
      </Dialog>
    </>
  )
}
