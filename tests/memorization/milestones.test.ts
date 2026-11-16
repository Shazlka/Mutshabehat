import assert from 'node:assert/strict'
import test, { describe, it } from 'node:test'
import {
  MemorizationStatus,
  createBlankRecord,
  type AyahKey,
  type AyahMemorizationRecord,
} from '../../packages/memorization-core/types'
import { QuranIndex } from '../../packages/memorization-core/quranIndex'
import {
  computeMemorizationSnapshot,
  type MemorizationSnapshot,
} from '../../packages/memorization-core/statistics'
import {
  computeMilestones,
  type Milestone,
} from '../../packages/memorization-core/planner'
import { createMemorizationPolicy } from '../../packages/memorization-core/policy'

describe('MemorizationMilestoneTests', () => {
  const index = QuranIndex.loadDefault()
  const now = new Date(1_790_000_000 * 1000)

  const snapshot = (masteredKeys: readonly AyahKey[]): MemorizationSnapshot => {
    const records: Record<string, AyahMemorizationRecord> = {}
    for (const key of masteredKeys) {
      const r = createBlankRecord(key, now)
      r.status = MemorizationStatus.mastered
      records[`${key.surah}:${key.ayah}`] = r
    }
    return computeMemorizationSnapshot(records, index)
  }

  it('surahCompletionFiresOnce', () => {
    const fatiha = index.ayatOfSurah(1)
    const before = snapshot([])
    const after = snapshot(fatiha)
    assert.deepEqual(computeMilestones(before, after), [
      { type: 'surahCompleted', surah: 1 },
    ])
    assert.deepEqual(computeMilestones(after, after), [])
  })

  it('partialSurahFiresNothing', () => {
    const before = snapshot([])
    const after = snapshot(index.ayatOfSurah(1).slice(0, 6))
    assert.deepEqual(computeMilestones(before, after), [])
  })

  it('juzCompletionAlsoReportsItsSurahs', () => {
    const before = snapshot([])
    const after = snapshot(index.ayatOfJuz(30))
    const milestones = computeMilestones(before, after)

    assert.ok(milestones.some((m) => m.type === 'juzCompleted' && m.juz === 30))
    assert.ok(milestones.some((m) => m.type === 'surahCompleted' && m.surah === 78))
    assert.ok(milestones.some((m) => m.type === 'surahCompleted' && m.surah === 114))

    const surahs = milestones
      .filter((m): m is { type: 'surahCompleted'; surah: number } => m.type === 'surahCompleted')
      .map((m) => m.surah)
    assert.deepEqual(surahs, [...surahs].sort((a, b) => a - b))

    const juzIndex = milestones.findIndex((m) => m.type === 'juzCompleted' && m.juz === 30)
    const surah114Index = milestones.findIndex((m) => m.type === 'surahCompleted' && m.surah === 114)
    assert.ok(surah114Index < juzIndex)
  })

  it('percentMilestonesAtThresholds', () => {
    const keys = index.ayahKeys
    const before = snapshot(keys.slice(0, 1558)) // 24.98%
    const after = snapshot(keys.slice(0, 1559)) // 25.0%
    const milestones = computeMilestones(before, after)

    assert.ok(milestones.some((m) => m.type === 'percent' && m.percent === 25))
    assert.ok(!milestones.some((m) => m.type === 'percent' && m.percent === 50))
    assert.deepEqual(computeMilestones(after, after), [])
  })

  it('crossingSeveralThresholdsReportsEachInOrder', () => {
    const keys = index.ayahKeys
    const milestones = computeMilestones(snapshot([]), snapshot(keys.slice(0, 3200)))
    const percents = milestones
      .filter((m): m is { type: 'percent'; percent: number } => m.type === 'percent')
      .map((m) => m.percent)
    assert.deepEqual(percents, [25, 50])
  })

  it('wholeQuranGivesQuranCompletedAndNoPercentHundred', () => {
    const keys = index.ayahKeys
    const before = snapshot(keys.slice(0, keys.length - 1))
    const after = snapshot(keys)
    const milestones = computeMilestones(before, after)

    assert.ok(milestones.some((m) => m.type === 'quranCompleted'))
    assert.ok(!milestones.some((m) => m.type === 'percent' && m.percent === 100))
    assert.deepEqual(milestones[milestones.length - 1], { type: 'quranCompleted' })
  })

  it('downgradeFiresNothing', () => {
    const before = snapshot(index.ayatOfSurah(1))
    const after = snapshot([])
    assert.deepEqual(computeMilestones(before, after), [])
  })

  it('customPolicyThresholdsAreUsed', () => {
    const policy = createMemorizationPolicy({
      milestonePercents: [10, 100],
    })
    const keys = index.ayahKeys
    const milestones = computeMilestones(
      snapshot([]),
      snapshot(keys.slice(0, 700)),
      policy,
    )
    assert.ok(milestones.some((m) => m.type === 'percent' && m.percent === 10))
    assert.ok(!milestones.some((m) => m.type === 'percent' && m.percent === 25))
  })
})
