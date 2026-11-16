import {
  type AyahKey,
  type AyahMemorizationRecord,
  epochMs,
  makeAyahKey,
  MemorizationStatus,
  ReviewResult,
  ReviewStrength,
  toNormalizedIsoString,
} from './types'
import {
  type MemorizationPolicy,
  STANDARD_MEMORIZATION_POLICY,
} from './policy'
import type { QuranIndex } from './quranIndex'

const MS_PER_DAY = 86_400_000

function isMemorized(status: MemorizationStatus): boolean {
  return status === MemorizationStatus.mastered || status === MemorizationStatus.memorizedWithErrors
}

function overdueDays(record: AyahMemorizationRecord, now: Date | string | number): number {
  const referenceIso =
    record.nextReviewAt ?? record.firstMemorizedAt ?? record.lastStatusChangedAt ?? record.updatedAt
  const nowMs = epochMs(now)
  const refMs = epochMs(referenceIso)
  return Math.max(0, (nowMs - refMs) / MS_PER_DAY)
}

/**
 * Records one review. The stored strength becomes the result, the counters and the next due date
 * follow the policy's interval ladder, and the memorization status never changes.
 */
export function applyReview(
  result: ReviewResult,
  record: AyahMemorizationRecord,
  now: Date | string | number,
  policy: MemorizationPolicy = STANDARD_MEMORIZATION_POLICY,
): AyahMemorizationRecord {
  const msNow = epochMs(now)
  const isoNow = toNormalizedIsoString(msNow)
  const updated: AyahMemorizationRecord = {
    ...record,
    reviewCount: record.reviewCount + 1,
    lastReviewedAt: isoNow,
    updatedAt: isoNow,
  }

  let intervalDays: number
  switch (result) {
    case ReviewResult.excellent:
    case ReviewResult.good: {
      updated.successfulReviewCount += 1
      updated.consecutiveSuccessfulReviews += 1
      const ladder = policy.intervalLadderDays
      const idx = Math.min(updated.consecutiveSuccessfulReviews, ladder.length) - 1
      intervalDays = ladder.length === 0 ? 1 : ladder[Math.max(0, idx)]
      updated.reviewStrength = result === ReviewResult.excellent ? ReviewStrength.strong : ReviewStrength.good
      break
    }
    case ReviewResult.mistakes: {
      updated.consecutiveSuccessfulReviews = 0
      updated.errorCount += 1
      intervalDays = policy.mistakesIntervalDays
      updated.reviewStrength = ReviewStrength.needsReview
      break
    }
    case ReviewResult.forgot: {
      updated.consecutiveSuccessfulReviews = 0
      updated.errorCount += 1
      intervalDays = policy.forgotIntervalDays
      updated.reviewStrength = ReviewStrength.weak
      break
    }
  }

  updated.nextReviewAt = toNormalizedIsoString(msNow + intervalDays * MS_PER_DAY)
  return updated
}

/**
 * The strength to show: a memorized ayah that is past its due date is at most "needs review", and
 * well past it (more than twice its last interval) "weak", even though its status stays the same.
 */
export function getDisplayedStrength(
  record: AyahMemorizationRecord,
  now: Date | string | number,
): ReviewStrength {
  if (!isMemorized(record.status)) {
    return record.reviewStrength
  }
  if (!record.lastReviewedAt) {
    return ReviewStrength.notReviewed
  }
  if (!record.nextReviewAt) {
    return record.reviewStrength
  }

  const nowMs = epochMs(now)
  const dueMs = epochMs(record.nextReviewAt)
  if (nowMs <= dueMs) {
    return record.reviewStrength
  }

  const lastReviewedMs = epochMs(record.lastReviewedAt)
  const intervalSec = Math.max((dueMs - lastReviewedMs) / 1000, 86400)
  const overdueSec = (nowMs - dueMs) / 1000

  if (overdueSec > 2 * intervalSec) {
    return ReviewStrength.weak
  }

  return record.reviewStrength < ReviewStrength.needsReview
    ? ReviewStrength.needsReview
    : record.reviewStrength
}

/**
 * A memorized ayah is due when it has never been scheduled or its next review date has come.
 */
export function isAyahDue(record: AyahMemorizationRecord, now: Date | string | number): boolean {
  if (!isMemorized(record.status)) {
    return false
  }
  if (!record.nextReviewAt) {
    return true
  }
  return epochMs(record.nextReviewAt) <= epochMs(now)
}

function normalizeRecordsIterable(
  records: Iterable<AyahMemorizationRecord> | Record<string, AyahMemorizationRecord> | Map<string, AyahMemorizationRecord>,
): AyahMemorizationRecord[] {
  if (records instanceof Map) {
    return Array.from(records.values())
  }
  if (Symbol.iterator in records) {
    return Array.from(records as Iterable<AyahMemorizationRecord>)
  }
  return Object.values(records)
}

