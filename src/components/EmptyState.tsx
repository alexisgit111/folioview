import type { ReactNode } from 'react'
import { Icon, type IconName } from './ui/Icon'

export function EmptyState({
  title,
  body,
  actions,
  icon = 'file',
  tone = 'light',
}: {
  title: string
  body: ReactNode
  actions?: ReactNode
  icon?: IconName
  tone?: 'light' | 'warning'
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-6 py-16 text-ink">
      <div className="max-w-md text-center">
        <div className={`mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl ${tone === 'warning' ? 'bg-accent/15 text-ink' : 'bg-stone/60 text-ink/70'}`}>
          <Icon name={icon} size={26} />
        </div>
        <h1 className="font-display text-3xl leading-tight">{title}</h1>
        <div className="mt-3 text-[15px] leading-relaxed text-ink/65">{body}</div>
        {actions && <div className="mt-8 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
      </div>
    </main>
  )
}
