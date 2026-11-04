'use client'

import { useEffect, type ReactNode } from 'react'

// Shared frame of every iOS-parity sheet: a dialog that is full-screen on phones and a wide panel on
// larger screens, closed by the button, Escape or a click on the backdrop. RTL, Mushaf tokens, 44 px close
// target on touch.
export function FeatureSheet(props: { title: string; onClose: () => void; children: ReactNode; testId?: string }) {
  const { title, onClose, children, testId } = props
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
        dir="rtl"
        className="flex max-h-full w-full flex-col overflow-hidden bg-[var(--mushaf-cream)] text-[var(--mushaf-ink)] sm:max-h-[88vh] sm:max-w-2xl sm:rounded-xl sm:border sm:border-[var(--mushaf-rule)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-2 border-b border-[var(--mushaf-rule)] px-4 py-3">
          <h2 className="text-base font-black">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="min-h-6 min-w-6 rounded border border-[var(--mushaf-rule)] px-3 text-sm font-bold [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11"
          >
            إغلاق
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </section>
    </div>
  )
}
