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
export function filterReviewRows(rows: ReviewRow[], statusFilter: StatusFilter, kindFilter: KindFilter): ReviewRow[] {
  return rows.filter((row) => {
    if (statusFilter === 'deleted') return row.deleted
    if (row.deleted) return false
    if (kindFilter !== 'all' && row.kind !== kindFilter) return false
    if (statusFilter === 'all') return true
    if (statusFilter === 'manual') return approvalKind(row) === 'manual'
    if (statusFilter === 'auto') return approvalKind(row) === 'auto'
    if (statusFilter === 'needs-review') return row.reviewStatus === 'unreviewed' || row.reviewStatus === 'flagged'
    return row.reviewStatus === statusFilter
  })
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
