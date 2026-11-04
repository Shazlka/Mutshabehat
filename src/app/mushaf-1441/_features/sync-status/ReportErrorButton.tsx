'use client'

import { useState } from 'react'
import { errorReportText } from '../../../../../packages/qiraat-core/features/syncStatus'

/** «بلّغ عن خطأ»: shares (or copies) a text with the word's position and the ids of the shown entries. Nothing is sent. */
export function ReportErrorButton(props: { page: number; surah: number; ayah: number; token: number; word: string; variantIds: string[]; rulingIds: string[] }) {
  const [done, setDone] = useState(false)
  async function report() {
    const text = errorReportText(props)
    try {
      if (typeof navigator.share === 'function') await navigator.share({ text })
      else { await navigator.clipboard.writeText(text); setDone(true); window.setTimeout(() => setDone(false), 3000) }
    } catch {
      // The share sheet was dismissed or the clipboard is blocked: nothing to do.
    }
  }
  return (
    <button
      type="button"
      data-testid="report-error"
      onClick={() => void report()}
      className="min-h-6 rounded border border-[var(--mushaf-rule)] px-2 py-0.5 text-[11px] font-bold text-[var(--mushaf-ink)] [@media(pointer:coarse)]:min-h-11"
    >
      {done ? '✓ نُسخ نص البلاغ' : '⚑ بلّغ عن خطأ'}
    </button>
  )
}
