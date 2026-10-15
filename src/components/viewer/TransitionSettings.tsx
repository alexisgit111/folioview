import { useEffect, useId, useRef, useState } from 'react'
import {
  DIRECTION_LABELS,
  DIRECTIONAL,
  SPEED_LABELS,
  TRANSITION_LABELS,
  TRANSITION_STYLES,
  type TransitionDirection,
  type TransitionSettings as Settings,
  type TransitionSpeed,
} from '../../lib/pageTransition'
import { Icon } from '../ui/Icon'

interface Props {
  settings: Settings
  onChange: (change: Partial<Settings>) => void
  tone?: 'light' | 'dark'
  /** Hide the text label on narrow screens (icon only). */
  compact?: boolean
  /** Which way the panel opens from the button. */
  placement?: 'up' | 'down'
  align?: 'left' | 'right'
  /** `closedBy` is the pointerdown that dismissed the panel, if any. */
  onOpenChange?: (open: boolean, closedBy?: Event) => void
}

const DIRECTIONS: Array<{ id: TransitionDirection; arrow: string }> = [
  { id: 'right', arrow: '←' },
  { id: 'left', arrow: '→' },
  { id: 'bottom', arrow: '↑' },
  { id: 'top', arrow: '↓' },
]
const SPEEDS: TransitionSpeed[] = ['slow', 'normal', 'fast']

/** Button + panel for choosing the page animation, its direction and speed. */
export function TransitionSettings({ settings, onChange, tone = 'light', compact = false, placement = 'down', align = 'right', onOpenChange }: Props) {
  const [open, setOpenState] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const dark = tone === 'dark'

  const setOpen = (v: boolean, closedBy?: Event) => {
    setOpenState(v)
    onOpenChange?.(v, closedBy)
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false, e)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopImmediatePropagation()
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const directional = DIRECTIONAL.has(settings.style)
  const chip = (on: boolean) =>
    `inline-flex min-h-9 items-center justify-center rounded px-2 text-[13px] font-semibold transition-colors ${
      on ? 'bg-accent text-ink' : dark ? 'bg-white/5 text-canvas/85 hover:bg-white/15' : 'bg-mist text-ink/80 hover:bg-stone/70'
    }`

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        aria-label={`Transition settings: ${TRANSITION_LABELS[settings.style]}`}
        title="Transition settings"
        data-testid="transition-settings"
        className={`inline-flex h-11 items-center gap-1.5 rounded px-2 text-[13px] font-semibold transition-colors sm:px-3 ${
          open ? (dark ? 'bg-white/15 text-canvas' : 'bg-stone/60 text-ink') : dark ? 'text-canvas/85 hover:bg-white/10 hover:text-canvas' : 'text-ink/75 hover:bg-stone/50 hover:text-ink'
        }`}
      >
        <Icon name="transition" size={17} />
        <span className={compact ? 'hidden lg:inline' : ''}>{TRANSITION_LABELS[settings.style]}</span>
        <Icon name="chevron-down" size={14} className={`${compact ? 'hidden lg:inline' : ''} ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Transition settings"
          data-testid="transition-panel"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          className={`absolute z-30 w-[340px] max-w-[calc(100vw-24px)] rounded-lg p-4 text-left shadow-dialog ring-1 ${
            placement === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'
          } ${align === 'left' ? 'left-0' : 'right-0'} ${dark ? 'bg-[#0a2a5c] text-canvas ring-white/10' : 'bg-canvas text-ink ring-stone'}`}
        >
          <p className={`text-[11px] font-bold uppercase tracking-[0.14em] ${dark ? 'text-canvas/60' : 'text-ink/55'}`}>Animation</p>
          <div role="group" aria-label="Animation" className="mt-2 grid grid-cols-3 gap-1.5">
            {TRANSITION_STYLES.map((s) => (
              <button key={s} type="button" aria-pressed={settings.style === s} className={chip(settings.style === s)} onClick={() => onChange({ style: s })}>
                {TRANSITION_LABELS[s]}
              </button>
            ))}
          </div>

          <p className={`mt-4 text-[11px] font-bold uppercase tracking-[0.14em] ${dark ? 'text-canvas/60' : 'text-ink/55'}`}>Direction</p>
          <div role="radiogroup" aria-label="Direction" className="mt-2 grid grid-cols-4 gap-1.5">
            {DIRECTIONS.map(({ id, arrow }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={settings.direction === id}
                title={DIRECTION_LABELS[id]}
                className={`${chip(settings.direction === id)} flex-col gap-0 py-1 leading-tight ${directional ? '' : 'opacity-50'}`}
                onClick={() => onChange({ direction: id })}
              >
                <span aria-hidden="true" className="text-base">{arrow}</span>
                <span className="text-[11px]">{DIRECTION_LABELS[id]}</span>
              </button>
            ))}
          </div>
          {!directional && (
            <p className={`mt-1.5 text-xs ${dark ? 'text-canvas/55' : 'text-ink/55'}`}>{TRANSITION_LABELS[settings.style]} looks the same in every direction — this applies to the others.</p>
          )}

          <p className={`mt-4 text-[11px] font-bold uppercase tracking-[0.14em] ${dark ? 'text-canvas/60' : 'text-ink/55'}`}>Speed</p>
          <div role="radiogroup" aria-label="Speed" className="mt-2 grid grid-cols-3 gap-1.5">
            {SPEEDS.map((sp) => (
              <button
                key={sp}
                type="button"
                role="radio"
                aria-checked={settings.speed === sp}
                disabled={settings.style === 'none'}
                className={`${chip(settings.speed === sp)} disabled:opacity-35`}
                onClick={() => onChange({ speed: sp })}
              >
                {SPEED_LABELS[sp]}
              </button>
            ))}
          </div>
          <p className={`mt-3 text-xs ${dark ? 'text-canvas/55' : 'text-ink/55'}`}>Going back plays the animation in reverse.</p>
        </div>
      )}
    </div>
  )
}
