'use client'

import { useId } from 'react'
import type { KhatmaRecord } from '../../../packages/reading-core'
import {
  calculateKhatmaDaysElapsed,
  formatArabicDate,
  toArabicDigits,
} from '../../lib/reading-view'

const STRINGS = {
  praise: 'الْحَمْدُ لِلَّهِ',
  celebrationTitle: 'تَمَّتْ خَتْمَةُ الْقُرْآنِ الْكَرِيمِ بِحَمْدِ اللَّهِ وَتَوْفِيقِهِ',
  khatmaPrefix: 'الختمة رقم',
  startDate: 'تاريخ البدء',
  completeDate: 'تاريخ الختم',
  durationLabel: 'المدة',
  daysUnit: 'يوماً',
  pagesCount: '٦٠٤ صفحة',
  ayahsCount: '٦٢٣٦ آية',
  startNewKhatma: 'ابدأ ختمة جديدة',
  viewStatistics: 'عرض الإحصائيات',
  closeDialogLabel: 'إغلاق نافذة إتمام الختمة',
} as const

export interface KhatmaCelebrationDialogProps {
  readonly khatma: KhatmaRecord | null
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly onStartNewKhatma?: () => void
}

export function KhatmaCelebrationDialog({
  khatma,
  isOpen,
  onClose,
  onStartNewKhatma,
}: KhatmaCelebrationDialogProps) {
  const titleId = useId()

  if (!isOpen || !khatma) return null

  const daysElapsed = calculateKhatmaDaysElapsed(khatma.startedAt, khatma.completedAt)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs motion-reduce:transition-none"
      dir="rtl"
    >
      <div className="relative flex w-full max-w-md flex-col items-center rounded-2xl border border-[var(--mushaf-gold,#b99b51)] bg-[var(--mushaf-paper,#fcf8ed)] p-6 text-center text-[var(--mushaf-ink,#171717)] shadow-2xl">
        {/* Illuminated Emblem */}
        <div
          aria-hidden="true"
          className="flex size-20 items-center justify-center rounded-full border-2 border-[var(--mushaf-gold,#b99b51)] bg-[var(--mushaf-gold,#b99b51)]/10 text-3xl shadow-sm"
        >
          📖
        </div>

        {/* Praise & Dedication */}
        <h2 id={titleId} className="mt-4 font-serif text-2xl font-bold tracking-wide sm:text-3xl">
          {STRINGS.praise}
        </h2>

        <p className="mt-2 text-sm font-bold text-[var(--mushaf-gold,#b99b51)] sm:text-base">
          {STRINGS.celebrationTitle}
        </p>

        {/* Khatma Details Card */}
        <div className="mt-6 w-full space-y-3 rounded-xl border border-[var(--qiraat-card-stroke,#d7c7a7)] bg-[var(--qiraat-card-fill,#ffffff)] p-4 text-xs font-semibold sm:text-sm">
          <div className="flex items-center justify-between border-b border-[var(--qiraat-card-stroke,#d7c7a7)] pb-2.5">
            <span className="text-[var(--mushaf-brown,#665b48)]">
              {STRINGS.khatmaPrefix}
            </span>
            <span className="text-base font-bold text-[var(--app-progress,#1A7340)]">
              {toArabicDigits(khatma.khatmaNumber)}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 py-1 text-center">
            <div>
              <p className="text-[11px] text-[var(--mushaf-brown,#665b48)]">{STRINGS.startDate}</p>
              <p className="mt-0.5 font-bold">{formatArabicDate(khatma.startedAt, { short: true })}</p>
            </div>
            <div>
              <p className="text-[11px] text-[var(--mushaf-brown,#665b48)]">{STRINGS.completeDate}</p>
              <p className="mt-0.5 font-bold">{formatArabicDate(khatma.completedAt ?? new Date(), { short: true })}</p>
            </div>
            <div>
              <p className="text-[11px] text-[var(--mushaf-brown,#665b48)]">{STRINGS.durationLabel}</p>
              <p className="mt-0.5 font-bold">{toArabicDigits(daysElapsed)} {STRINGS.daysUnit}</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 border-t border-[var(--qiraat-card-stroke,#d7c7a7)] pt-2.5 text-xs text-[var(--mushaf-brown,#665b48)]">
            <span>{STRINGS.pagesCount}</span>
            <span>•</span>
            <span>{STRINGS.ayahsCount}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex w-full flex-col gap-2.5">
          <button
            type="button"
            onClick={() => {
              if (onStartNewKhatma) onStartNewKhatma()
              onClose()
            }}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--app-progress-fill,#1A7340)] px-4 text-sm font-bold text-white shadow-sm transition-transform active:scale-[0.98]"
          >
            <span>↻</span>
            <span>{STRINGS.startNewKhatma}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-[var(--qiraat-card-stroke,#d7c7a7)] bg-[var(--qiraat-card-fill,#ffffff)] px-4 text-sm font-bold text-[var(--mushaf-ink,#171717)] transition-colors hover:bg-black/5 active:scale-[0.98]"
            aria-label={STRINGS.closeDialogLabel}
          >
            {STRINGS.viewStatistics}
          </button>
        </div>
      </div>
    </div>
  )
}
