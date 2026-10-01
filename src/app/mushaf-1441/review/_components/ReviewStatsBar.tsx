'use client'

import { useMemo } from 'react'
import type { ReviewOverview } from '../_lib/types'

type PageStats = { total: number; reviewed: number; unreviewed: number; flagged: number }

type Props = {
  pageStats: PageStats
  overview: ReviewOverview | null
}

function pct(reviewed: number, total: number): string {
  if (total <= 0) return '0%'
  return `${Math.round((reviewed / total) * 100)}%`
}

// Compact verified/remaining stats strip rendered below the Mushaf pane in the review editor
// (owner request: "for the current page and for the whole mushaf"). `pageStats` comes straight
// off `ReviewPage.stats`; the whole-mushaf totals are summed client-side from `overview.pages`
// (`ReviewOverview`, already fetched for the review-nav's next-flagged/next-unreviewed jump) --
// no new API call.
export default function ReviewStatsBar({ pageStats, overview }: Props) {
  const wholeMushaf = useMemo(() => {
    if (!overview) return null
    let total = 0
    let reviewed = 0
    for (const p of overview.pages) {
      total += p.total
      reviewed += p.reviewed
    }
    return { total, reviewed, remaining: total - reviewed }
  }, [overview])

  return (
    <div
      dir="rtl"
      className="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[11px] sm:text-[11px] font-bold text-[var(--color-ink-muted)]"
    >
      <span className="inline-flex items-center gap-1">
        <span className="text-[var(--color-ink)]">هذه الصفحة:</span>
        <span className="text-[var(--color-success)]">
          معتمد {pageStats.reviewed} من {pageStats.total}
        </span>
        <span>(متبقٍ {pageStats.total - pageStats.reviewed})</span>
        <span className="text-[var(--color-ink-muted)]">· {pct(pageStats.reviewed, pageStats.total)}</span>
      </span>

      <span className="inline-flex items-center gap-1">
        <span className="text-[var(--color-ink)]">كل المصحف:</span>
        {wholeMushaf ? (
          <>
            <span className="text-[var(--color-success)]">
              معتمد {wholeMushaf.reviewed} من {wholeMushaf.total}
            </span>
            <span>(متبقٍ {wholeMushaf.remaining})</span>
            <span className="text-[var(--color-ink-muted)]">· {pct(wholeMushaf.reviewed, wholeMushaf.total)}</span>
          </>
        ) : (
          <span>جارٍ حساب إحصاء المصحف…</span>
        )}
      </span>
    </div>
  )
}
