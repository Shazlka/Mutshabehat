import {
  type AyahChange,
  type AyahKey,
  type AyahMemorizationRecord,
  type BatchKind,
  type BatchPlan,
  type BatchRecord,
  ayahKeyString,
  createBlankRecord,
  MemorizationStatus,
  ReviewResult,
  toNormalizedIsoString,
} from './types'
import {
  type MemorizationPolicy,
  STANDARD_MEMORIZATION_POLICY,
} from './policy'
import type { QuranIndex } from './quranIndex'
import {
  type MemorizationSelection,
  getScopeJSON,
  isWholeSurahSelection,
  resolveSelection,
} from './selection'
import { applyReview } from './reviewEngine'
import type { MemorizationSnapshot } from './statistics'

export type { AyahChange, BatchPlan }

export interface PlanUpdateOptions {
  readonly selection: MemorizationSelection
  readonly label: string
  readonly status: MemorizationStatus
  readonly learning?: boolean | null
  readonly records: Record<string, AyahMemorizationRecord> | Map<string, AyahMemorizationRecord>
  readonly index: QuranIndex
  readonly now: Date | string | number
  readonly policy?: MemorizationPolicy
}

export interface PlanReviewOptions {
  readonly selection: MemorizationSelection
  readonly label: string
  readonly result: ReviewResult
  readonly records: Record<string, AyahMemorizationRecord> | Map<string, AyahMemorizationRecord>
  readonly index: QuranIndex
  readonly now: Date | string | number
  readonly policy?: MemorizationPolicy
}

function isMemorized(status: MemorizationStatus): boolean {
  return status === MemorizationStatus.mastered || status === MemorizationStatus.memorizedWithErrors
}

function lookupRecord(
  records: Record<string, AyahMemorizationRecord> | Map<string, AyahMemorizationRecord>,
  key: AyahKey,
): AyahMemorizationRecord | undefined {
  const kStr = ayahKeyString(key)
  if (records instanceof Map) {
    return records.get(kStr)
  }
  return records[kStr]
}

/**
 * Plans setting `status` (and optionally the "currently learning" flag) on every selected ayah.
 * Ayat that already have exactly that state are dropped from `changes`.
 * Becoming mastered clears the learning flag unless `learning` is explicitly true;
 * `learning === undefined || learning === null` otherwise leaves it alone.
 */
export function planUpdate(options: PlanUpdateOptions): BatchPlan
export function planUpdate(
  selection: MemorizationSelection,
  label: string,
  status: MemorizationStatus,
  learning: boolean | null | undefined,
  records: Record<string, AyahMemorizationRecord> | Map<string, AyahMemorizationRecord>,
  index: QuranIndex,
  now: Date | string | number,
  policy?: MemorizationPolicy,
): BatchPlan
export function planUpdate(
  optionsOrSelection: PlanUpdateOptions | MemorizationSelection,
  label?: string,
  status?: MemorizationStatus,
  learning?: boolean | null,
  records?: Record<string, AyahMemorizationRecord> | Map<string, AyahMemorizationRecord>,
  index?: QuranIndex,
  now?: Date | string | number,
  policy?: MemorizationPolicy,
): BatchPlan {
  let opts: PlanUpdateOptions
  if ('selection' in optionsOrSelection) {
    opts = optionsOrSelection
  } else {
    opts = {
      selection: optionsOrSelection,
      label: label!,
      status: status!,
      learning,
      records: records!,
      index: index!,
      now: now!,
      policy,
    }
  }

  const isoNow = toNormalizedIsoString(opts.now)
  const keys = resolveSelection(opts.selection, opts.index)
  const changes: AyahChange[] = []
  let gain = 0
  let improved = false

  for (const key of keys) {
    const current = lookupRecord(opts.records, key)
    const base: AyahMemorizationRecord = current
      ? { ...current }
      : createBlankRecord(key, isoNow)

    const statusChanges = base.status !== opts.status
    let newLearning = base.isCurrentlyLearning
    if (opts.learning !== undefined && opts.learning !== null) {
      newLearning = opts.learning
    } else if (statusChanges && opts.status === MemorizationStatus.mastered) {
      newLearning = false
    }

    if (!statusChanges && newLearning === base.isCurrentlyLearning) {
      continue
    }

    const after: AyahMemorizationRecord = {
      ...base,
      status: opts.status,
      isCurrentlyLearning: newLearning,
      updatedAt: isoNow,
    }

    if (statusChanges) {
      after.lastStatusChangedAt = isoNow
      if (isMemorized(opts.status) && !after.firstMemorizedAt) {
        after.firstMemorizedAt = isoNow
      }
      if (isMemorized(opts.status) && opts.status < base.status) {
        improved = true
      }
      if (isMemorized(opts.status) && !isMemorized(base.status)) {
        gain += 1
      }
    }

    changes.push({
      key,
      before: current ? { ...current } : null,
      after,
    })
  }

  return {
    kind: 'update',
    label: opts.label,
    scopeJSON: getScopeJSON(opts.selection),
    selectionCount: keys.length,
    changes,
    countsForStreak: improved,
    gainAyahs: gain,
    unchangedCount: keys.length - changes.length,
  }
}

