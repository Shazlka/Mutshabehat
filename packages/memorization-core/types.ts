/**
 * Pure domain types and constants for Quran memorization (Hafs).
 * Framework-free, zero dependencies, deterministic.
 */

export const MUSHAF_PAGE_COUNT = 604
export const MUSHAF_LINES_PER_PAGE = 15
export const TOTAL_QURAN_AYAHS = 6236

/**
 * Coordinate of one ayah in the Quran.
 */
export interface AyahKey {
  readonly surah: number
  readonly ayah: number
}

export function makeAyahKey(surah: number, ayah: number): AyahKey {
  return { surah, ayah }
}

/**
 * Parses "2:255" into an AyahKey. Returns null for invalid inputs.
 */
export function parseAyahKey(text: string): AyahKey | null {
  const parts = text.trim().split(':')
  if (parts.length !== 2) return null
  const surah = Number.parseInt(parts[0], 10)
  const ayah = Number.parseInt(parts[1], 10)
  if (Number.isNaN(surah) || Number.isNaN(ayah) || surah < 1 || surah > 114 || ayah < 1) {
    return null
  }
  return { surah, ayah }
}

export function ayahKeyString(key: AyahKey): string {
  return `${key.surah}:${key.ayah}`
}

export function ayahKeysEqual(a: AyahKey, b: AyahKey): boolean {
  return a.surah === b.surah && a.ayah === b.ayah
}

export function compareAyahKeys(a: AyahKey, b: AyahKey): number {
  if (a.surah !== b.surah) return a.surah - b.surah
  return a.ayah - b.ayah
}

/**
 * How well one ayah is memorized (Hafs only).
 * Raw numeric values match the iOS enum and are persisted.
 */
export enum MemorizationStatus {
  mastered = 1,
  memorizedWithErrors = 2,
  needsMushaf = 3,
  notMemorized = 4,
}

export const ALL_MEMORIZATION_STATUSES: readonly MemorizationStatus[] = [
  MemorizationStatus.mastered,
  MemorizationStatus.memorizedWithErrors,
  MemorizationStatus.needsMushaf,
  MemorizationStatus.notMemorized,
]

/**
 * The result of the last review of an ayah.
 * Raw numeric values match the iOS enum.
 */
export enum ReviewStrength {
  strong = 1,
  good = 2,
  needsReview = 3,
  weak = 4,
  notReviewed = 5,
}

export const ALL_REVIEW_STRENGTHS: readonly ReviewStrength[] = [
  ReviewStrength.strong,
  ReviewStrength.good,
  ReviewStrength.needsReview,
  ReviewStrength.weak,
  ReviewStrength.notReviewed,
]

/**
 * What the person reports after reciting an ayah or a range from memory.
 */
export enum ReviewResult {
  excellent = 1,
  good = 2,
  mistakes = 3,
  forgot = 4,
}

export const ALL_REVIEW_RESULTS: readonly ReviewResult[] = [
  ReviewResult.excellent,
  ReviewResult.good,
  ReviewResult.mistakes,
  ReviewResult.forgot,
]

/**
 * Normalizes any valid date input into an ISO-8601 string with millisecond precision
 * and a trailing Z, e.g. "2026-10-05T10:00:00.123Z".
 */
export function toNormalizedIsoString(date: Date | string | number): string {
  let ms: number
  if (date instanceof Date) {
    ms = date.getTime()
  } else if (typeof date === 'number') {
    ms = Math.floor(date)
  } else {
    ms = new Date(date).getTime()
  }
  return new Date(ms).toISOString()
}

export function epochMs(date: Date | string | number): number {
  if (date instanceof Date) return date.getTime()
  if (typeof date === 'number') return Math.floor(date)
  return new Date(date).getTime()
}

/**
 * One ayah's memorization state.
 */
export interface AyahMemorizationRecord {
  surah: number
  ayah: number
  status: MemorizationStatus
  reviewStrength: ReviewStrength
  isCurrentlyLearning: boolean
  firstMemorizedAt?: string | null
  lastStatusChangedAt?: string | null
  lastReviewedAt?: string | null
  nextReviewAt?: string | null
  reviewCount: number
  successfulReviewCount: number
  consecutiveSuccessfulReviews: number
  errorCount: number
  updatedAt: string
}

export function createBlankRecord(key: AyahKey, now: Date | string | number): AyahMemorizationRecord {
  return {
    surah: key.surah,
    ayah: key.ayah,
    status: MemorizationStatus.notMemorized,
    reviewStrength: ReviewStrength.notReviewed,
    isCurrentlyLearning: false,
    firstMemorizedAt: null,
    lastStatusChangedAt: null,
    lastReviewedAt: null,
    nextReviewAt: null,
    reviewCount: 0,
    successfulReviewCount: 0,
    consecutiveSuccessfulReviews: 0,
    errorCount: 0,
    updatedAt: toNormalizedIsoString(now),
  }
}

export type BatchKind = 'update' | 'review' | 'undo' | 'import'

/**
 * One user action (an update, a review, an undo or an import) that changed one or more ayat.
 */
export interface BatchRecord {
  id: string
  createdAt: string
  kind: BatchKind
  label: string
  scopeJSON: string
  ayahCount: number
  deviceID: string
  countsForStreak: boolean
  gainAyahs: number
  undoneAt?: string | null
  undoesBatchID?: string | null
}

/**
 * One ayah changed by one batch, with the full row before (null when it had none) and after.
 */
export interface ChangeEvent {
  batchID: string
  surah: number
  ayah: number
  at: string
  before: AyahMemorizationRecord | null
  after: AyahMemorizationRecord
}

/**
 * One ayah that a batch changes: the stored row before (null when it had none) and the row after.
 */
export interface AyahChange {
  readonly key: AyahKey
  readonly before: AyahMemorizationRecord | null
  readonly after: AyahMemorizationRecord
}

/**
 * Exactly what an update or review will change, computed before anything is written.
 */
export interface BatchPlan {
  readonly kind: BatchKind
  readonly label: string
  readonly scopeJSON: string
  readonly selectionCount: number
  readonly changes: readonly AyahChange[]
  readonly countsForStreak: boolean
  readonly gainAyahs: number
  readonly unchangedCount: number
}

