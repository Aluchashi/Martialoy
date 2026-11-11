import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'

/* Shared inline icon set — Lucide-style geometry, stroke 1.75, no emoji,
   no extra dependency. Sizes are 16 / 20 / 24 only. */
const ICON_PATHS = {
  check: <path d="M20 6 9 17l-5-5" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  alert: (
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowUpRight: <path d="M7 17 17 7M7 7h10v10" />,
  route: (
    <>
      <circle cx="6" cy="19" r="3" />
      <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
      <circle cx="18" cy="5" r="3" />
    </>
  ),
  calculator: (
    <>
      <rect width="16" height="20" x="4" y="2" rx="2" />
      <path d="M8 6h8M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
    </>
  ),
  shieldCheck: (
    <>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
} as const

export type IconName = keyof typeof ICON_PATHS

export interface IconProps {
  name: IconName
  size?: 16 | 20 | 24
  className?: string
}

export function Icon({ name, size = 16, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICON_PATHS[name]}
    </svg>
  )
}

/* ---------- Container ---------- */

export function Container({
  wide = false,
  className,
  children,
}: {
  wide?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div className={`ui-container${wide ? ' ui-container-wide' : ''}${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  )
}

/* ---------- Buttons ---------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

function buttonClass(variant: ButtonVariant, size: ButtonSize, className?: string) {
  return `ui-btn ui-btn-${variant} ui-btn-${size}${className ? ` ${className}` : ''}`
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </button>
  )
}

export interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <a className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </a>
  )
}

/* ---------- Card ---------- */

export function Card({
  large = false,
  className,
  children,
}: {
  large?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div className={`ui-card${large ? ' ui-card-lg' : ''}${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  )
}

/* ---------- Chip (status pill) ---------- */

type ChipTone = 'pass' | 'fail' | 'warn' | 'info'

const CHIP_ICON: Record<ChipTone, IconName> = {
  pass: 'check',
  fail: 'close',
  warn: 'alert',
  info: 'info',
}

export function Chip({
  tone = 'info',
  icon,
  className,
  children,
}: {
  tone?: ChipTone
  icon?: IconName
  className?: string
  children: ReactNode
}) {
  return (
    <span className={`ui-chip ui-chip-${tone}${className ? ` ${className}` : ''}`}>
      <Icon name={icon ?? CHIP_ICON[tone]} size={16} />
      <span>{children}</span>
    </span>
  )
}

/* ---------- Segmented control ---------- */

export interface SegmentOption<T extends string> {
  value: T
  label: string
  icon?: IconName
}

export interface SegmentedControlProps<T extends string> {
  value: T
  options: SegmentOption<T>[]
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={ariaLabel} className={`ui-seg${className ? ` ${className}` : ''}`}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            className={active ? 'is-active' : undefined}
            onClick={() => onChange(option.value)}
          >
            {option.icon && <Icon name={option.icon} size={16} />}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/* ---------- Stat card ---------- */

export interface StatCardProps {
  label: string
  icon?: IconName
  value: ReactNode
  unit?: string
  support?: ReactNode
  className?: string
}

export function StatCard({ label, icon, value, unit, support, className }: StatCardProps) {
  return (
    <article className={`ui-stat${className ? ` ${className}` : ''}`}>
      <span className="ui-stat-label">{label}</span>
      {icon && <Icon name={icon} size={20} className="ui-stat-icon" />}
      <div className="ui-stat-value">
        {value}
        {unit && <span className="ui-stat-unit">{unit}</span>}
      </div>
      {support && <div className="ui-stat-support">{support}</div>}
    </article>
  )
}

/* ---------- List row ---------- */

export interface ListRowProps {
  label: ReactNode
  value: ReactNode
  sub?: ReactNode
  className?: string
}

export function ListRow({ label, value, sub, className }: ListRowProps) {
  return (
    <div className={`ui-row${className ? ` ${className}` : ''}`}>
      <span className="ui-row-label">
        {label}
        {sub && <small className="ui-row-sub">{sub}</small>}
      </span>
      <span className="ui-row-value">{value}</span>
    </div>
  )
}

/* ---------- Empty state ---------- */

export function EmptyState({
  title,
  children,
  actions,
  className,
}: {
  title: string
  children?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <section className={`ui-empty${className ? ` ${className}` : ''}`}>
      <h2 className="ui-empty-title">{title}</h2>
      {children && <p className="ui-empty-copy">{children}</p>}
      {actions && <div className="ui-empty-actions">{actions}</div>}
    </section>
  )
}

/* ---------- Stepper ---------- */

export function Stepper({
  step,
  total = 3,
  label,
  className,
}: {
  step: number
  total?: number
  label: string
  className?: string
}) {
  return (
    <div className={`ui-stepper${className ? ` ${className}` : ''}`}>
      <span className="ui-stepper-label">
        Step {step} of {total} · {label}
      </span>
      <span className="ui-stepper-bar" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => (
          <i key={index} className={index < step ? 'is-done' : undefined} />
        ))}
      </span>
    </div>
  )
}
