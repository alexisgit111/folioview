import type { SVGProps } from 'react'

const paths = {
  'arrow-left': 'M15 18l-6-6 6-6',
  'arrow-right': 'M9 18l6-6-6-6',
  back: 'M19 12H5M11 18l-6-6 6-6',
  book: 'M12 6.5C10.4 5.3 8.2 4.6 5.5 4.5 4.7 4.5 4 5.1 4 5.9v11.4c0 .8.7 1.4 1.5 1.4 2.6.1 4.8.8 6.5 2 1.7-1.2 3.9-1.9 6.5-2 .8 0 1.5-.6 1.5-1.4V5.9c0-.8-.7-1.4-1.5-1.4-2.7.1-4.9.8-6.5 2zM12 6.5V20.3',
  page: 'M7 3.5h7l4 4V20a.5.5 0 01-.5.5h-10.5a.5.5 0 01-.5-.5V4a.5.5 0 01.5-.5zM14 3.5V8h4',
  present: 'M3.5 4.5h17v11h-17zM12 15.5V20M8 20h8M10.5 8l4 2-4 2z',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  shrink: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  'fit-width': 'M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4',
  'fit-page': 'M6 3.5h12v17H6zM9 9.5l3-3 3 3M9 14.5l3 3 3-3',
  upload: 'M12 16V4M7 9l5-5 5 5M4.5 15v3.5c0 .8.7 1.5 1.5 1.5h12c.8 0 1.5-.7 1.5-1.5V15',
  lock: 'M6.5 10.5h11v9h-11zM8.5 10.5V8a3.5 3.5 0 017 0v2.5',
  close: 'M6 6l12 12M18 6L6 18',
  alert: 'M12 4l9 16H3zM12 10v4M12 17v.5',
  thumbs: 'M4 4h6v7H4zM14 4h6v7h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  shield: 'M12 3.5l7 2.5v6c0 4.2-3 7.4-7 8.5-4-1.1-7-4.3-7-8.5V6z',
  file: 'M7 3.5h7l4 4V20a.5.5 0 01-.5.5h-10.5a.5.5 0 01-.5-.5V4a.5.5 0 01.5-.5zM14 3.5V8h4M9 13h6M9 16.5h4',
} as const

export type IconName = keyof typeof paths

export function Icon({ name, size = 20, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={paths[name]} />
    </svg>
  )
}
