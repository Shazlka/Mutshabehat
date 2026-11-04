'use client'

// Next / previous marked word inside the Qiraat word sheet (iOS QiraatSheetNavigator).
// Pure presentation: the viewer owns the marked-word list and the selection.
export interface WordSheetNavProps {
  /** 1-based position of the current word among the marked words of the visible page(s). */
  position: number
  total: number
  canPrev: boolean
  canNext: boolean
  onPrev: () => void
  onNext: () => void
}

const BUTTON =
  'min-h-6 min-w-6 rounded border border-[var(--mushaf-rule)] px-2 py-0.5 text-[11px] font-bold text-[var(--mushaf-ink)] ' +
  'disabled:cursor-not-allowed disabled:opacity-40 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11'

export function WordSheetNav({ position, total, canPrev, canNext, onPrev, onNext }: WordSheetNavProps) {
  return (
    <div data-testid="word-sheet-nav" className="flex items-center justify-between gap-2" dir="rtl">
      <button type="button" className={BUTTON} disabled={!canPrev} onClick={onPrev} aria-label="الكلمة السابقة">
        ‹ السابقة
      </button>
      <span data-testid="word-sheet-position" className="text-[11px] font-bold text-[var(--mushaf-muted)]">
        {position} من {total}
      </span>
      <button type="button" className={BUTTON} disabled={!canNext} onClick={onNext} aria-label="الكلمة التالية">
        التالية ›
      </button>
    </div>
  )
}