/**
 * Plans a review result for every selected ayah that is at least started.
 * Ayat with no record or that are not memorized at all are left out of `changes`.
 */
export function planReview(options: PlanReviewOptions): BatchPlan
export function planReview(
  selection: MemorizationSelection,
  label: string,
  result: ReviewResult,
  records: Record<string, AyahMemorizationRecord> | Map<string, AyahMemorizationRecord>,
  index: QuranIndex,
  now: Date | string | number,
  policy?: MemorizationPolicy,
): BatchPlan
export function planReview(
  optionsOrSelection: PlanReviewOptions | MemorizationSelection,
  label?: string,
  result?: ReviewResult,
  records?: Record<string, AyahMemorizationRecord> | Map<string, AyahMemorizationRecord>,
  index?: QuranIndex,
  now?: Date | string | number,
  policy: MemorizationPolicy = STANDARD_MEMORIZATION_POLICY,
): BatchPlan {
  let opts: PlanReviewOptions
  if ('selection' in optionsOrSelection) {
    opts = optionsOrSelection
  } else {
    opts = {
      selection: optionsOrSelection,
      label: label!,
      result: result!,
      records: records!,
      index: index!,
      now: now!,
      policy,
    }
  }

  const appliedPolicy = opts.policy ?? STANDARD_MEMORIZATION_POLICY
  const isoNow = toNormalizedIsoString(opts.now)
  const keys = resolveSelection(opts.selection, opts.index)
  const changes: AyahChange[] = []

  for (const key of keys) {
    const current = lookupRecord(opts.records, key)
    if (!current || current.status === MemorizationStatus.notMemorized) {
      continue
    }
    const after = applyReview(opts.result, current, isoNow, appliedPolicy)
    changes.push({
      key,
      before: { ...current },
      after,
    })
  }

  return {
    kind: 'review',
    label: opts.label,
    scopeJSON: getScopeJSON(opts.selection),
    selectionCount: keys.length,
    changes,
    countsForStreak: changes.length > 0,
    gainAyahs: 0,
    unchangedCount: keys.length - changes.length,
  }
}

/**
 * A whole surah, or more ayat than the policy threshold, must be confirmed before it is applied.
 */
export function needsConfirmation(
  selection: MemorizationSelection,
  plan: BatchPlan,
  index: QuranIndex,
  policy: MemorizationPolicy = STANDARD_MEMORIZATION_POLICY,
): boolean {
  return isWholeSurahSelection(selection, index) || plan.selectionCount > policy.confirmationAyahThreshold
}

