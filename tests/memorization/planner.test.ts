import assert from 'node:assert/strict'
import test, { describe, it } from 'node:test'
import {
  MemorizationStatus,
  createBlankRecord,
  makeAyahKey,
  toNormalizedIsoString,
  type AyahKey,
  type AyahMemorizationRecord,
  type AyahChange,
  type BatchPlan,
} from '../../packages/memorization-core/types'
import { QuranIndex } from '../../packages/memorization-core/quranIndex'
import {
  planUpdate,
  needsConfirmation,
  applyBatchPlan,
  undoBatchPlan,
} from '../../packages/memorization-core/planner'
import {
  makeSurahSelection,
  makeAyahRangeSelection,
  makePageRangeSelection,
  makeJuzSelection,
  makeSpanSelection,
  type MemorizationSelection,
} from '../../packages/memorization-core/selection'
import { loadDefaultQuranIndex } from '../../packages/memorization-core/quranIndexNode'

describe('MemorizationPlannerTests', () => {
  const index = loadDefaultQuranIndex()
  const now = new Date(1_790_000_000 * 1000)

  const key = (surah: number, ayah: number): AyahKey => makeAyahKey(surah, ayah)

  const record = (
    k: AyahKey,
    status: MemorizationStatus,
    learning = false,
    first: string | null = null,
  ): AyahMemorizationRecord => {
    const r = createBlankRecord(k, now.getTime() - 1000 * 1000)
    r.status = status
    r.isCurrentlyLearning = learning
    r.firstMemorizedAt = first
    return r
  }

  const plan = (
    selection: MemorizationSelection,
    status: MemorizationStatus,
    learning: boolean | null = null,
    records: Record<string, AyahMemorizationRecord> = {},
  ): BatchPlan => {
    return planUpdate({
      selection,
      label: 'test',
      status,
      learning,
      records,
      index,
      now,
    })
  }

  it('plansOnlyChangedAyat', () => {
    const records: Record<string, AyahMemorizationRecord> = {}
    for (let ayah = 1; ayah <= 2; ayah += 1) {
      const k = key(1, ayah)
      records[`1:${ayah}`] = record(k, MemorizationStatus.mastered)
    }
    const result = plan(makeSurahSelection(1), MemorizationStatus.mastered, null, records)
    assert.equal(result.selectionCount, 7)
    assert.equal(result.changes.length, 5)
    assert.equal(result.unchangedCount, 2)
    assert.equal(result.kind, 'update')
    assert.equal(result.label, 'test')
    assert.ok(
      result.changes.every(
        (c: AyahChange) => c.after.status === MemorizationStatus.mastered && c.before === null,
      ),
    )
  })

  it('sameStatusIsNoOpEvenWithLearningNil', () => {
    const k = key(1, 1)
    const records = { '1:1': record(k, MemorizationStatus.mastered, true) }
    const result = plan(
      makeAyahRangeSelection(1, 1, 1),
      MemorizationStatus.mastered,
      null,
      records,
    )
    assert.equal(result.changes.length, 0)
    assert.equal(result.unchangedCount, 1)
  })

  it('notMemorizedOnUntouchedAyahCreatesNoRow', () => {
    const result = plan(makeSurahSelection(1), MemorizationStatus.notMemorized)
    assert.equal(result.changes.length, 0)
  })

  it('firstMemorizedAtIsSetOnceAndKept', () => {
    const k = key(2, 5)
    const withErrors = plan(
      makeAyahRangeSelection(2, 5, 5),
      MemorizationStatus.memorizedWithErrors,
    ).changes[0].after
    assert.equal(withErrors.firstMemorizedAt, toNormalizedIsoString(now))

    const records: Record<string, AyahMemorizationRecord> = { '2:5': withErrors }
    const later = new Date(now.getTime() + 500 * 1000)
    const mastered = planUpdate({
      selection: makeAyahRangeSelection(2, 5, 5),
      label: 't',
      status: MemorizationStatus.mastered,
      learning: null,
      records,
      index,
      now: later,
    }).changes[0].after
    assert.equal(mastered.firstMemorizedAt, toNormalizedIsoString(now))
    assert.equal(mastered.lastStatusChangedAt, toNormalizedIsoString(later))

    records['2:5'] = mastered
    const down = planUpdate({
      selection: makeAyahRangeSelection(2, 5, 5),
      label: 't',
      status: MemorizationStatus.notMemorized,
      learning: null,
      records,
      index,
      now: new Date(later.getTime() + 500 * 1000),
    }).changes[0].after
    assert.equal(down.firstMemorizedAt, toNormalizedIsoString(now))
    assert.equal(down.status, MemorizationStatus.notMemorized)
  })

  it('needsMushafDoesNotSetFirstMemorized', () => {
    const after = plan(
      makeAyahRangeSelection(2, 5, 5),
      MemorizationStatus.needsMushaf,
    ).changes[0].after
    assert.equal(after.firstMemorizedAt, null)
    assert.equal(after.lastStatusChangedAt, toNormalizedIsoString(now))
  })

  it('masteredClearsLearningFlag', () => {
    const k = key(36, 1)
    const records = { '36:1': record(k, MemorizationStatus.needsMushaf, true) }
    const after = plan(
      makeAyahRangeSelection(36, 1, 1),
      MemorizationStatus.mastered,
      null,
      records,
    ).changes[0].after
    assert.equal(after.isCurrentlyLearning, false)
  })

  it('explicitLearningTrueKeepsItAndNilLeavesOtherStatusesAlone', () => {
    const k = key(36, 1)
    const records = { '36:1': record(k, MemorizationStatus.needsMushaf, true) }
    const kept = plan(
      makeAyahRangeSelection(36, 1, 1),
      MemorizationStatus.mastered,
      true,
      records,
    ).changes[0].after
    assert.equal(kept.isCurrentlyLearning, true)

    const untouched = plan(
      makeAyahRangeSelection(36, 1, 1),
      MemorizationStatus.memorizedWithErrors,
      null,
      records,
    ).changes[0].after
    assert.equal(untouched.isCurrentlyLearning, true)
  })

  it('learningOnlyChangeIsNotANoOp', () => {
    const k = key(36, 1)
    const records = { '36:1': record(k, MemorizationStatus.needsMushaf) }
    const result = plan(
      makeAyahRangeSelection(36, 1, 1),
      MemorizationStatus.needsMushaf,
      true,
      records,
    )
    assert.equal(result.changes.length, 1)
    assert.equal(result.changes[0].after.isCurrentlyLearning, true)
    assert.equal(result.changes[0].after.lastStatusChangedAt, null)
    assert.equal(result.countsForStreak, false)
  })

  it('downgradeDoesNotCountForStreakOrGain', () => {
    const k = key(1, 1)
    const records = { '1:1': record(k, MemorizationStatus.mastered) }
    const result = plan(
      makeAyahRangeSelection(1, 1, 1),
      MemorizationStatus.needsMushaf,
      null,
      records,
    )
    assert.equal(result.countsForStreak, false)
    assert.equal(result.gainAyahs, 0)
  })

  it('upgradeCountsForStreakAndGain', () => {
    const result = plan(makeSurahSelection(1), MemorizationStatus.mastered)
    assert.equal(result.countsForStreak, true)
    assert.equal(result.gainAyahs, 7)
  })

  it('errorsToMasteredCountsForStreakButIsNotANewAyah', () => {
    const k = key(1, 1)
    const records = { '1:1': record(k, MemorizationStatus.memorizedWithErrors) }
    const result = plan(
      makeAyahRangeSelection(1, 1, 1),
      MemorizationStatus.mastered,
      null,
      records,
    )
    assert.equal(result.countsForStreak, true)
    assert.equal(result.gainAyahs, 0)
  })

  it('needsMushafIsNotAnUpgradeIntoMemorized', () => {
    const result = plan(makeSurahSelection(1), MemorizationStatus.needsMushaf)
    assert.equal(result.countsForStreak, false)
    assert.equal(result.gainAyahs, 0)
    assert.equal(result.changes.length, 7)
  })

  it('confirmationRule', () => {
    const needs = (selection: MemorizationSelection): boolean => {
      const p = plan(selection, MemorizationStatus.mastered)
      return needsConfirmation(selection, p, index)
    }
    assert.equal(needs(makeSurahSelection(36)), true)
    assert.equal(needs(makeSurahSelection(1)), true)
    assert.equal(needs(makeAyahRangeSelection(2, 1, 30)), false)
    assert.equal(needs(makeAyahRangeSelection(2, 1, 31)), true)
    assert.equal(needs(makeAyahRangeSelection(2, 1, 5)), false)
  })

  it('scopeJSONDescribesTheSelection', () => {
    assert.ok(plan(makeSurahSelection(36), MemorizationStatus.mastered).scopeJSON.includes('surah'))
    assert.ok(
      plan(
        makePageRangeSelection(582, 589),
        MemorizationStatus.mastered,
      ).scopeJSON.includes('582'),
    )
    assert.ok(plan(makeJuzSelection(30), MemorizationStatus.mastered).scopeJSON.includes('30'))
    assert.ok(plan(makeSurahSelection(36), MemorizationStatus.mastered).scopeJSON.length > 0)
  })

  it('nowIsNormalizedToMilliseconds', () => {
    const precise = 1_790_000_000.1234567 * 1000
    const after = planUpdate({
      selection: makeSurahSelection(1),
      label: 't',
      status: MemorizationStatus.mastered,
      learning: null,
      records: {},
      index,
      now: precise,
    }).changes[0].after
    assert.equal(after.updatedAt, toNormalizedIsoString(1_790_000_000_123))
  })

  it('wholeQuranPlanReturnsEveryAyah', () => {
    const result = plan(
      makeSpanSelection(index.ayahKeys[0], index.ayahKeys[index.ayahKeys.length - 1]),
      MemorizationStatus.mastered,
    )
    assert.equal(result.changes.length, 6236)
    assert.equal(result.gainAyahs, 6236)
  })

  it('applyBatchPlanAndUndoBatchPlanRoundTrip', () => {
    const initialRecords: Record<string, AyahMemorizationRecord> = {
      '1:1': record(key(1, 1), MemorizationStatus.needsMushaf),
    }
    const batchPlan = planUpdate({
      selection: makeAyahRangeSelection(1, 1, 2),
      label: 'test',
      status: MemorizationStatus.mastered,
      learning: null,
      records: initialRecords,
      index,
      now,
    })

    const applied = applyBatchPlan(initialRecords, batchPlan)
    assert.equal(applied['1:1'].status, MemorizationStatus.mastered)
    assert.equal(applied['1:2'].status, MemorizationStatus.mastered)

    const undone = undoBatchPlan(applied, batchPlan)
    assert.equal(undone['1:1'].status, MemorizationStatus.needsMushaf)
    assert.equal(undone['1:2'], undefined) // 1:2 didn't exist before, so it's removed!
  })
})
