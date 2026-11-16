import assert from 'node:assert/strict'
import test, { describe, it } from 'node:test'
import {
  MemorizationStatus,
  createBlankRecord,
  makeAyahKey,
  toNormalizedIsoString,
  epochMs,
  type AyahKey,
  type AyahMemorizationRecord,
  type ChangeEvent,
} from '../../packages/memorization-core/types'
import { QuranIndex } from '../../packages/memorization-core/quranIndex'
import {
  getHistoryRecordsAsOf,
  computePeriodGains,
  computeProgressSampleDates,
  computeProgressSeries,
  computeMemorizationSnapshot,
  type ProgressRange,
} from '../../packages/memorization-core/statistics'

describe('MemorizationHistoryTests', () => {
  const index = QuranIndex.loadDefault()
  const base = 1_790_000_000_000

  const at = (seconds: number): string => toNormalizedIsoString(base + seconds * 1000)
  const key = (surah: number, ayah: number): AyahKey => makeAyahKey(surah, ayah)

  const record = (
    k: AyahKey,
    status: MemorizationStatus,
    updated: string | number | Date,
  ): AyahMemorizationRecord => {
    const r = createBlankRecord(k, updated)
    r.status = status
    return r
  }

  const makeEvent = (
    k: AyahKey,
    oldStatus: MemorizationStatus | null,
    newStatus: MemorizationStatus,
    time: string | number | Date,
  ): ChangeEvent => {
    const timeMs = epochMs(time)
    return {
      batchID: '123e4567-e89b-12d3-a456-426614174000',
      surah: k.surah,
      ayah: k.ayah,
      at: toNormalizedIsoString(timeMs),
      before:
        oldStatus !== null
          ? record(k, oldStatus, toNormalizedIsoString(timeMs - 1000))
          : null,
      after: record(k, newStatus, toNormalizedIsoString(timeMs)),
    }
  }

  // MARK: - Rollback

  it('rollbackRestoresPriorRows', () => {
    const k = key(1, 1)
    const current = { '1:1': record(k, MemorizationStatus.mastered, at(20)) }
    const events = [
      makeEvent(k, MemorizationStatus.needsMushaf, MemorizationStatus.mastered, at(20)),
    ]

    assert.equal(
      getHistoryRecordsAsOf(at(10), current, events)['1:1']?.status,
      MemorizationStatus.needsMushaf,
    )
    assert.equal(
      getHistoryRecordsAsOf(at(30), current, events)['1:1']?.status,
      MemorizationStatus.mastered,
    )
    assert.equal(
      getHistoryRecordsAsOf(at(20), current, events)['1:1']?.status,
      MemorizationStatus.mastered,
    )
  })

  it('removesRecordCreatedAfterDate', () => {
    const k = key(1, 1)
    const current = { '1:1': record(k, MemorizationStatus.mastered, at(20)) }
    const events = [makeEvent(k, null, MemorizationStatus.mastered, at(20))]

    assert.equal(getHistoryRecordsAsOf(at(10), current, events)['1:1'], undefined)
  })

  it('earliestLaterEventWins', () => {
    const k = key(1, 1)
    const current = { '1:1': record(k, MemorizationStatus.mastered, at(30)) }
    const events = [
      makeEvent(k, MemorizationStatus.needsMushaf, MemorizationStatus.memorizedWithErrors, at(20)),
      makeEvent(k, MemorizationStatus.memorizedWithErrors, MemorizationStatus.mastered, at(30)),
    ]

    assert.equal(
      getHistoryRecordsAsOf(at(10), current, events)['1:1']?.status,
      MemorizationStatus.needsMushaf,
    )
    assert.equal(
      getHistoryRecordsAsOf(at(25), current, events)['1:1']?.status,
      MemorizationStatus.memorizedWithErrors,
    )
  })

  it('twoEventsSameTimestampKeepInputOrder', () => {
    const k = key(1, 1)
    const current = { '1:1': record(k, MemorizationStatus.mastered, at(20)) }
    const events = [
      makeEvent(k, MemorizationStatus.needsMushaf, MemorizationStatus.memorizedWithErrors, at(20)),
      makeEvent(k, MemorizationStatus.memorizedWithErrors, MemorizationStatus.mastered, at(20)),
    ]

    assert.equal(
      getHistoryRecordsAsOf(at(10), current, events)['1:1']?.status,
      MemorizationStatus.needsMushaf,
    )
  })

  it('deviceClockBackwardsEventsStillRollBack', () => {
    const k = key(1, 1)
    const current = { '1:1': record(k, MemorizationStatus.mastered, at(30)) }
    const ascending = [
      makeEvent(k, MemorizationStatus.needsMushaf, MemorizationStatus.memorizedWithErrors, at(20)),
      makeEvent(k, MemorizationStatus.memorizedWithErrors, MemorizationStatus.mastered, at(30)),
    ]
    const descending = [...ascending].reverse()

    assert.deepEqual(
      getHistoryRecordsAsOf(at(10), current, descending),
      getHistoryRecordsAsOf(at(10), current, ascending),
    )
  })

  // MARK: - Gains

  it('gainsAreNet', () => {
    const k = key(1, 1)
    const events = [
      makeEvent(k, MemorizationStatus.notMemorized, MemorizationStatus.mastered, at(20)),
      makeEvent(k, MemorizationStatus.mastered, MemorizationStatus.notMemorized, at(30)),
    ]
    const gains = computePeriodGains(at(10), at(40), {}, events, index)
    assert.equal(gains.newAyat, 0)
    assert.equal(gains.pageEquivalents, 0)
  })

  it('gainsCountNewAyatAndPageEquivalents', () => {
    const keys = index.ayat(50)
    const current: Record<string, AyahMemorizationRecord> = {}
    const events: ChangeEvent[] = []

    for (const k of keys) {
      current[`${k.surah}:${k.ayah}`] = record(k, MemorizationStatus.mastered, at(20))
      events.push(makeEvent(k, null, MemorizationStatus.mastered, at(20)))
    }

    const gains = computePeriodGains(at(10), at(30), current, events, index)
    assert.equal(gains.newAyat, keys.length)
    assert.ok(Math.abs(gains.pageEquivalents - 1.0) < 1e-9)
  })

  it('gainsCountSurahsCompletedInPeriod', () => {
    const fatiha = index.ayatOfSurah(1)
    const current: Record<string, AyahMemorizationRecord> = {}
    const events: ChangeEvent[] = []

    for (const k of fatiha) {
      current[`${k.surah}:${k.ayah}`] = record(k, MemorizationStatus.mastered, at(20))
      events.push(makeEvent(k, null, MemorizationStatus.mastered, at(20)))
    }

    assert.equal(
      computePeriodGains(at(10), at(30), current, events, index).surahsCompleted,
      1,
    )
    assert.equal(
      computePeriodGains(at(25), at(30), current, events, index).surahsCompleted,
      0,
    )
  })

  it('errorsToMasteredIsNotANewAyah', () => {
    const k = key(1, 1)
    const current = { '1:1': record(k, MemorizationStatus.mastered, at(20)) }
    const events = [
      makeEvent(k, MemorizationStatus.memorizedWithErrors, MemorizationStatus.mastered, at(20)),
    ]
    assert.equal(computePeriodGains(at(10), at(30), current, events, index).newAyat, 0)
  })

  it('needsMushafToErrorsIsANewAyah', () => {
    const k = key(1, 1)
    const current = { '1:1': record(k, MemorizationStatus.memorizedWithErrors, at(20)) }
    const events = [
      makeEvent(k, MemorizationStatus.needsMushaf, MemorizationStatus.memorizedWithErrors, at(20)),
    ]
    assert.equal(computePeriodGains(at(10), at(30), current, events, index).newAyat, 1)
  })

  // MARK: - Sample dates

  it('sampleDatesShapes', () => {
    const testNow = 1_790_000_000_123

    const dates = (range: ProgressRange, first?: string | null): string[] =>
      computeProgressSampleDates(range, testNow, first)

    assert.equal(dates('days7').length, 7)
    assert.equal(dates('days30').length, 30)
    assert.equal(dates('months3').length, 13)
    assert.equal(dates('months6').length, 26)
    assert.equal(dates('year').length, 12)

    for (const range of ['days7', 'days30', 'months3', 'months6', 'year'] as const) {
      const list = dates(range)
      assert.deepEqual(list, [...list].sort())
      assert.equal(list[list.length - 1], toNormalizedIsoString(testNow))
    }

    const fiveMonthsAgo = new Date(testNow)
    fiveMonthsAgo.setUTCMonth(fiveMonthsAgo.getUTCMonth() - 5)
    assert.equal(dates('all', toNormalizedIsoString(fiveMonthsAgo)).length, 6)
    assert.deepEqual(dates('all', null), [toNormalizedIsoString(testNow)])
  })

  // MARK: - Series

  it('seriesEqualsRecomputation', () => {
    const nowMs = 1_790_000_000_000
    const dayMs = 86_400 * 1000
    const keys = [1, 2, 3, 4, 5, 6].map((a) => key(2, a))
    const current: Record<string, AyahMemorizationRecord> = {}
    const events: ChangeEvent[] = []
    const state: Record<string, MemorizationStatus> = {}

    const script: [number, number, MemorizationStatus][] = [
      [1, 0, MemorizationStatus.needsMushaf],
      [2, 1, MemorizationStatus.mastered],
      [3, 2, MemorizationStatus.memorizedWithErrors],
      [4, 0, MemorizationStatus.mastered],
      [5, 3, MemorizationStatus.mastered],
      [6, 1, MemorizationStatus.needsMushaf],
      [7, 4, MemorizationStatus.mastered],
      [8, 5, MemorizationStatus.memorizedWithErrors],
      [9, 2, MemorizationStatus.notMemorized],
      [10, 0, MemorizationStatus.mastered],
      [11, 1, MemorizationStatus.memorizedWithErrors],
      [12, 3, MemorizationStatus.needsMushaf],
      [13, 4, MemorizationStatus.notMemorized],
      [14, 5, MemorizationStatus.mastered],
      [15, 0, MemorizationStatus.mastered],
      [16, 2, MemorizationStatus.mastered],
      [17, 3, MemorizationStatus.mastered],
      [18, 1, MemorizationStatus.notMemorized],
      [19, 4, MemorizationStatus.mastered],
      [20, 5, MemorizationStatus.notMemorized],
    ]

    for (const [daysAgo, keyIndex, status] of script) {
      const k = keys[keyIndex]
      const timeMs = nowMs - (21 - daysAgo) * dayMs
      const kStr = `${k.surah}:${k.ayah}`
      events.push({
        batchID: '123e4567-e89b-12d3-a456-426614174000',
        surah: k.surah,
        ayah: k.ayah,
        at: toNormalizedIsoString(timeMs),
        before: state[kStr] !== undefined ? record(k, state[kStr], timeMs) : null,
        after: record(k, status, timeMs),
      })
      state[kStr] = status
    }

    for (const [kStr, status] of Object.entries(state)) {
      const [s, a] = kStr.split(':').map(Number)
      current[kStr] = record(key(s, a), status, nowMs)
    }

    const points = computeProgressSeries('days30', nowMs, current, events, index)
    assert.equal(points.length, 30)

    for (const point of points) {
      const past = computeMemorizationSnapshot(
        getHistoryRecordsAsOf(point.date, current, events),
        index,
      )
      assert.ok(Math.abs(point.strictPercent - past.strictPercent) < 1e-9)
      assert.ok(Math.abs(point.learningPercent - past.learningPercent) < 1e-9)
    }
    assert.ok(points.some((p) => p.strictPercent > 0))
  })

  it('seriesOnEmptyHistoryIsFlatZero', () => {
    for (const range of ['days7', 'days30', 'months3', 'months6', 'year', 'all'] as const) {
      const points = computeProgressSeries(range, at(0), {}, [], index)
      assert.ok(points.length > 0)
      assert.ok(
        points.every((p) => p.strictPercent === 0 && p.learningPercent === 0),
      )
    }
  })

  it('seriesWithOnlyCurrentStateIsFlat', () => {
    const keys = index.ayahKeys.slice(0, 10)
    const current: Record<string, AyahMemorizationRecord> = {}
    for (const k of keys) {
      current[`${k.surah}:${k.ayah}`] = record(k, MemorizationStatus.mastered, at(0))
    }
    const points = computeProgressSeries('days7', at(0), current, [], index)
    const expected = (10.0 / 6236.0) * 100
    assert.ok(
      points.every(
        (p) =>
          Math.abs(p.strictPercent - expected) < 1e-9 &&
          Math.abs(p.learningPercent - expected) < 1e-9,
      ),
    )
  })

  it('seriesIgnoresRecordsOutsideTheIndex', () => {
    const stray = key(200, 1)
    const current = { '200:1': record(stray, MemorizationStatus.mastered, at(0)) }
    const points = computeProgressSeries('days7', at(0), current, [], index)
    assert.ok(points.every((p) => p.strictPercent === 0))
  })
})
