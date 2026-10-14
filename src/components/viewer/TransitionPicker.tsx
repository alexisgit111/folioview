import { useRef } from 'react'
import { TRANSITION_LABELS, TRANSITION_STYLES, type TransitionStyle } from '../../lib/pageTransition'
import { Icon } from '../ui/Icon'

interface Props {
  value: TransitionStyle
  onChange: (style: TransitionStyle) => void
  tone?: 'light' | 'dark'
  /** Hide the text label on narrow screens (icon only). */
  compact?: boolean
}

/**
 * Page-transition chooser. A native <select> sits invisibly over a styled
 * button so it opens the platform menu (great on phones) while matching the UI.
 */
export function TransitionPicker({ value, onChange, tone = 'light', compact = false }: Props) {
  const dark = tone === 'dark'
  // Picked with a mouse or finger: hand the arrow keys back to page navigation.
  const byPointer = useRef(false)
  return (
    <span
      className={`relative inline-flex h-11 items-center gap-1.5 rounded px-2 text-[13px] font-semibold transition-colors sm:px-3 [&:has(select:focus-visible)]:outline-2 [&:has(select:focus-visible)]:outline-offset-2 [&:has(select:focus-visible)]:outline-accent [&:has(select:focus-visible)]:[outline-style:solid] ${
        dark ? 'text-canvas/85 hover:bg-white/10 hover:text-canvas' : 'text-ink/75 hover:bg-stone/50 hover:text-ink'
      }`}
      title="Page transition"
    >
      <Icon name="transition" size={17} />
      <span className={compact ? 'hidden lg:inline' : ''}>{TRANSITION_LABELS[value]}</span>
      <Icon name="chevron-down" size={14} className={compact ? 'hidden lg:inline' : ''} />
      <select
        value={value}
        onPointerDown={() => (byPointer.current = true)}
        onKeyDown={() => (byPointer.current = false)}
        onChange={(e) => {
          onChange(e.target.value as TransitionStyle)
          if (byPointer.current) e.target.blur()
        }}
        aria-label="Page transition"
        data-testid="transition-toggle"
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
      >
        {TRANSITION_STYLES.map((s) => (
          <option key={s} value={s} className="bg-canvas text-ink">
            {TRANSITION_LABELS[s]}
          </option>
        ))}
      </select>
    </span>
  )
}
