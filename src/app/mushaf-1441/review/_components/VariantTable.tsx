'use client'

// D9 — the variant table, LEFT pane. One row per reading, in page order.
// Filters: all / unreviewed / flagged / reviewed / deleted; kind فرش / أصول.

import { useMemo } from 'react'
import type { CatalogNarrator, ReviewPage, ReviewRow } from '../_lib/types'
import { cn } from '@/lib/cn'
import {
  filterReviewRows,
  formatPosition,
  KIND_LABEL_AR,
  STATUS_LABEL_AR,
  statusBadgeStyle,
  type KindFilter,
  type StatusFilter,
} from './statusMeta'

type Props = {
  page: ReviewPage
  selectedRowId: string | null
  hoveredRowId: string | null
  statusFilter: StatusFilter
  kindFilter: KindFilter
  onStatusFilterChange(filter: StatusFilter): void
  onKindFilterChange(filter: KindFilter): void
  onSelectRow(row: ReviewRow): void
  onHoverRow(rowId: string | null): void
  registerRowRef(entryId: string, el: HTMLButtonElement | null): void
}

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'unreviewed', label: 'غير مراجَع' },
  { value: 'flagged', label: 'معلَّم' },
  { value: 'reviewed', label: 'مُراجَع' },
  { value: 'deleted', label: 'محذوف' },
]

const KIND_FILTERS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'farsh', label: 'فرش' },
  { value: 'usul', label: 'أصول' },
]

function narratorLookup(narrators: CatalogNarrator[]): Map<string, CatalogNarrator> {
  return new Map(narrators.map((n) => [n.id, n]))
}

function filterButton(active: boolean) {
  return cn(
    'min-h-8 rounded-full border px-3 py-1 text-xs font-bold transition-colors',
    active
      ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
      : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-soft)] hover:border-[var(--color-primary)]'
  )
}

export default function VariantTable({
  page,
  selectedRowId,
  hoveredRowId,
  statusFilter,
  kindFilter,
  onStatusFilterChange,
  onKindFilterChange,
  onSelectRow,
  onHoverRow,
  registerRowRef,
}: Props) {
  const narrators = useMemo(() => narratorLookup(page.narrators), [page.narrators])

  const rows = useMemo(
    () => filterReviewRows(page.rows, statusFilter, kindFilter),
    [page.rows, statusFilter, kindFilter]
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col" dir="rtl">
      <div className="flex flex-col gap-2 border-b border-[var(--color-border-soft)] bg-[var(--color-surface)] p-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="تصفية حسب الحالة">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={filterButton(statusFilter === filter.value)}
              aria-pressed={statusFilter === filter.value}
              onClick={() => onStatusFilterChange(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="تصفية حسب النوع">
          {KIND_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={filterButton(kindFilter === filter.value)}
              aria-pressed={kindFilter === filter.value}
              onClick={() => onKindFilterChange(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-[var(--color-ink-muted)]">{rows.length} من {page.rows.length} سطرًا</p>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto" aria-label="جدول القراءات">
        {rows.length === 0 ? (
          <li className="p-4 text-center text-sm text-[var(--color-ink-muted)]">لا توجد سطور مطابقة للتصفية.</li>
        ) : null}
        {rows.map((row) => {
          const isSelected = row.entryId === selectedRowId
          const isHovered = row.entryId === hoveredRowId
          const openFlags = row.flags.filter((flag) => flag.status === 'open').length
          return (
            <li key={row.entryId} className="border-b border-[var(--color-border-soft)] last:border-b-0">
              <button
                ref={(el) => registerRowRef(row.entryId, el)}
                type="button"
                onClick={() => onSelectRow(row)}
                onMouseEnter={() => onHoverRow(row.entryId)}
                onMouseLeave={() => onHoverRow(null)}
                onFocus={() => onHoverRow(row.entryId)}
                onBlur={() => onHoverRow(null)}
                aria-current={isSelected}
                className={cn(
                  'flex w-full flex-col gap-1.5 px-3 py-2.5 text-right transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]',
                  isSelected && 'bg-[var(--color-primary-soft)]',
                  !isSelected && isHovered && 'bg-[var(--color-surface-2)]',
                  !isSelected && !isHovered && 'bg-[var(--color-surface)]'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-[var(--color-ink-muted)]">
                    {formatPosition(row.surah, row.ayah, row.startWord)}
                  </span>
                  <span className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-ink-soft)]">
                    {KIND_LABEL_AR[row.kind]}
                  </span>
                </div>

                <span className="font-quran text-lg leading-relaxed text-[var(--color-ink)]" dir="rtl">
                  {row.hafsText}
                </span>

                <span className="text-[12px] text-[var(--color-ink-soft)]">
                  {row.kind === 'farsh' ? row.readingText ?? '—' : row.categoryNameAr ?? row.categoryCode ?? '—'}
                </span>

                {row.narrators.length ? (
                  <div className="flex flex-wrap gap-1">
                    {row.narrators.map((narrator, index) => {
                      const catalog = narrators.get(narrator.id)
                      const isSecondaryWajh = narrator.wajhOrder >= 2
                      return (
                        <span
                          key={`${narrator.id}-${index}`}
                          title={narrator.wajhNote ?? undefined}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold',
                            isSecondaryWajh && 'border-dashed'
                          )}
                          style={
                            catalog?.color
                              ? { borderColor: catalog.color, color: catalog.color }
                              : { borderColor: 'var(--color-border)', color: 'var(--color-ink-soft)' }
                          }
                        >
                          {catalog?.color ? (
                            <span
                              aria-hidden="true"
                              className="size-1.5 rounded-full"
                              style={{ background: catalog.color }}
                            />
                          ) : null}
                          {narrator.nameAr}
                          {isSecondaryWajh ? <span aria-hidden="true">٢</span> : null}
                        </span>
                      )
                    })}
                  </div>
                ) : null}

                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={statusBadgeStyle(row.reviewStatus)}
                  >
                    {STATUS_LABEL_AR[row.reviewStatus]}
                  </span>
                  {openFlags > 0 ? (
                    <span className="rounded-full bg-[var(--color-danger-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-danger)]">
                      {openFlags} بلاغ مفتوح
                    </span>
                  ) : null}
                  {row.deleted ? (
                    <span className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-ink-muted)]">
                      محذوف
                    </span>
                  ) : null}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
