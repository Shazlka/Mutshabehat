import assert from 'node:assert/strict'
import test, { describe, it } from 'node:test'
import {
  MemorizationStatus,
  createBlankRecord,
  makeAyahKey,
  toNormalizedIsoString,
  type AyahKey,
  type AyahMemorizationRecord,
  type ChangeEvent,
} from '../../packages/memorization-core/types'
import { QuranIndex } from '../../packages/memorization-core/quranIndex'
import {
  computeMemorizationSnapshot,
  computeGoalProgress,
  type GoalProgress,
} from '../../packages/memorization-core/statistics'
import type { GoalDefinition, GoalKind } from '../../packages/memorization-core/backup'
import { loadDefaultQuranIndex } from '../../packages/memorization-core/quranIndexNode'

describe('MemorizationGoalsTests', () => {
  const index = loadDefaultQuranIndex()

  const date = (day: number, hour: number): string => {
    const d = new Date(Date.UTC(2026, 9, day, hour)) // Month is 0-indexed: 9 = October
    return toNormalizedIsoString(d)
  }

  const now = date(7, 12) // Wednesday Oct 7, 2026; the week began on Sunday Oct 4

  const record = (k: AyahKey, status: MemorizationStatus): AyahMemorizationRecord => {
    const r = createBlankRecord(k, now)
    r.status = status
    return r
  }

  const world = (
    masteredKeys: readonly AyahKey[],
    time: string | null = null,
  ): {
    records: Record<string, AyahMemorizationRecord>
    events: ChangeEvent[]
  } => {
    const recordsMap: Record<string, AyahMemorizationRecord> = {}
    const eventsList: ChangeEvent[] = []

    for (const k of masteredKeys) {
      const after = record(k, MemorizationStatus.mastered)
      recordsMap[`${k.surah}:${k.ayah}`] = after
      if (time) {
        eventsList.push({
          batchID: '123e4567-e89b-12d3-a456-426614174000',
          surah: k.surah,
          ayah: k.ayah,
          at: time,
          before: null,
          after,
        })
      }
    }

    return { records: recordsMap, events: eventsList }
  }

  const progress = (
    kind: GoalKind,
    recordsMap: Record<string, AyahMemorizationRecord>,
    eventsList: ChangeEvent[],
  ): GoalProgress => {
    const goal: GoalDefinition = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      kind,
      createdAt: now,
    }
    const snapshot = computeMemorizationSnapshot(recordsMap, index)
    return computeGoalProgress(
      goal,
      snapshot,
      recordsMap,
      eventsList,
      index,
      now,
      0, // Sunday first day of week
    )
  }

  it('ayatPerDayFraction', () => {
    const keys = index.ayatOfSurah(2).slice(0, 4)
    const w = world(keys, date(7, 9)) // 4 ayat today
    const result = progress({ type: 'ayatPerDay', count: 10 }, w.records, w.events)
    assert.ok(Math.abs(result.fraction - 0.4) < 1e-9)
    assert.equal(result.remainingAyat, 6)
    assert.equal(result.isReached, false)
  })

  it('ayatPerDayIgnoresYesterdayAndIsCappedWhenReached', () => {
    const keys = index.ayatOfSurah(2).slice(0, 12)
    const yesterday = world(keys, date(6, 20))
    assert.equal(
      progress({ type: 'ayatPerDay', count: 10 }, yesterday.records, yesterday.events).fraction,
      0,
    )

    const today = world(keys, date(7, 8))
    const reached = progress({ type: 'ayatPerDay', count: 10 }, today.records, today.events)
    assert.equal(reached.fraction, 1)
    assert.equal(reached.isReached, true)
    assert.equal(reached.remainingAyat, 0)
  })

  it('weeklyPageEquivalents', () => {
    const keys = index.ayat(50)
    const w = world(keys, date(6, 12)) // Tuesday: inside this week
    const result = progress(
      { type: 'pageEquivalentsPerWeek', target: 4 },
      w.records,
      w.events,
    )
    assert.ok(Math.abs(result.fraction - 0.25) < 1e-9)
    assert.ok(Math.abs(result.remainingPageEquivalents - 3) < 1e-9)

    const lastWeek = world(keys, date(3, 12)) // Saturday: before week began
    assert.equal(
      progress(
        { type: 'pageEquivalentsPerWeek', target: 4 },
        lastWeek.records,
        lastWeek.events,
      ).fraction,
      0,
    )
  })

  it('completeSurahProgress', () => {
    const fatiha = index.ayatOfSurah(1)
    const w = world(fatiha.slice(0, 3))
    const result = progress({ type: 'completeSurah', surah: 1 }, w.records, w.events)
    assert.ok(Math.abs(result.fraction - 3.0 / 7.0) < 1e-9)
    assert.equal(result.remainingAyat, 4)
    assert.ok(result.remainingPageEquivalents > 0 && result.remainingPageEquivalents < 1)
    assert.equal(result.isReached, false)

    const all = world(fatiha)
    assert.equal(
      progress({ type: 'completeSurah', surah: 1 }, all.records, all.events).isReached,
      true,
    )
  })

  it('completeJuzReached', () => {
    const w = world(index.ayatOfJuz(30))
    const result = progress({ type: 'completeJuz', juz: 30 }, w.records, w.events)
    assert.equal(result.isReached, true)
    assert.equal(result.fraction, 1)
    assert.equal(result.remainingAyat, 0)
    assert.equal(progress({ type: 'completeJuz', juz: 30 }, {}, []).fraction, 0)
  })

  it('completeQuranByDateRemainingDays', () => {
    const w = world(index.ayahKeys.slice(0, 3118)) // exactly half
    const future = progress(
      { type: 'completeQuranBy', date: date(17, 12) },
      w.records,
      w.events,
    )
    assert.ok(Math.abs(future.fraction - 0.5) < 1e-9)
    assert.equal(future.remainingDays, 10)
    assert.equal(future.remainingAyat, 6236 - 3118)
    assert.ok(future.remainingPageEquivalents > 0)

    const past = progress(
      { type: 'completeQuranBy', date: date(1, 12) },
      w.records,
      w.events,
    )
    assert.equal(past.remainingDays, 0)
    assert.equal(past.isReached, false)
  })

  it('completeQuranReachedWhenEverythingIsMastered', () => {
    const w = world(index.ayahKeys)
    const result = progress(
      { type: 'completeQuranBy', date: date(17, 12) },
      w.records,
      w.events,
    )
    assert.equal(result.isReached, true)
    assert.equal(result.fraction, 1)
    assert.ok(Math.abs(result.remainingPageEquivalents) < 1e-6)
  })

  it('unknownSurahAndJuzAreEmptyGoals', () => {
    const result = progress({ type: 'completeSurah', surah: 500 }, {}, [])
    assert.equal(result.fraction, 0)
    assert.equal(result.isReached, false)
    assert.equal(progress({ type: 'completeJuz', juz: 99 }, {}, []).fraction, 0)
  })
})
