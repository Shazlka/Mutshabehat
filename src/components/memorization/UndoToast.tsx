'use client'

import { useEffect } from 'react'
import type { Milestone } from '../../../packages/memorization-core/planner'
import { describeMilestone } from '../../lib/memorization-view'

export interface ToastPayload {
  batchId: string
  changedAyatCount: number
  milestones: readonly Milestone[]
}

export interface UndoToastProps {
  toast: ToastPayload
  surahNames: Readonly<Record<number, string>>
  onUndo: (batchId: string) => void
  onDismiss: () => void
  durationMs?: number
}

const STRINGS = {
  updatedAyat: (count: number) => `تم تحديث ${count} آية`,
  undo: 'تراجع',
  dismiss: 'إغلاق',
}

/**
 * Floating 8-second toast showing update summary, any reached milestones, and an Undo button.
 * Mirrors iOS UndoToast.swift.
 */
export function UndoToast({
  toast,
  surahNames,
  onUndo,
  onDismiss,
  durationMs = 8000,
}: UndoToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss()
    }, durationMs)
    return () => clearTimeout(timer)
  }, [toast.batchId, onDismiss, durationMs])

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-md animate-fade-rise"
    >
      <div className="flex flex-col gap-1.5 rounded-2xl border border-[var(--qiraat-card-stroke)] bg-[var(--qiraat-card-fill)]/95 p-3.5 shadow-lg backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-bold text-[var(--mushaf-ink)]">
            {STRINGS.updatedAyat(toast.changedAyatCount)}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onUndo(toast.batchId)}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-[var(--app-danger)] px-3 text-xs font-black text-white shadow-xs transition-opacity hover:opacity-90 active:opacity-80 focus-visible:outline-2"
            >
              {STRINGS.undo}
            </button>
            <button
              type="button"
              onClick={onDismiss}
              aria-label={STRINGS.dismiss}
              className="inline-flex size-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[var(--qx-muted)] hover:bg-[var(--mushaf-rule-soft)] focus-visible:outline-2"
            >
              ✕
            </button>
          </div>
        </div>

        {toast.milestones.length > 0 && (
          <div className="flex flex-col gap-1 pt-1 border-t border-[var(--qiraat-card-stroke)]">
            {toast.milestones.map((milestone, idx) => (
              <span
                key={`${milestone.type}-${idx}`}
                className="text-xs font-bold text-[var(--memo-mastered)] leading-tight"
              >
                ★ {describeMilestone(milestone, 'arabic', (s) => surahNames[s] ?? String(s))}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
