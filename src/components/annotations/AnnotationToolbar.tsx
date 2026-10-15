import { PEN_COLORS, PEN_SIZES, useAnnotations, type AnnotationTool } from '../../state/AnnotationContext'
import { Icon } from '../ui/Icon'

interface Props {
  page: number
  /** Visual theme: light viewer chrome or dark presentation chrome. */
  tone?: 'light' | 'dark'
}

const TOOLS: Array<{ id: AnnotationTool; label: string; icon: 'pen' | 'highlighter' | 'eraser' }> = [
  { id: 'pen', label: 'Pen', icon: 'pen' },
  { id: 'highlighter', label: 'Highlighter', icon: 'highlighter' },
  { id: 'eraser', label: 'Eraser', icon: 'eraser' },
]

/** Floating palette shown while drawing is switched on. */
export function AnnotationToolbar({ page, tone = 'light' }: Props) {
  const { active, setActive, tool, setTool, color, setColor, sizeIndex, setSizeIndex, undo, canUndo, clearPage, strokesFor, persisted } =
    useAnnotations()
  if (!active) return null
  const dark = tone === 'dark'
  const base = dark ? 'bg-[#0a2a5c]/95 text-canvas ring-white/10' : 'bg-canvas/95 text-ink ring-stone'
  const btn = (on: boolean) =>
    `inline-flex h-10 min-w-10 items-center justify-center rounded-full px-2 transition-colors ${
      on ? (dark ? 'bg-white/15 text-canvas' : 'bg-ink text-canvas') : dark ? 'text-canvas/80 hover:bg-white/10' : 'text-ink/75 hover:bg-stone/60'
    }`
  const hasStrokes = strokesFor(page).length > 0
  const sizes = tool === 'eraser' ? [] : PEN_SIZES[tool]

  return (
    <div
      role="toolbar"
      aria-label="Annotation tools"
      data-testid="annotation-toolbar"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      className={`flex max-w-[calc(100vw-24px)] flex-wrap items-center justify-center gap-1 rounded-2xl p-1.5 shadow-dialog ring-1 backdrop-blur ${base}`}
    >
      {TOOLS.map((t) => (
        <button key={t.id} type="button" className={btn(tool === t.id)} aria-pressed={tool === t.id} aria-label={t.label} title={t.label} onClick={() => setTool(t.id)}>
          <Icon name={t.icon} size={18} />
        </button>
      ))}
      <span className={`mx-1 h-6 w-px ${dark ? 'bg-white/15' : 'bg-stone'}`} aria-hidden="true" />
      {PEN_COLORS.map((c) => (
        <button
          key={c.value}
          type="button"
          aria-label={`Colour ${c.name}`}
          aria-pressed={color === c.value}
          title={c.name}
          disabled={tool === 'eraser'}
          onClick={() => setColor(c.value)}
          className={`grid h-10 w-8 place-items-center rounded-full disabled:opacity-30`}
        >
          <span
            className={`block h-5 w-5 rounded-full ring-1 ${dark ? 'ring-white/40' : 'ring-ink/20'} ${color === c.value && tool !== 'eraser' ? 'outline-2 outline-offset-2 outline-accent [outline-style:solid]' : ''}`}
            style={{ background: c.value }}
          />
        </button>
      ))}
      {sizes.length > 0 && (
        <>
          <span className={`mx-1 h-6 w-px ${dark ? 'bg-white/15' : 'bg-stone'}`} aria-hidden="true" />
          {sizes.map((s, i) => (
            <button
              key={s}
              type="button"
              className={btn(sizeIndex === i)}
              aria-pressed={sizeIndex === i}
              aria-label={['Thin', 'Medium', 'Thick'][i]}
              title={['Thin', 'Medium', 'Thick'][i]}
              onClick={() => setSizeIndex(i)}
            >
              <span className="block rounded-full bg-current" style={{ width: 4 + i * 4, height: 4 + i * 4 }} />
            </button>
          ))}
        </>
      )}
      <span className={`mx-1 h-6 w-px ${dark ? 'bg-white/15' : 'bg-stone'}`} aria-hidden="true" />
      <button type="button" className={btn(false)} onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo (Ctrl+Z)">
        <Icon name="undo" size={18} />
      </button>
      <button type="button" className={btn(false)} onClick={() => clearPage(page)} disabled={!hasStrokes} aria-label="Clear this page" title="Clear this page">
        <Icon name="trash" size={18} />
      </button>
      <button
        type="button"
        onClick={() => setActive(false)}
        className={`ml-1 inline-flex h-10 items-center rounded-full px-4 text-sm font-medium ${dark ? 'bg-canvas text-ink' : 'bg-ink text-canvas'}`}
      >
        Done
      </button>
      {!persisted && (
        <span className="w-full px-2 pb-1 text-center text-[11px] opacity-70">Can’t save drawings in this browser — they’ll be lost on reload.</span>
      )}
    </div>
  )
}

/** The button that switches drawing on/off. */
export function PenToggle({ tone = 'light', className = '', iconOnly = false }: { tone?: 'light' | 'dark'; className?: string; iconOnly?: boolean }) {
  const { active, setActive } = useAnnotations()
  const dark = tone === 'dark'
  return (
    <button
      type="button"
      onClick={() => setActive(!active)}
      aria-pressed={active}
      aria-label={active ? 'Stop drawing' : 'Draw on page'}
      title="Draw (P)"
      data-testid="pen-toggle"
      className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded ${iconOnly ? 'w-11 justify-center' : 'px-3'} text-[13px] font-semibold transition-colors ${
        active
          ? 'bg-accent text-ink'
          : dark
            ? 'text-canvas/85 hover:bg-white/10 hover:text-canvas'
            : 'text-ink/75 hover:bg-stone/50 hover:text-ink'
      } ${className}`}
    >
      <Icon name="pen" size={17} />
      {!iconOnly && <span className="hidden lg:inline">Draw</span>}
    </button>
  )
}
