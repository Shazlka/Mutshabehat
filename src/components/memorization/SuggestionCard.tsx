'use client'

import type { Suggestion } from '../../../packages/memorization-core/reviewEngine'

export interface SuggestionCardProps {
  suggestion: Suggestion
  surahNames: Readonly<Record<number, string>>
  onOpenSurah?: (surah: number) => void
  onStartReview?: (surah: number) => void
}

const STRINGS = {
  sectionTitle: 'المقترح اليوم',
  continueLearning: (name: string, count: number) => `أكمل سورة ${name}، متبقٍ ${count} آيات`,
  reviewWithDays: (name: string, days: number) => `راجع سورة ${name}، آخر مراجعة منذ ${days} أيام`,
  reviewNever: (name: string) => `راجع سورة ${name}، لم تتم مراجعتها بعد`,
  actionOpenSurah: 'افتح السورة',
  actionStartReview: 'ابدأ المراجعة',
}

/**
 * Daily smart suggestion card: finish the range being learned, or review the most overdue surah.
 * Mirrors iOS SuggestionCard.swift.
 */
export function SuggestionCard({
  suggestion,
  surahNames,
  onOpenSurah,
  onStartReview,
}: SuggestionCardProps) {
  const surahName = surahNames[suggestion.surah] ?? String(suggestion.surah)

  let message = ''
  let actionLabel = ''
  let handleAction: () => void = () => {}

  if (suggestion.type === 'continueLearning') {
    message = STRINGS.continueLearning(surahName, suggestion.remaining)
    actionLabel = STRINGS.actionOpenSurah
    handleAction = () => onOpenSurah?.(suggestion.surah)
  } else {
    message = suggestion.daysSinceReview !== undefined
      ? STRINGS.reviewWithDays(surahName, suggestion.daysSinceReview)
      : STRINGS.reviewNever(surahName)
    actionLabel = STRINGS.actionStartReview
    handleAction = () => onStartReview?.(suggestion.surah)
  }

  return (
    <div
      data-testid="memo-suggestion"
      className="flex flex-col gap-2 rounded-xl border border-[var(--qiraat-card-stroke)] bg-[var(--qiraat-card-fill)] p-3.5 shadow-xs"
    >
      <span className="text-xs font-semibold text-[var(--qx-muted)]">
        {STRINGS.sectionTitle}
      </span>
      <p className="text-sm font-bold text-[var(--mushaf-ink)] leading-snug">
        {message}
      </p>
      <div>
        <button
          type="button"
          onClick={handleAction}
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[var(--qiraat-card-stroke)] bg-[var(--mushaf-paper-tinted)] px-4 py-2 text-xs font-bold text-[var(--mushaf-ink)] transition-colors hover:brightness-95 active:brightness-90 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  )
}
