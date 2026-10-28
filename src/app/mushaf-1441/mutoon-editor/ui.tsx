'use client'

import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'

// A small, consistent vocabulary for the editor: one icon style, one button shape, one focus ring.
export const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]'
export const TOUCH = 'min-h-9 [@media(pointer:coarse)]:min-h-11'

const PATHS = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6L6 18',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4',
  refresh: 'M20 11a8 8 0 00-14.5-3.5M4 4v4.5h4.5M4 13a8 8 0 0014.5 3.5M20 20v-4.5h-4.5',
  download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  right: 'M9 6l6 6-6 6',
  left: 'M15 6l-6 6 6 6',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  book: 'M5 4h10a3 3 0 013 3v13H8a3 3 0 01-3-3V4zM5 17a3 3 0 013-3h10',
  alert: 'M12 8v5M12 17h.01M10.3 4.2L2.8 17a2 2 0 001.7 3h15a2 2 0 001.7-3L13.7 4.2a2 2 0 00-3.4 0z',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  copy: 'M9 9h10v11H9zM5 15V4h10',
} as const
export type IconName = keyof typeof PATHS

export function Icon({ name, size = 18, className = '' }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path d={PATHS[name]} />
    </svg>
  )
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'quiet' | 'danger' | 'plain'; icon?: IconName; compact?: boolean }
export function Btn({ tone = 'quiet', icon, compact, className = '', children, ...rest }: BtnProps) {
  const tones = {
    primary: 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]',
    quiet: 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]',
    danger: 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]',
    plain: 'text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]',
  }
  return (
    <button type="button" {...rest}
      className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${compact ? 'min-h-8 [@media(pointer:coarse)]:min-h-11' : TOUCH} ${tones[tone]} ${FOCUS} ${className}`}>
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  )
}

export function IconBtn({ icon, label, tone = 'plain', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; tone?: 'plain' | 'danger' | 'quiet' }) {
  const tones = {
    plain: 'text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]',
    quiet: 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-2)]',
    danger: 'text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]',
  }
  return (
    <button type="button" aria-label={label} title={label} {...rest}
      className={`inline-flex size-9 cursor-pointer items-center justify-center rounded-lg transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-30 [@media(pointer:coarse)]:size-11 ${tones[tone]} ${FOCUS} ${className}`}>
      <Icon name={icon} />
    </button>
  )
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-[var(--color-surface-2)] p-0.5">
      {options.map(o => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={`cursor-pointer rounded-md px-3 text-xs font-bold transition-colors duration-150 ${TOUCH} ${FOCUS} ${value === o.value ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow-[0_1px_2px_oklch(0.3_0.02_60/0.12)]' : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold text-[var(--color-ink-soft)]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-[var(--color-ink-muted)]">{hint}</span>}
    </label>
  )
}

export const INPUT = `w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)] ${TOUCH} ${FOCUS}`

/** Two-step destructive button: the first press arms it, the second confirms; no browser dialogs. */
export function ConfirmBtn({ label, confirmLabel = 'تأكيد', onConfirm, icon = 'trash', compact }: { label: string; confirmLabel?: string; onConfirm: () => void; icon?: IconName; compact?: boolean }) {
  const [armed, setArmed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  return (
    <Btn tone="danger" icon={armed ? 'check' : icon} compact={compact} aria-live="polite"
      onClick={() => {
        if (armed) { setArmed(false); onConfirm(); return }
        setArmed(true)
        timer.current = setTimeout(() => setArmed(false), 3500)
      }}>
      {armed ? confirmLabel : label}
    </Btn>
  )
}

/** A text input that saves when the field is left or Enter is pressed, not on every keystroke. */
export function CommitInput({ value, onCommit, placeholder, label, maxLength = 500 }: { value: string; onCommit: (v: string) => void; placeholder?: string; label: string; maxLength?: number }) {
  const [draft, setDraft] = useState(value)
  const [seen, setSeen] = useState(value)
  if (seen !== value) { setSeen(value); setDraft(value) } // follow the saved value when it changes from elsewhere
  return (
    <input aria-label={label} className={INPUT} value={draft} maxLength={maxLength} placeholder={placeholder}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { if (draft !== value) onCommit(draft) }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
  )
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="text-[11px] font-bold tracking-wide text-[var(--color-ink-soft)]">{children}</h3>
      {aside}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-[var(--color-surface-2)] ${className}`} aria-hidden="true" />
}
