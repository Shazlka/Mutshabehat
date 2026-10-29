'use client'

// Top navigation bar: previous/next page, jump to page, "next page with flagged/unreviewed"
// (from the overview), and a page progress indicator.

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import type { ReviewOverview, ReviewPage } from '../_lib/types'
import { usulCategoriesOnPage, type KindFilter, type StatusFilter } from './statusMeta'
import { cn } from '@/lib/cn'

const MIN_PAGE = 1
const MAX_PAGE = 604

const FILTER_OPTIONS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'manual', label: 'معتمد يدويًا' },
  { id: 'auto', label: 'معتمد آليًا' },
  { id: 'needs-review', label: 'يحتاج مراجعة' },
]

const KIND_OPTIONS: { id: KindFilter; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'farsh', label: 'فرش' },
  { id: 'usul', label: 'أصول' },
]

type Props = {
  pageNumber: number
  page: ReviewPage | null
  overview: ReviewOverview | null
  historyOpen: boolean
  statusFilter?: StatusFilter
  onStatusFilterChange?(filter: StatusFilter): void
  kindFilter?: KindFilter
  onKindFilterChange?(kind: KindFilter): void
  categoryFilter?: string | null
  onCategoryFilterChange?(code: string | null): void
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

export default function ReviewNav({
  pageNumber,
  page,
  overview,
  historyOpen,
  statusFilter = 'all',
  onStatusFilterChange,
  kindFilter = 'all',
  onKindFilterChange,
  categoryFilter = null,
  onCategoryFilterChange,
  onGoToPage,
  onToggleHistory,
}: Props) {
  const [jumpValue, setJumpValue] = useState(String(pageNumber))

  function submitJump(event: FormEvent) {
    event.preventDefault()
    const parsed = Number.parseInt(jumpValue, 10)
    if (Number.isFinite(parsed)) onGoToPage(parsed)
  }

  const usulCategories = page && kindFilter === 'usul' ? usulCategoriesOnPage(page.rows, statusFilter, categoryFilter) : []

  const nextFlagged = findNextPageWith(overview, pageNumber, 'flagged')
  const nextUnreviewed = findNextPageWith(overview, pageNumber, 'unreviewed')

  return (
    <header
      dir="rtl"
      className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5"
    >
      <h1 className="text-sm font-bold text-[var(--color-ink)]">مراجعة القراءات</h1>
      <Link href="/mushaf-1441/mutoon-editor" className="rounded-md border border-[var(--color-border)] px-3 py-2 text-xs font-bold">تحرير المتون</Link>

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

      {onStatusFilterChange ? (
        <div
          role="group"
          aria-label="تصفية الحالات"
          className="flex items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 p-0.5 text-xs font-bold"
        >
          {FILTER_OPTIONS.map((opt) => {
            const active = statusFilter === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={active}
                onClick={() => onStatusFilterChange(opt.id)}
                className={cn(
                  'min-h-7 rounded-md px-2.5 py-1 text-xs font-bold transition-all cursor-pointer',
                  active
                    ? 'bg-[var(--color-surface)] text-[var(--color-ink)] shadow-2xs border border-[var(--color-border)]/50'
                    : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
                )}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      ) : null}

      {onKindFilterChange ? (
        <div
          role="group"
          aria-label="تصفية النوع"
          className="flex items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 p-0.5 text-xs font-bold"
        >
          {KIND_OPTIONS.map((opt) => {
            const active = kindFilter === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={active}
                onClick={() => onKindFilterChange(opt.id)}
                className={cn(
                  'min-h-7 rounded-md px-2.5 py-1 text-xs font-bold transition-all cursor-pointer',
                  active
                    ? 'bg-[var(--color-surface)] text-[var(--color-ink)] shadow-2xs border border-[var(--color-border)]/50'
                    : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
                )}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      ) : null}

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
      {onCategoryFilterChange && kindFilter === 'usul' ? (
        <div
          role="group"
          aria-label="تصفية أبواب الأصول"
          className="flex w-full flex-wrap items-center gap-1.5 border-t border-[var(--color-border)] pt-2"
        >
          <button
            type="button"
            aria-pressed={categoryFilter === null}
            onClick={() => onCategoryFilterChange(null)}
            className={cn(
              'min-h-7 rounded-full border px-3 text-xs font-bold transition-colors cursor-pointer',
              categoryFilter === null
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                : 'border-[var(--color-border)] text-[var(--color-ink-soft)] hover:border-[var(--color-primary)]'
            )}
          >
            كل الأصول
          </button>
          {usulCategories.map((cat) => {
            const active = categoryFilter === cat.code
            return (
              <button
                key={cat.code}
                type="button"
                aria-pressed={active}
                onClick={() => onCategoryFilterChange(active ? null : cat.code)}
                className={cn(
                  'min-h-7 rounded-full border px-3 text-xs font-bold transition-colors cursor-pointer',
                  active
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    : 'border-[var(--color-border)] text-[var(--color-ink-soft)] hover:border-[var(--color-primary)]',
                  cat.count === 0 && !active && 'opacity-50'
                )}
              >
                {cat.nameAr} <span className="font-normal text-[var(--color-ink-muted)]">({cat.count})</span>
              </button>
            )
          })}
          {usulCategories.length === 0 ? (
            <span className="text-xs text-[var(--color-ink-muted)]">لا توجد أصول في هذه الصفحة</span>
          ) : null}
        </div>
      ) : null}
    </header>
  )
}