/**
 * Which memorized ayat are due for review, sorted by surah and ayah.
 */
export function getDueAyat(
  records: Iterable<AyahMemorizationRecord> | Record<string, AyahMemorizationRecord> | Map<string, AyahMemorizationRecord>,
  now: Date | string | number,
): AyahKey[] {
  const list = normalizeRecordsIterable(records)
  return list
    .filter((r) => isAyahDue(r, now))
    .map((r) => makeAyahKey(r.surah, r.ayah))
    .sort((a, b) => (a.surah !== b.surah ? a.surah - b.surah : a.ayah - b.ayah))
}

export interface SurahDue {
  readonly surah: number
  readonly dueCount: number
  readonly averageOverdueDays: number
}

/**
 * Which surahs are the most overdue for review, limited to `limit`.
 */
export function getMostOverdueSurahs(
  records: Iterable<AyahMemorizationRecord> | Record<string, AyahMemorizationRecord> | Map<string, AyahMemorizationRecord>,
  now: Date | string | number,
  limit: number,
): SurahDue[] {
  const list = normalizeRecordsIterable(records)
  const due = list.filter((r) => isAyahDue(r, now))
  const grouped = new Map<number, AyahMemorizationRecord[]>()

  for (const r of due) {
    let items = grouped.get(r.surah)
    if (!items) {
      items = []
      grouped.set(r.surah, items)
    }
    items.push(r)
  }

  const rows: SurahDue[] = []
  for (const [surah, items] of grouped.entries()) {
    const totalDays = items.reduce((acc, r) => acc + overdueDays(r, now), 0)
    rows.push({
      surah,
      dueCount: items.length,
      averageOverdueDays: totalDays / items.length,
    })
  }

  rows.sort((lhs, rhs) => {
    if (lhs.averageOverdueDays !== rhs.averageOverdueDays) {
      return rhs.averageOverdueDays - lhs.averageOverdueDays
    }
    return lhs.surah - rhs.surah
  })

  return rows.slice(0, Math.max(0, limit))
}

export type Suggestion =
  | { readonly type: 'continueLearning'; readonly surah: number; readonly remaining: number }
  | { readonly type: 'review'; readonly surah: number; readonly daysSinceReview?: number }

/**
 * What to do next from local data only:
 * finish the range being learned, else review the memorized surah that is most overdue, else null.
 */
export function getSuggestion(
  records: Iterable<AyahMemorizationRecord> | Record<string, AyahMemorizationRecord> | Map<string, AyahMemorizationRecord>,
  _index: QuranIndex,
  now: Date | string | number,
): Suggestion | null {
  const list = normalizeRecordsIterable(records)

  // 1. Learning priority
  const learningBySurah = new Map<number, number>()
  for (const r of list) {
    if (r.isCurrentlyLearning && r.status !== MemorizationStatus.mastered) {
      learningBySurah.set(r.surah, (learningBySurah.get(r.surah) ?? 0) + 1)
    }
  }

  if (learningBySurah.size > 0) {
    const minSurah = Math.min(...Array.from(learningBySurah.keys()))
    return {
      type: 'continueLearning',
      surah: minSurah,
      remaining: learningBySurah.get(minSurah) ?? 0,
    }
  }

  // 2. Overdue review priority
  const bySurah = new Map<number, AyahMemorizationRecord[]>()
  for (const r of list) {
    let items = bySurah.get(r.surah)
    if (!items) {
      items = []
      bySurah.set(r.surah, items)
    }
    items.push(r)
  }

  let best: { surah: number; overdue: number } | null = null
  for (const [surah, surahRecords] of bySurah.entries()) {
    const due = surahRecords.filter((r) => isAyahDue(r, now))
    if (due.length === 0) continue
    const overdue = due.reduce((acc, r) => acc + overdueDays(r, now), 0) / due.length
    if (!best) {
      best = { surah, overdue }
    } else if (overdue > best.overdue || (overdue === best.overdue && surah < best.surah)) {
      best = { surah, overdue }
    }
  }

  if (!best) return null

  const surahRecords = bySurah.get(best.surah) ?? []
  const lastReviewedDates = surahRecords
    .map((r) => r.lastReviewedAt)
    .filter((d): d is string => Boolean(d))
    .map((d) => epochMs(d))

  let daysSinceReview: number | undefined
  if (lastReviewedDates.length > 0) {
    const maxLastReviewed = Math.max(...lastReviewedDates)
    daysSinceReview = Math.floor((epochMs(now) - maxLastReviewed) / MS_PER_DAY)
  }

  return {
    type: 'review',
    surah: best.surah,
    daysSinceReview,
  }
}
