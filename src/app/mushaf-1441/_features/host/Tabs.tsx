'use client'

import { useId, useRef, type ReactNode } from 'react'
import { nextTabIndex } from '../../../../../packages/qiraat-core/features/tabs'

/** WAI-ARIA tabs: roving tabindex, arrow keys (visual direction), Home/End, and a labelled tabpanel. */
export function Tabs<T extends string>(props: {
  label: string
  tabs: { id: T; label: string }[]
  value: T
  onChange: (id: T) => void
  children: ReactNode
}) {
  const { label, tabs, value, onChange, children } = props
  const base = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const index = Math.max(0, tabs.findIndex((t) => t.id === value))
  const tabId = (id: string) => `${base}-tab-${id}`
  const panelId = `${base}-panel`

  return (
    <>
      <div
        role="tablist"
        aria-label={label}
        className="mb-3 flex gap-1"
        onKeyDown={(event) => {
          const next = nextTabIndex(tabs.length, index, event.key, true)
          if (next === null) return
          event.preventDefault()
          onChange(tabs[next].id)
          refs.current[next]?.focus()
        }}
      >
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => { refs.current[i] = el }}
            id={tabId(t.id)}
            type="button"
            role="tab"
            aria-selected={value === t.id}
            aria-controls={panelId}
            tabIndex={value === t.id ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={`min-h-6 flex-1 rounded border px-2 py-1 text-xs font-bold [@media(pointer:coarse)]:min-h-11 ${value === t.id ? 'border-[var(--mushaf-ink)] bg-[var(--mushaf-ink)] text-white' : 'border-[var(--mushaf-rule)]'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={panelId} aria-labelledby={tabId(value)} tabIndex={0}>
        {children}
      </div>
    </>
  )
}
