import assert from 'node:assert/strict'
import test, { describe, it } from 'node:test'
import {
  MemorizationStatus,
  ReviewStrength,
  createBlankRecord,
  makeAyahKey,
  toNormalizedIsoString,
  type AyahKey,
  type AyahMemorizationRecord,
  type ChangeEvent,
} from '../../packages/memorization-core/types'
import { QuranIndex, type AyahLayoutRow } from '../../packages/memorization-core/quranIndex'
import {
  computeMemorizationSnapshot,
  computePageProgress,
  computeAyahRuns,
  querySurahList,
  queryAyahListKeys,
  getDominantTransition,
  type SurahProgress,
  type SurahListItem,
} from '../../packages/memorization-core/statistics'
import { createMemorizationPolicy } from '../../packages/memorization-core/policy'

describe('MemorizationStatisticsTests', () => {
  const index = QuranIndex.loadDefault()
  const now = new Date(1_790_000_000 * 1000)

  const records = (
    keys: readonly AyahKey[],
    status: MemorizationStatus,
  ): Record<string, AyahMemorizationRecord> => {
    const map: Record<string, AyahMemorizationRecord> = {}
    for (const key of keys) {
      const r = createBlankRecord(key, 0)
      r.status = status
      map[`${key.surah}:${key.ayah}`] = r
    }
    return map
  }

  it('emptyRecordsGiveZeroEverywhere', () => {
    const result = computeMemorizationSnapshot({}, index)
    assert.equal(result.totalAyahs, 6236)
    assert.equal(result.strictPercent, 0)
    assert.equal(result.learningPercent, 0)
    assert.ok(!Number.isNaN(result.strictPercent) && !Number.isNaN(result.learningPercent))
    assert.equal(result.counts[MemorizationStatus.notMemorized], 6236)
    assert.equal(Object.keys(result.counts).length, 4)
    assert.equal(result.surahs.length, 114)
    assert.ok(result.surahs.every((s) => s.state === 'none'))
    assert.equal(result.completedJuz, 0)
    assert.equal(result.canReciteCount, 0)
    assert.equal(result.completedSurahs, 0)
    assert.equal(result.partialSurahs, 0)
    assert.equal(result.completeIncludingErrorsSurahs, 0)
    assert.equal(result.pagesFullyMastered, 0)
    assert.equal(result.pageEquivalentMastered, 0)
  })

  it('fatihaMasteredIsOneCompleteSurah', () => {
    const input = records(index.ayatOfSurah(1), MemorizationStatus.mastered)
    const result = computeMemorizationSnapshot(input, index)
    assert.equal(result.completedSurahs, 1)
    assert.equal(result.surahs[0].strictPercent, 100)
    assert.equal(result.counts[MemorizationStatus.mastered], 7)
    assert.ok(Math.abs(result.strictPercent - (7.0 / 6236) * 100) < 1e-9)
  })

  it('oneErrorBreaksCompleteButNotIncludingErrors', () => {
    const input = records(index.ayatOfSurah(1), MemorizationStatus.mastered)
    input['1:7'].status = MemorizationStatus.memorizedWithErrors
    const result = computeMemorizationSnapshot(input, index)
    const surah = result.surahs[0]
    assert.equal(surah.state, 'partial')
    assert.equal(surah.isCompleteIncludingErrors, true)
    assert.equal(result.completedSurahs, 0)
    assert.equal(result.completeIncludingErrorsSurahs, 1)
    assert.equal(result.partialSurahs, 1)
    assert.ok(Math.abs(surah.strictPercent - (6.0 / 7) * 100) < 1e-9)
    assert.ok(Math.abs(surah.learningPercent - (6.75 / 7) * 100) < 1e-9)
  })

  it('weightedPercentUsesPolicy', () => {
    const input = records(index.ayatOfSurah(1), MemorizationStatus.notMemorized)
    input['1:1'].status = MemorizationStatus.mastered
    input['1:2'].status = MemorizationStatus.memorizedWithErrors
    input['1:3'].status = MemorizationStatus.needsMushaf

    const standard = computeMemorizationSnapshot(input, index)
    assert.ok(Math.abs(standard.surahs[0].learningPercent - (2.15 / 7) * 100) < 1e-9)

    const customPolicy = createMemorizationPolicy({
      statusWeights: {
        [MemorizationStatus.mastered]: 1,
        [MemorizationStatus.memorizedWithErrors]: 0.5,
        [MemorizationStatus.needsMushaf]: 0.1,
        [MemorizationStatus.notMemorized]: 0,
      },
    })
    const custom = computeMemorizationSnapshot(input, index, customPolicy)
    assert.ok(Math.abs(custom.surahs[0].learningPercent - (1.6 / 7) * 100) < 1e-9)
    assert.ok(Math.abs(custom.learningPercent - (1.6 / 6236) * 100) < 1e-9)
  })

  it('canReciteCountsMasteredAndErrors', () => {
    const input = records(index.ayatOfSurah(1), MemorizationStatus.needsMushaf)
    input['1:1'].status = MemorizationStatus.mastered
    input['1:2'].status = MemorizationStatus.memorizedWithErrors
    assert.equal(computeMemorizationSnapshot(input, index).canReciteCount, 2)
  })

  it('wholeJuzThirtyIsComplete', () => {
    const result = computeMemorizationSnapshot(
      records(index.ayatOfJuz(30), MemorizationStatus.mastered),
      index,
    )
    assert.equal(result.completedJuz, 1)
    const juz = result.juz.find((j) => j.juz === 30)
    assert.ok(juz !== undefined)
    assert.equal(juz.isComplete, true)
    assert.equal(juz.strictPercent, 100)
    assert.equal(juz.learningPercent, 100)
    assert.deepEqual(
      result.juz.map((j) => j.juz),
      Array.from({ length: 30 }, (_, i) => i + 1),
    )
  })

  it('weakestLinkStates', () => {
    const keys = index.ayat(50)
    const input = records(keys, MemorizationStatus.mastered)
    assert.equal(
      computePageProgress(50, input, index).state,
      MemorizationStatus.mastered,
    )

    const statuses = [
      MemorizationStatus.memorizedWithErrors,
      MemorizationStatus.needsMushaf,
      MemorizationStatus.notMemorized,
    ]
    for (let offset = 0; offset < statuses.length; offset += 1) {
      input[`${keys[offset].surah}:${keys[offset].ayah}`].status = statuses[offset]
      assert.equal(computePageProgress(50, input, index).state, statuses[offset])
    }

    assert.equal(
      computePageProgress(50, {}, index).state,
      MemorizationStatus.notMemorized,
    )
  })

  it('mixFractionsSumToOneAndMatchWeights', () => {
    const keys = index.ayat(50)
    const mastered = keys.slice(0, Math.floor(keys.length / 2))
    const mix = computePageProgress(
      50,
      records(mastered, MemorizationStatus.mastered),
      index,
    ).mix

    assert.equal(Object.keys(mix.counts).length, 4)
    assert.equal(Object.keys(mix.fractions).length, 4)
    assert.equal(mix.ayahCount, keys.length)
    assert.equal(mix.masteredAyahs, mastered.length)
    assert.equal(
      mix.counts[MemorizationStatus.notMemorized],
      keys.length - mastered.length,
    )

    const sumFractions = Object.values(mix.fractions).reduce((acc, f) => acc + f, 0)
    assert.ok(Math.abs(sumFractions - 1.0) < 1e-9)

    const expectedWeight = mastered.reduce((sum, k) => sum + index.weight(k), 0)
    assert.ok(Math.abs(mix.fractions[MemorizationStatus.mastered] - expectedWeight) < 1e-9)
  })

  it('pagesFullyMasteredAgreesWithStates', () => {
    const keys = index.ayahKeys.filter((_, idx) => idx % 3 === 0)
    const input = records(keys, MemorizationStatus.mastered)
    const page1to10 = index.ayatInPages(1, 10)
    for (const k of page1to10) {
      input[`${k.surah}:${k.ayah}`] = {
        ...createBlankRecord(k, 0),
        status: MemorizationStatus.mastered,
      }
    }

    const result = computeMemorizationSnapshot(input, index)
    assert.equal(
      result.pagesFullyMastered,
      result.pages.filter((p) => p.state === MemorizationStatus.mastered).length,
    )
    assert.equal(result.pages.length, 604)
    assert.deepEqual(
      result.pages.map((p) => p.page),
      Array.from({ length: 604 }, (_, i) => i + 1),
    )
    for (const p of result.pages) {
      assert.deepEqual(p, computePageProgress(p.page, input, index))
    }
  })

  it('pageEquivalentOfWholeQuranIs604', () => {
    const input = records(index.ayahKeys, MemorizationStatus.mastered)
    const result = computeMemorizationSnapshot(input, index)
    assert.ok(Math.abs(result.pageEquivalentMastered - 604) < 1e-6)
    assert.equal(result.pagesFullyMastered, 604)
    assert.equal(result.completedSurahs, 114)
    assert.equal(result.completedJuz, 30)
  })

  it('pageWithTwoSurahsCountsBoth', () => {
    const partial = computePageProgress(
      604,
      records(index.ayatOfSurah(112), MemorizationStatus.mastered),
      index,
    )
    assert.equal(partial.state, MemorizationStatus.notMemorized)
    assert.equal(partial.mix.masteredAyahs, 4)

    const complete = computePageProgress(
      604,
      records(index.ayat(604), MemorizationStatus.mastered),
      index,
    )
    assert.equal(complete.state, MemorizationStatus.mastered)
  })

  it('emptyIndexAndUnknownPageHaveZeroProgress', () => {
    const emptyIndex = new QuranIndex([], {})
    const result = computeMemorizationSnapshot({}, emptyIndex)
    assert.equal(result.totalAyahs, 0)
    assert.equal(result.strictPercent, 0)
    assert.equal(result.learningPercent, 0)
    assert.ok(Object.values(result.counts).every((c) => c === 0))
    assert.equal(result.surahs.length, 0)
    assert.equal(result.juz.length, 0)
    assert.equal(result.pages.length, 0)

    const page = computePageProgress(99, {}, emptyIndex)
    assert.equal(page.state, MemorizationStatus.notMemorized)
    assert.equal(page.mix.ayahCount, 0)
    assert.ok(Object.values(page.mix.fractions).every((f) => f === 0))
  })

  it('syntheticIndexKeepsSortedGroupsAndEmptyMetadata', () => {
    const first = makeAyahKey(9, 1)
    const second = makeAyahKey(2, 1)
    const rows: AyahLayoutRow[] = [
      { key: first, page: 80, wordCount: 0 },
      { key: second, page: 10, wordCount: 2 },
    ]
    const synthIndex = new QuranIndex(rows, { 80: 7, 10: 2, 90: 8 })
    const input = records([first, second, makeAyahKey(114, 6)], MemorizationStatus.mastered)

    const result = computeMemorizationSnapshot(input, synthIndex)
    assert.equal(result.totalAyahs, 2)
    assert.equal(result.counts[MemorizationStatus.mastered], 2)
    assert.deepEqual(
      result.surahs.map((s) => s.surah),
      [2, 9],
    )
    assert.deepEqual(
      result.juz.map((j) => j.juz),
      [2, 7, 8],
    )
    assert.deepEqual(
      result.pages.map((p) => p.page),
      [10, 80, 90],
    )
    assert.equal(result.pageEquivalentMastered, 1)
    assert.equal(result.pagesFullyMastered, 2)

    const emptyJuz = result.juz[result.juz.length - 1]
    assert.equal(emptyJuz.isComplete, false)
    assert.equal(emptyJuz.strictPercent, 0)
    assert.equal(emptyJuz.learningPercent, 0)

    const emptyPage = result.pages[result.pages.length - 1]
    assert.equal(emptyPage.state, MemorizationStatus.notMemorized)
    assert.equal(emptyPage.mix.ayahCount, 0)
    assert.deepEqual(emptyPage, computePageProgress(90, input, synthIndex))
  })

  // MARK: - AyahRunTests

  it('runsSplitOnStatusChanges', () => {
    const recs: Record<string, AyahMemorizationRecord> = {}
    for (let a = 1; a <= 20; a += 1) {
      const k = makeAyahKey(2, a)
      const r = createBlankRecord(k, 0)
      r.status = MemorizationStatus.mastered
      recs[`2:${a}`] = r
    }
    for (let a = 21; a <= 35; a += 1) {
      const k = makeAyahKey(2, a)
      const r = createBlankRecord(k, 0)
      r.status = MemorizationStatus.memorizedWithErrors
      recs[`2:${a}`] = r
    }
    for (let a = 36; a <= 50; a += 1) {
      const k = makeAyahKey(2, a)
      const r = createBlankRecord(k, 0)
      r.status = MemorizationStatus.needsMushaf
      recs[`2:${a}`] = r
    }

    const runs = computeAyahRuns(2, recs, index)
    assert.deepEqual(runs, [
      { status: MemorizationStatus.mastered, from: 1, to: 20 },
      { status: MemorizationStatus.memorizedWithErrors, from: 21, to: 35 },
      { status: MemorizationStatus.needsMushaf, from: 36, to: 50 },
      { status: MemorizationStatus.notMemorized, from: 51, to: 286 },
    ])
  })

  it('runsOfEmptySurahIsOneNotMemorizedRun', () => {
    const runs = computeAyahRuns(1, {}, index)
    assert.deepEqual(runs, [
      { status: MemorizationStatus.notMemorized, from: 1, to: 7 },
    ])
  })

  it('runsCoverEveryAyahOnce', () => {
    for (let surah = 1; surah <= 114; surah += 1) {
      const total = index.ayahCount(surah)
      const runs = computeAyahRuns(surah, {}, index)
      const totalCovered = runs.reduce((acc, r) => acc + (r.to - r.from + 1), 0)
      assert.equal(totalCovered, total)
      assert.equal(runs[0].from, 1)
      assert.equal(runs[runs.length - 1].to, total)
    }
  })

  it('unknownSurahHasNoRuns', () => {
    assert.deepEqual(computeAyahRuns(0, {}, index), [])
    assert.deepEqual(computeAyahRuns(115, {}, index), [])
    assert.deepEqual(computeAyahRuns(-1, {}, index), [])
  })

  // MARK: - SurahListQueryTests

  const sampleSurahs: SurahListItem[] = [
    { number: 1, name: 'الفاتحة' },
    { number: 2, name: 'البقرة' },
    { number: 3, name: 'آل عمران' },
    { number: 4, name: 'النساء' },
  ]

  const sampleProgressMap: Record<number, SurahProgress> = {
    1: {
      surah: 1,
      ayahCount: 7,
      counts: {
        [MemorizationStatus.mastered]: 7,
        [MemorizationStatus.memorizedWithErrors]: 0,
        [MemorizationStatus.needsMushaf]: 0,
        [MemorizationStatus.notMemorized]: 0,
      },
      strictPercent: 100,
      learningPercent: 100,
      state: 'complete',
      isCompleteIncludingErrors: true,
    },
    2: {
      surah: 2,
      ayahCount: 286,
      counts: {
        [MemorizationStatus.mastered]: 143,
        [MemorizationStatus.memorizedWithErrors]: 0,
        [MemorizationStatus.needsMushaf]: 0,
        [MemorizationStatus.notMemorized]: 143,
      },
      strictPercent: 50,
      learningPercent: 50,
      state: 'partial',
      isCompleteIncludingErrors: false,
    },
    3: {
      surah: 3,
      ayahCount: 200,
      counts: {
        [MemorizationStatus.mastered]: 0,
        [MemorizationStatus.memorizedWithErrors]: 0,
        [MemorizationStatus.needsMushaf]: 0,
        [MemorizationStatus.notMemorized]: 200,
      },
      strictPercent: 0,
      learningPercent: 0,
      state: 'none',
      isCompleteIncludingErrors: false,
    },
    4: {
      surah: 4,
      ayahCount: 176,
      counts: {
        [MemorizationStatus.mastered]: 88,
        [MemorizationStatus.memorizedWithErrors]: 0,
        [MemorizationStatus.needsMushaf]: 0,
        [MemorizationStatus.notMemorized]: 88,
      },
      strictPercent: 50,
      learningPercent: 50,
      state: 'partial',
      isCompleteIncludingErrors: false,
    },
  }

  it('testSortByMushafOrder', () => {
    const result = querySurahList(
      [...sampleSurahs].reverse(),
      sampleProgressMap,
      {},
      '',
      'mushafOrder',
      'all',
    )
    assert.deepEqual(
      result.map((s) => s.number),
      [1, 2, 3, 4],
    )
  })

  it('testSortByMostMemorized', () => {
    const result = querySurahList(
      sampleSurahs,
      sampleProgressMap,
      {},
      '',
      'mostMemorized',
      'all',
    )
    assert.deepEqual(
      result.map((s) => s.number),
      [1, 2, 4, 3],
    )
  })

  it('testSortByLeastMemorized', () => {
    const result = querySurahList(
      sampleSurahs,
      sampleProgressMap,
      {},
      '',
      'leastMemorized',
      'all',
    )
    assert.deepEqual(
      result.map((s) => s.number),
      [3, 2, 4, 1],
    )
  })

  it('testFilterAll', () => {
    const result = querySurahList(
      sampleSurahs,
      sampleProgressMap,
      {},
      '',
      'mushafOrder',
      'all',
    )
    assert.deepEqual(
      result.map((s) => s.number),
      [1, 2, 3, 4],
    )
  })

  it('testFilterComplete', () => {
    const result = querySurahList(
      sampleSurahs,
      sampleProgressMap,
      {},
      '',
      'mushafOrder',
      'complete',
    )
    assert.deepEqual(
      result.map((s) => s.number),
      [1],
    )
  })

  it('testFilterIncomplete', () => {
    const result = querySurahList(
      sampleSurahs,
      sampleProgressMap,
      {},
      '',
      'mushafOrder',
      'incomplete',
    )
    assert.deepEqual(
      result.map((s) => s.number),
      [2, 3, 4],
    )
  })

  it('testFilterCurrentlyLearning', () => {
    const key = makeAyahKey(2, 5)
    const rec = createBlankRecord(key, now)
    rec.isCurrentlyLearning = true

    const result = querySurahList(
      sampleSurahs,
      sampleProgressMap,
      { '2:5': rec },
      '',
      'mushafOrder',
      'currentlyLearning',
    )
    assert.deepEqual(
      result.map((s) => s.number),
      [2],
    )
  })

  it('testFilterNeedsReview', () => {
    const key = makeAyahKey(3, 10)
    const rec = createBlankRecord(key, now)
    rec.status = MemorizationStatus.mastered
    rec.lastReviewedAt = toNormalizedIsoString(now.getTime() - 86400 * 10 * 1000)
    rec.nextReviewAt = toNormalizedIsoString(now.getTime() - 86400 * 1000)

    const result = querySurahList(
      sampleSurahs,
      sampleProgressMap,
      { '3:10': rec },
      '',
      'mushafOrder',
      'needsReview',
      now,
    )
    assert.deepEqual(
      result.map((s) => s.number),
      [3],
    )
  })

  it('testArabicSearchMatchesWithoutDiacriticsAndWithTaMarbutaVariant', () => {
    const result = querySurahList(
      sampleSurahs,
      sampleProgressMap,
      {},
      'البقره',
      'mushafOrder',
      'all',
    )
    assert.deepEqual(
      result.map((s) => s.number),
      [2],
    )
  })

  it('testArabicSearchWithDiacritics', () => {
    const result = querySurahList(
      sampleSurahs,
      sampleProgressMap,
      {},
      'ٱلْبَقَرَةِ',
      'mushafOrder',
      'all',
    )
    assert.deepEqual(
      result.map((s) => s.number),
      [2],
    )
  })

  it('testArabicSearchWithAlefVariant', () => {
    const result = querySurahList(
      sampleSurahs,
      sampleProgressMap,
      {},
      'ال عمران',
      'mushafOrder',
      'all',
    )
    assert.deepEqual(
      result.map((s) => s.number),
      [3],
    )
  })

  it('testArabicSearchNonMatchingReturnsEmpty', () => {
    const result = querySurahList(
      sampleSurahs,
      sampleProgressMap,
      {},
      'يس',
      'mushafOrder',
      'all',
    )
    assert.equal(result.length, 0)
  })

  // MARK: - AyahListQueryTests

  it('testStatusFiltersReturnMatchingAyat', () => {
    const synthIndex = new QuranIndex(
      [
        ...Array.from({ length: 7 }, (_, i) => ({
          key: makeAyahKey(1, i + 1),
          page: 1,
          wordCount: 3,
        })),
        ...Array.from({ length: 3 }, (_, i) => ({
          key: makeAyahKey(2, i + 1),
          page: 2,
          wordCount: 3,
        })),
      ],
      { 1: 1, 2: 1 },
    )

    const recs: Record<string, AyahMemorizationRecord> = {
      '1:1': {
        ...createBlankRecord(makeAyahKey(1, 1), now),
        status: MemorizationStatus.mastered,
        reviewStrength: ReviewStrength.strong,
      },
      '1:2': {
        ...createBlankRecord(makeAyahKey(1, 2), now),
        status: MemorizationStatus.memorizedWithErrors,
        reviewStrength: ReviewStrength.good,
      },
      '1:3': {
        ...createBlankRecord(makeAyahKey(1, 3), now),
        status: MemorizationStatus.needsMushaf,
        reviewStrength: ReviewStrength.needsReview,
      },
      '1:4': {
        ...createBlankRecord(makeAyahKey(1, 4), now),
        status: MemorizationStatus.notMemorized,
        reviewStrength: ReviewStrength.notReviewed,
      },
    }

    assert.deepEqual(
      queryAyahListKeys(
        { type: 'status', status: MemorizationStatus.mastered },
        recs,
        synthIndex,
        now,
      ),
      [makeAyahKey(1, 1)],
    )

    assert.deepEqual(
      queryAyahListKeys(
        { type: 'status', status: MemorizationStatus.memorizedWithErrors },
        recs,
        synthIndex,
        now,
      ),
      [makeAyahKey(1, 2)],
    )

    assert.deepEqual(
      queryAyahListKeys(
        { type: 'status', status: MemorizationStatus.needsMushaf },
        recs,
        synthIndex,
        now,
      ),
      [makeAyahKey(1, 3)],
    )

    const expectedNotMemo = [
      makeAyahKey(1, 4),
      makeAyahKey(1, 5),
      makeAyahKey(1, 6),
      makeAyahKey(1, 7),
      makeAyahKey(2, 1),
      makeAyahKey(2, 2),
      makeAyahKey(2, 3),
    ]
    assert.deepEqual(
      queryAyahListKeys(
        { type: 'status', status: MemorizationStatus.notMemorized },
        recs,
        synthIndex,
        now,
      ),
      expectedNotMemo,
    )
  })

  it('testUnmemorizedAyatWithNoRecordAreReturnedForNotMemorized', () => {
    const synthIndex = new QuranIndex(
      [
        ...Array.from({ length: 7 }, (_, i) => ({
          key: makeAyahKey(1, i + 1),
          page: 1,
          wordCount: 3,
        })),
        ...Array.from({ length: 3 }, (_, i) => ({
          key: makeAyahKey(2, i + 1),
          page: 2,
          wordCount: 3,
        })),
      ],
      { 1: 1, 2: 1 },
    )
    const result = queryAyahListKeys(
      { type: 'status', status: MemorizationStatus.notMemorized },
      {},
      synthIndex,
      now,
    )
    assert.equal(result.length, 10)
    assert.deepEqual(result, synthIndex.ayahKeys)
  })

  it('testDueForReviewExcludesUnmemorizedAndNotYetDueAyat', () => {
    const synthIndex = new QuranIndex(
      [
        ...Array.from({ length: 7 }, (_, i) => ({
          key: makeAyahKey(1, i + 1),
          page: 1,
          wordCount: 3,
        })),
        ...Array.from({ length: 3 }, (_, i) => ({
          key: makeAyahKey(2, i + 1),
          page: 2,
          wordCount: 3,
        })),
      ],
      { 1: 1, 2: 1 },
    )

    const recs: Record<string, AyahMemorizationRecord> = {
      '1:1': {
        ...createBlankRecord(makeAyahKey(1, 1), now),
        status: MemorizationStatus.mastered,
        reviewStrength: ReviewStrength.strong,
        nextReviewAt: null,
      },
      '1:2': {
        ...createBlankRecord(makeAyahKey(1, 2), now),
        status: MemorizationStatus.mastered,
        reviewStrength: ReviewStrength.strong,
        nextReviewAt: toNormalizedIsoString(now.getTime() - 100 * 1000),
      },
      '1:3': {
        ...createBlankRecord(makeAyahKey(1, 3), now),
        status: MemorizationStatus.mastered,
        reviewStrength: ReviewStrength.strong,
        nextReviewAt: toNormalizedIsoString(now.getTime() + 86400 * 1000),
      },
      '1:4': {
        ...createBlankRecord(makeAyahKey(1, 4), now),
        status: MemorizationStatus.needsMushaf,
        reviewStrength: ReviewStrength.needsReview,
        nextReviewAt: null,
      },
      '1:5': {
        ...createBlankRecord(makeAyahKey(1, 5), now),
        status: MemorizationStatus.notMemorized,
        reviewStrength: ReviewStrength.notReviewed,
        nextReviewAt: null,
      },
    }

    const due = queryAyahListKeys(
      { type: 'dueForReview' },
      recs,
      synthIndex,
      now,
    )
    assert.deepEqual(due, [makeAyahKey(1, 1), makeAyahKey(1, 2)])
  })

  it('testCurrentlyLearningFilter', () => {
    const synthIndex = new QuranIndex(
      [
        ...Array.from({ length: 7 }, (_, i) => ({
          key: makeAyahKey(1, i + 1),
          page: 1,
          wordCount: 3,
        })),
      ],
      { 1: 1 },
    )
    const recs: Record<string, AyahMemorizationRecord> = {
      '1:1': {
        ...createBlankRecord(makeAyahKey(1, 1), now),
        status: MemorizationStatus.needsMushaf,
        isCurrentlyLearning: true,
      },
      '1:2': {
        ...createBlankRecord(makeAyahKey(1, 2), now),
        status: MemorizationStatus.mastered,
        isCurrentlyLearning: false,
      },
    }

    const learning = queryAyahListKeys(
      { type: 'currentlyLearning' },
      recs,
      synthIndex,
      now,
    )
    assert.deepEqual(learning, [makeAyahKey(1, 1)])
  })

  // MARK: - MemorizationHistorySummaryTests

  const makeEvent = (
    surah: number,
    ayah: number,
    beforeStatus: MemorizationStatus | null,
    afterStatus: MemorizationStatus,
  ): ChangeEvent => {
    const before: AyahMemorizationRecord | null = beforeStatus
      ? {
          ...createBlankRecord(makeAyahKey(surah, ayah), now),
          status: beforeStatus,
        }
      : null
    const after: AyahMemorizationRecord = {
      ...createBlankRecord(makeAyahKey(surah, ayah), now),
      status: afterStatus,
    }
    return {
      batchID: '123e4567-e89b-12d3-a456-426614174000',
      surah,
      ayah,
      at: toNormalizedIsoString(now),
      before,
      after,
    }
  }

  it('testNoEventsReturnsNil', () => {
    assert.equal(getDominantTransition([]), null)
  })

  it('testSingleEventReturnsItsTransition', () => {
    const ev = makeEvent(1, 1, MemorizationStatus.notMemorized, MemorizationStatus.mastered)
    const trans = getDominantTransition([ev])
    assert.equal(trans?.from, MemorizationStatus.notMemorized)
    assert.equal(trans?.to, MemorizationStatus.mastered)
  })

  it('testNilBeforeDefaultsToNotMemorized', () => {
    const ev = makeEvent(1, 1, null, MemorizationStatus.memorizedWithErrors)
    const trans = getDominantTransition([ev])
    assert.equal(trans?.from, MemorizationStatus.notMemorized)
    assert.equal(trans?.to, MemorizationStatus.memorizedWithErrors)
  })

  it('testMostFrequentTransitionWins', () => {
    const events = [
      makeEvent(1, 1, MemorizationStatus.needsMushaf, MemorizationStatus.mastered),
      makeEvent(1, 2, MemorizationStatus.notMemorized, MemorizationStatus.memorizedWithErrors),
      makeEvent(1, 3, MemorizationStatus.notMemorized, MemorizationStatus.memorizedWithErrors),
    ]
    const trans = getDominantTransition(events)
    assert.equal(trans?.from, MemorizationStatus.notMemorized)
    assert.equal(trans?.to, MemorizationStatus.memorizedWithErrors)
  })

  it('testTieBrokenByLowerFromRawValue', () => {
    const events = [
      makeEvent(1, 1, MemorizationStatus.mastered, MemorizationStatus.memorizedWithErrors),
      makeEvent(1, 2, MemorizationStatus.memorizedWithErrors, MemorizationStatus.mastered),
    ]
    const trans = getDominantTransition(events)
    assert.equal(trans?.from, MemorizationStatus.mastered)
    assert.equal(trans?.to, MemorizationStatus.memorizedWithErrors)
  })

  it('testTieWithSameFromBrokenByLowerToRawValue', () => {
    const events = [
      makeEvent(1, 1, MemorizationStatus.needsMushaf, MemorizationStatus.mastered),
      makeEvent(1, 2, MemorizationStatus.needsMushaf, MemorizationStatus.memorizedWithErrors),
    ]
    const trans = getDominantTransition(events)
    assert.equal(trans?.from, MemorizationStatus.needsMushaf)
    assert.equal(trans?.to, MemorizationStatus.mastered)
  })
})
