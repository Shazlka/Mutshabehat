'use client'

// Top navigation bar: previous/next page, jump to page, "next page with flagged/unreviewed"
// (from the overview), and a page progress indicator.

import { useState, type FormEvent } from 'react'
import type { ReviewOverview, ReviewPage } from '../_lib/types'
import { cn } from '@/lib/cn'

const MIN_PAGE = 1
const MAX_PAGE = 604

type Props = {
  pageNumber: number
  page: ReviewPage | null
  overview: ReviewOverview | null
  historyOpen: boolean
  onGoToPage(page: number): void
  onToggleHistory(): void
}

function findNextPageWith(overview: ReviewOverview | null, current: number, key: 'flagged' | 'unreviewed'): number | null {
  if (!overview) return null
  const sorted = [...overview.pages].sort((a, b) => a.page - b.page)
  const ahead = sorted.find((entry) => entry.page > current && entry[key] > 0)
  if (ahead) return ahead.page
  const wrapped = sorted.find((entry) => entry[key] > 0)
  return wrapped ? wrapped.page : null
}

export default function ReviewNav({ pageNumber, page, overview, historyOpen, onGoToPage, onToggleHistory }: Props) {
  const [jumpValue, setJumpValue] = useState(String(pageNumber))

  function submitJump(event: FormEvent) {
    event.preventDefault()
    const parsed = Number.parseInt(jumpValue, 10)
    if (Number.isFinite(parsed)) onGoToPage(parsed)
  }

  const nextFlagged = findNextPageWith(overview, pageNumber, 'flagged')
  const nextUnreviewed = findNextPageWith(overview, pageNumber, 'unreviewed')

  return (
    <header
      dir="rtl"
      className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5"
    >
      <h1 className="text-sm font-bold text-[var(--color-ink)]">مراجعة القراءات</h1>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="الصفحة السابقة"
          title="الصفحة السابقة"
          className="min-h-9 min-w-9 rounded-md border border-[var(--color-border)] text-sm disabled:opacity-40"
          disabled={pageNumber <= MIN_PAGE}
          onClick={() => onGoToPage(pageNumber - 1)}
        >
          →
        </button>
        <form onSubmit={submitJump} className="flex items-center gap-1">
          <label className="sr-only" htmlFor="qiraat-review-page-jump">
            الانتقال إلى صفحة
          </label>
          <input
            id="qiraat-review-page-jump"
            inputMode="numeric"
            className="min-h-9 w-16 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-center text-sm"
            value={jumpValue}
            onChange={(event) => setJumpValue(event.target.value)}
          />
          <span className="text-xs text-[var(--color-ink-muted)]">/ {MAX_PAGE}</span>
        </form>
        <button
          type="button"
          aria-label="الصفحة التالية"
          title="الصفحة التالية"
          className="min-h-9 min-w-9 rounded-md border border-[var(--color-border)] text-sm disabled:opacity-40"
          disabled={pageNumber >= MAX_PAGE}
          onClick={() => onGoToPage(pageNumber + 1)}
        >
          ←
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="min-h-9 rounded-full border border-[var(--color-danger)]/40 px-3 text-xs font-bold text-[var(--color-danger)] disabled:opacity-40"
          disabled={nextFlagged === null}
          onClick={() => nextFlagged !== null && onGoToPage(nextFlagged)}
        >
          الصفحة التالية المعلَّمة
        </button>
        <button
          type="button"
          className="min-h-9 rounded-full border border-[var(--color-border)] px-3 text-xs font-bold text-[var(--color-ink-soft)] disabled:opacity-40"
          disabled={nextUnreviewed === null}
          onClick={() => nextUnreviewed !== null && onGoToPage(nextUnreviewed)}
        >
          الصفحة التالية غير المراجَعة
        </button>
      </div>

      {page ? (
        <p className="text-xs text-[var(--color-ink-muted)]" aria-live="polite">
          {page.stats.total} سطر · غير مراجَع {page.stats.unreviewed} · معلَّم {page.stats.flagged} · مُراجَع{' '}
          {page.stats.reviewed}
        </p>
      ) : null}

      <div className="me-0 ms-auto flex items-center gap-1.5">
        <button
          type="button"
          aria-pressed={historyOpen}
          className={cn(
            'min-h-9 rounded-md border px-3 text-xs font-bold transition-colors hover:border-[var(--color-primary)]',
            historyOpen
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-[var(--color-border)] text-[var(--color-ink-soft)]'
          )}
          onClick={onToggleHistory}
        >
          سجل التعديلات
        </button>
      </div>
    </header>
  )
}