export type Milestone =
  | { readonly type: 'surahCompleted'; readonly surah: number }
  | { readonly type: 'juzCompleted'; readonly juz: number }
  | { readonly type: 'percent'; readonly percent: number }
  | { readonly type: 'quranCompleted' }

/**
 * What the change from `before` to `after` crossed:
 * surahs and juz that became fully mastered, strict percentage thresholds below 100,
 * and quranCompleted at 100.
 */
export function computeMilestones(
  before: MemorizationSnapshot,
  after: MemorizationSnapshot,
  policy: MemorizationPolicy = STANDARD_MEMORIZATION_POLICY,
): Milestone[] {
  const result: Milestone[] = []

  const surahsBefore = new Map<number, string>()
  for (const s of before.surahs) {
    surahsBefore.set(s.surah, s.state)
  }
  for (const s of after.surahs) {
    if (s.state === 'complete' && surahsBefore.get(s.surah) !== 'complete') {
      result.push({ type: 'surahCompleted', surah: s.surah })
    }
  }

  const juzBefore = new Map<number, boolean>()
  for (const j of before.juz) {
    juzBefore.set(j.juz, j.isComplete)
  }
  for (const j of after.juz) {
    if (j.isComplete && !juzBefore.get(j.juz)) {
      result.push({ type: 'juzCompleted', juz: j.juz })
    }
  }

  const epsilon = 1e-9
  const sortedPercents = [...policy.milestonePercents].sort((a, b) => a - b)
  for (const p of sortedPercents) {
    if (p < 100) {
      const threshold = p
      if (before.strictPercent < threshold - epsilon && after.strictPercent >= threshold - epsilon) {
        result.push({ type: 'percent', percent: p })
      }
    }
  }

  const beforeComplete =
    before.totalAyahs > 0 && (before.counts[MemorizationStatus.mastered] ?? 0) === before.totalAyahs
  const afterComplete =
    after.totalAyahs > 0 && (after.counts[MemorizationStatus.mastered] ?? 0) === after.totalAyahs

  if (afterComplete && !beforeComplete) {
    result.push({ type: 'quranCompleted' })
  }

  return result
}

/**
 * Applies a plan's changes to an in-memory record store.
 */
export function applyPlanToRecords(
  plan: BatchPlan,
  records: Map<string, AyahMemorizationRecord> | Record<string, AyahMemorizationRecord>,
): void {
  for (const change of plan.changes) {
    const kStr = ayahKeyString(change.key)
    if (records instanceof Map) {
      records.set(kStr, { ...change.after })
    } else {
      records[kStr] = { ...change.after }
    }
  }
}

/**
 * Reverts changes from an undo batch.
 */
export function applyUndoToRecords(
  changes: readonly AyahChange[],
  records: Map<string, AyahMemorizationRecord> | Record<string, AyahMemorizationRecord>,
): void {
  for (const change of changes) {
    const kStr = ayahKeyString(change.key)
    if (change.before === null) {
      if (records instanceof Map) {
        records.delete(kStr)
      } else {
        delete records[kStr]
      }
    } else {
      if (records instanceof Map) {
        records.set(kStr, { ...change.before })
      } else {
        records[kStr] = { ...change.before }
      }
    }
  }
}

/**
 * Returns a new records map with the plan's changes applied.
 */
export function applyBatchPlan(
  records: Record<string, AyahMemorizationRecord>,
  plan: BatchPlan,
): Record<string, AyahMemorizationRecord> {
  const next: Record<string, AyahMemorizationRecord> = { ...records }
  applyPlanToRecords(plan, next)
  return next
}

/**
 * Returns a new records map with the plan's changes undone.
 */
export function undoBatchPlan(
  records: Record<string, AyahMemorizationRecord>,
  plan: BatchPlan,
): Record<string, AyahMemorizationRecord> {
  const next: Record<string, AyahMemorizationRecord> = { ...records }
  applyUndoToRecords(plan.changes, next)
  return next
}
