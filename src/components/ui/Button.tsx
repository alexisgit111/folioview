import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'dark'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-canvas hover:bg-accent hover:text-ink active:bg-accent',
  accent: 'bg-accent text-ink hover:bg-canvas hover:text-ink active:bg-canvas',
  secondary: 'border border-stone bg-white text-ink hover:border-accent hover:text-ink',
  ghost: 'text-ink/80 hover:bg-stone/50 hover:text-ink',
  dark: 'text-canvas/85 hover:bg-white/10 hover:text-canvas',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-[13px] gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-[15px] gap-2.5',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: IconName
  iconRight?: IconName
  children?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, iconRight, className = '', children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex select-none items-center justify-center whitespace-nowrap rounded font-semibold transition-colors disabled:pointer-events-none disabled:opacity-40 ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 16 : 18} />}
    </button>
  )
})

/** Square, icon-only button. `label` is required for screen readers. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { icon: IconName; label: string; variant?: Variant; size?: Size; pressed?: boolean }
>(function IconButton({ icon, label, variant = 'ghost', size = 'md', pressed, className = '', type = 'button', ...rest }, ref) {
  const dim = size === 'sm' ? 'h-9 w-9' : size === 'lg' ? 'h-12 w-12' : 'h-11 w-11'
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={`inline-flex shrink-0 items-center justify-center rounded-full transition-colors disabled:pointer-events-none disabled:opacity-35 ${variants[variant]} ${dim} ${pressed ? 'bg-stone/70 text-ink' : ''} ${className}`}
      {...rest}
    >
      <Icon name={icon} size={size === 'lg' ? 22 : 19} />
    </button>
  )
})
