'use client'

import { useEffect, useRef } from 'react'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

const TOOLBAR = [
  { cmd: 'bold',                 label: 'B', title: 'عريض',  className: 'font-bold' },
  { cmd: 'italic',               label: 'I', title: 'مائل',  className: 'italic' },
  { cmd: 'underline',            label: 'U', title: 'تحته خط', className: 'underline' },
  { cmd: 'insertUnorderedList',  label: '•', title: 'قائمة', className: '' },
  { cmd: 'removeFormat',         label: '⌫', title: 'مسح التنسيق', className: '' },
]

export default function RichEditor({ value, onChange, placeholder }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  // Sync external value → DOM (only when DOM differs to preserve caret)
  useEffect(() => {
    const el = ref.current
    if (el && el.innerHTML !== value) el.innerHTML = value || ''
  }, [value])

  function exec(cmd: string) {
    // execCommand is deprecated but is still the simplest cross-browser approach
    // for contenteditable formatting. Acceptable for a non-critical notes field.
    document.execCommand(cmd, false)
    ref.current?.focus()
    if (ref.current) onChange(ref.current.innerHTML)
  }

  function onColorChange(color: string) {
    document.execCommand('foreColor', false, color)
    ref.current?.focus()
    if (ref.current) onChange(ref.current.innerHTML)
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden focus-within:border-[var(--color-primary)] focus-within:ring-4 focus-within:ring-[var(--color-primary-soft)] transition-all duration-200">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[var(--color-border-soft)] bg-[var(--color-surface-2)]">
        {TOOLBAR.map((b) => (
          <button key={b.cmd} type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(b.cmd)}
            title={b.title} aria-label={b.title}
            className={`w-8 h-8 rounded-md inline-flex items-center justify-center text-[13px] text-[var(--color-ink-soft)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)] tap-shrink transition-colors ${b.className}`}>
            {b.label}
          </button>
        ))}
        <span className="flex-1" />
        <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors">
          <input type="color"
            onChange={(e) => onColorChange(e.target.value)}
            className="w-6 h-6 rounded cursor-pointer border-0 p-0" />
          لون
        </label>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder ?? ''}
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        dir="rtl"
        className="min-h-[100px] px-4 py-3 text-[14px] leading-[1.9] text-[var(--color-ink)] outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-[var(--color-ink-muted)] empty:before:pointer-events-none" />
    </div>
  )
}
