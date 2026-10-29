// Shared status → color/label lookup for the review screen. Reuses the app's existing
// warn/success/danger design tokens (globals.css) — no new palette.

import type { CSSProperties } from 'react'
import type { ReviewRow, ReviewStatus } from '../_lib/types'

export type ApprovalKind = 'manual' | 'auto' | 'none'

export function approvalKind(
  row: { reviewStatus?: string | null; reviewSource?: string | null } | null | undefined
): ApprovalKind {
  if (!row || row.reviewStatus !== 'reviewed') return 'none'
  return row.reviewSource ? 'auto' : 'manual'
}

export type StatusFilter = 'all' | 'manual' | 'auto' | 'needs-review' | ReviewStatus | 'deleted'
export type KindFilter = 'all' | 'farsh' | 'usul'

// Shared between review workstation (renders the filtered list) and ReviewApp (keyboard navigation
// needs the exact same order/membership shown).
export function filterReviewRows(
  rows: ReviewRow[],
  statusFilter: StatusFilter,
  kindFilter: KindFilter,
  // Only meaningful with kindFilter === 'usul': keep one أصول category (its code).
  categoryFilter: string | null = null
): ReviewRow[] {
  return rows.filter((row) => {
    if (statusFilter === 'deleted') return row.deleted
    if (row.deleted) return false
    if (kindFilter !== 'all' && row.kind !== kindFilter) return false
    if (kindFilter === 'usul' && categoryFilter && row.categoryCode !== categoryFilter) return false
    if (statusFilter === 'all') return true
    if (statusFilter === 'manual') return approvalKind(row) === 'manual'
    if (statusFilter === 'auto') return approvalKind(row) === 'auto'
    if (statusFilter === 'needs-review') return row.reviewStatus === 'unreviewed' || row.reviewStatus === 'flagged'
    return row.reviewStatus === statusFilter
  })
}

export type UsulCategoryOption = { code: string; nameAr: string; count: number }

// The أصول categories present on a page (for the sub-filter), with how many live rows each has
// under the current status filter. `keep` is always listed, even at zero, so a category chosen on
// another page stays visible -- and clearable -- here.
export function usulCategoriesOnPage(
  rows: ReviewRow[],
  statusFilter: StatusFilter,
  keep: string | null = null
): UsulCategoryOption[] {
  const byCode = new Map<string, UsulCategoryOption>()
  for (const row of filterReviewRows(rows, statusFilter, 'usul')) {
    if (!row.categoryCode) continue
    const entry = byCode.get(row.categoryCode)
    if (entry) entry.count += 1
    else byCode.set(row.categoryCode, { code: row.categoryCode, nameAr: row.categoryNameAr ?? row.categoryCode, count: 1 })
  }
  if (keep && !byCode.has(keep)) {
    const named = rows.find((row) => row.categoryCode === keep)
    byCode.set(keep, { code: keep, nameAr: named?.categoryNameAr ?? keep, count: 0 })
  }
  return [...byCode.values()].sort((a, b) => b.count - a.count || a.nameAr.localeCompare(b.nameAr, 'ar'))
}

export const STATUS_LABEL_AR: Record<ReviewStatus, string> = {
  unreviewed: 'غير مراجَع',
  reviewed: 'مُراجَع',
  flagged: 'معلَّم',
}

export const STATUS_COLOR_VAR: Record<ReviewStatus, string> = {
  unreviewed: '--color-ink-muted',
  reviewed: '--color-success',
  flagged: '--color-danger',
}

export const STATUS_BG_VAR: Record<ReviewStatus, string> = {
  unreviewed: '--color-surface-2',
  reviewed: '--color-success-bg',
  flagged: '--color-danger-bg',
}

export function statusBadgeStyle(status: ReviewStatus): CSSProperties {
  return {
    color: `var(${STATUS_COLOR_VAR[status]})`,
    background: `var(${STATUS_BG_VAR[status]})`,
  }
}

export const KIND_LABEL_AR: Record<'farsh' | 'usul', string> = {
  farsh: 'فرش',
  usul: 'أصول',
}

// Worst-first precedence for a word covered by more than one row.
export function worstStatus(statuses: ReviewStatus[]): ReviewStatus | null {
  if (!statuses.length) return null
  if (statuses.includes('flagged')) return 'flagged'
  if (statuses.includes('unreviewed')) return 'unreviewed'
  return 'reviewed'
}

export function formatPosition(surah: number, ayah: number, word: number): string {
  return `${surah}:${ayah}:${word}`
}

export function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ar', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
  } catch {
    return iso
  }
}
