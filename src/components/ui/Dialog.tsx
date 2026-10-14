import { useEffect, useRef, type ReactNode } from 'react'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children?: ReactNode
  /** Element id to focus when opened (defaults to the first focusable). */
  initialFocusId?: string
}

/**
 * Modal built on the native <dialog> element: focus trapping, ESC handling,
 * inert background and top-layer stacking come from the browser.
 */
export function Dialog({ open, onClose, title, description, children, initialFocusId }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) {
      el.showModal()
      if (initialFocusId) requestAnimationFrame(() => document.getElementById(initialFocusId)?.focus())
    } else if (!open && el.open) {
      el.close()
    }
  }, [open, initialFocusId])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onCancel = (e: Event) => {
      e.preventDefault()
      onCloseRef.current()
    }
    el.addEventListener('cancel', onCancel)
    return () => el.removeEventListener('cancel', onCancel)
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      className="fv-dialog w-[min(92vw,420px)] rounded-2xl border border-stone bg-canvas p-0 text-ink shadow-dialog"
    >
      {open && (
        <div className="p-6 sm:p-7">
          <h2 id="dialog-title" className="font-display text-2xl leading-tight">{title}</h2>
          {description && <div className="mt-2 text-sm leading-relaxed text-ink/70">{description}</div>}
          {children && <div className="mt-5">{children}</div>}
        </div>
      )}
    </dialog>
  )
}
