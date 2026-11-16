'use client'

import { useEffect, useState } from 'react'
import {
  QIRAAT_HINT_AUTO_DISMISS_MS,
  readQiraatHintSeen,
  shouldShowQiraatHint,
  writeQiraatHintSeen,
} from './qiraatHintHelper'

export function QiraatFirstUseHint(props: {
  qiraatEnabled: boolean
  footerVisible: boolean
  onInteraction?: () => void
}) {
  const { footerVisible, onInteraction, qiraatEnabled } = props
  const [hintSeen, setHintSeen] = useState<boolean>(() => readQiraatHintSeen())

  const visible = shouldShowQiraatHint({ qiraatEnabled, hintSeen })

  const dismiss = () => {
    writeQiraatHintSeen()
    setHintSeen(true)
    onInteraction?.()
  }

  useEffect(() => {
    if (!visible) return
    const timer = window.setTimeout(() => {
      dismiss()
    }, QIRAAT_HINT_AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [visible])

  if (!visible) return null

  // Anchored just above the phone footer bar (which sits at bottom with safe area)
  const bottomOffset = footerVisible
    ? 'calc(max(10px, env(safe-area-inset-bottom, 0px)) + 120px)'
    : 'calc(max(10px, env(safe-area-inset-bottom, 0px)) + 16px)'

  return (
    <div
      role="status"
      aria-live="polite"
      dir="rtl"
      data-testid="qiraat-first-use-hint"
      className="fixed inset-x-3 z-[55] mx-auto flex max-w-sm items-center justify-between gap-2.5 rounded-2xl border-[0.5px] border-[var(--qiraat-card-stroke)] bg-[var(--qiraat-badge-fill)] px-3.5 py-1.5 text-[var(--qiraat-badge-ink)] shadow-[0_8px_24px_color-mix(in_srgb,var(--mushaf-ink)_14%,transparent)] transition-[bottom,opacity,transform] duration-200 ease-out md:hidden"
      style={{ bottom: bottomOffset }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <svg
          className="size-5 shrink-0 text-[var(--qiraat-badge-ink)]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M14 4.5a2.5 2.5 0 0 0-5 0v7a.5.5 0 0 1-1 0V8a2 2 0 0 0-4 0v7a7 7 0 0 0 14 0v-4.5a2.5 2.5 0 0 0-4-2" />
          <path d="M12 2a4 4 0 0 1 4 4" />
        </svg>
        <span className="text-xs font-bold leading-relaxed">
          المس كلمة ملوّنة لعرض قراءاتها
        </span>
      </div>
      <button
        type="button"
        aria-label="إخفاء التلميح"
        onClick={dismiss}
        className="flex size-11 shrink-0 touch-manipulation items-center justify-center rounded-lg text-[var(--qiraat-badge-ink)] transition-opacity hover:opacity-70 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mushaf-gold)]"
      >
        <svg
          className="size-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
