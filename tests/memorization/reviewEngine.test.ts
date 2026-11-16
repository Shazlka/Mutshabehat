import assert from 'node:assert/strict'
import test, { describe, it } from 'node:test'
import {
  MemorizationStatus,
  ReviewStrength,
  ReviewResult,
  createBlankRecord,
  makeAyahKey,
  toNormalizedIsoString,
  type AyahKey,
  type AyahMemorizationRecord,
} from '../../packages/memorization-core/types'
import { QuranIndex } from '../../packages/memorization-core/quranIndex'
import {
  applyReview,
  getDisplayedStrength,
  isAyahDue,
  getDueAyat,
  getMostOverdueSurahs,
  getSuggestion,
} from '../../packages/memorization-core/reviewEngine'
import { planReview } from '../../packages/memorization-core/planner'

describe('MemorizationReviewTests & DueReviewTests', () => {
  const now = new Date(1_790_000_000 * 1000)
  const dayMs = 86_400 * 1000
  const index = QuranIndex.loadDefault()

  const record = (
    surah = 1,
    ayah = 1,
    status = MemorizationStatus.mastered,
  ): AyahMemorizationRecord => {
    const r = createBlankRecord(makeAyahKey(surah, ayah), now)
    r.status = status
    return r
  }

  const due = (surah: number, ayah = 1, overdue: number): AyahMemorizationRecord => {
    const r = record(surah, ayah)
    r.nextReviewAt = toNormalizedIsoString(now.getTime() - overdue * dayMs)
    r.lastReviewedAt = toNormalizedIsoString(
      new Date(r.nextReviewAt).getTime() - 7 * dayMs,
    )
    r.reviewStrength = ReviewStrength.strong
    return r
  }

  it('ladderAfterConsecutiveSuccesses', () => {
    let val = record()
    const daysLadder = [1, 3, 7, 14, 30, 60, 60]
    for (let offset = 0; offset < daysLadder.length; offset += 1) {
      const days = daysLadder[offset]
      val = applyReview(ReviewResult.excellent, val, now)
      assert.equal(
        val.nextReviewAt,
        toNormalizedIsoString(now.getTime() + days * dayMs),
      )
      assert.equal(val.consecutiveSuccessfulReviews, offset + 1)
    }
    assert.equal(val.successfulReviewCount, 7)
    assert.equal(val.reviewCount, 7)
    assert.equal(val.lastReviewedAt, toNormalizedIsoString(now))
    assert.equal(val.updatedAt, toNormalizedIsoString(now))
    assert.equal(val.reviewStrength, ReviewStrength.strong)
  })

  it('goodAlsoCountsAsSuccess', () => {
    const val = applyReview(ReviewResult.good, record(), now)
    assert.equal(val.reviewStrength, ReviewStrength.good)
    assert.equal(val.successfulReviewCount, 1)
    assert.equal(val.consecutiveSuccessfulReviews, 1)
    assert.equal(val.nextReviewAt, toNormalizedIsoString(now.getTime() + dayMs))
  })

  it('failureResetsConsecutiveAndSetsShortInterval', () => {
    let val = record()
    for (let i = 0; i < 3; i += 1) {
      val = applyReview(ReviewResult.excellent, val, now)
    }
    for (const res of [ReviewResult.forgot, ReviewResult.mistakes]) {
      const failed = applyReview(res, val, now)
      assert.equal(failed.consecutiveSuccessfulReviews, 0)
      assert.equal(failed.errorCount, 1)
      assert.equal(failed.successfulReviewCount, 3)
      assert.equal(failed.reviewCount, 4)
      assert.equal(
        failed.nextReviewAt,
        toNormalizedIsoString(
          now.getTime() + (res === ReviewResult.forgot ? dayMs : 2 * dayMs),
        ),
      )
      assert.equal(
        failed.reviewStrength,
        res === ReviewResult.forgot
          ? ReviewStrength.weak
          : ReviewStrength.needsReview,
      )
    }
  })

  it('reviewNeverChangesStatus', () => {
    const statuses = [
      MemorizationStatus.mastered,
      MemorizationStatus.memorizedWithErrors,
      MemorizationStatus.needsMushaf,
    ]
    const results = [
      ReviewResult.excellent,
      ReviewResult.good,
      ReviewResult.mistakes,
      ReviewResult.forgot,
    ]
    for (const status of statuses) {
      for (const res of results) {
        assert.equal(applyReview(res, record(1, 1, status), now).status, status)
      }
    }
  })

  it('agedStrengthStaysMasteredButShowsWeak', () => {
    const val = due(1, 1, 33)
    assert.equal(
      val.lastReviewedAt,
      toNormalizedIsoString(now.getTime() - 40 * dayMs),
    )
    assert.equal(getDisplayedStrength(val, now), ReviewStrength.weak)
    assert.equal(val.status, MemorizationStatus.mastered)
  })

  it('slightlyOverdueShowsNeedsReview', () => {
    for (const strength of [
      ReviewStrength.strong,
      ReviewStrength.good,
      ReviewStrength.weak,
    ]) {
      const val = due(1, 1, 3)
      val.reviewStrength = strength
      assert.equal(
        getDisplayedStrength(val, now),
        strength === ReviewStrength.weak
          ? ReviewStrength.weak
          : ReviewStrength.needsReview,
      )
    }
  })

  it('notOverdueShowsStoredStrength', () => {
    const val = due(1, 1, -1)
    assert.equal(getDisplayedStrength(val, now), ReviewStrength.strong)
    val.nextReviewAt = toNormalizedIsoString(now)
    assert.equal(getDisplayedStrength(val, now), ReviewStrength.strong)
    assert.equal(isAyahDue(val, now), true)
    val.nextReviewAt = null
    assert.equal(getDisplayedStrength(val, now), ReviewStrength.strong)
  })

  it('neverReviewedMemorizedIsDueAndNotReviewed', () => {
    for (const status of [
      MemorizationStatus.mastered,
      MemorizationStatus.memorizedWithErrors,
    ]) {
      const val = record(1, 1, status)
      val.reviewStrength = ReviewStrength.strong
      assert.equal(getDisplayedStrength(val, now), ReviewStrength.notReviewed)
      assert.equal(isAyahDue(val, now), true)
    }
  })

  it('notMemorizedIsNotDue', () => {
    for (const status of [
      MemorizationStatus.notMemorized,
      MemorizationStatus.needsMushaf,
    ]) {
      const val = due(1, 1, 100)
      val.status = status
      assert.equal(isAyahDue(val, now), false)
      assert.equal(getDisplayedStrength(val, now), ReviewStrength.strong)
    }
  })

  it('dueWhenNextReviewIsPast', () => {
    assert.equal(isAyahDue(due(1, 1, 1), now), true)
  })

  it('notDueWhenNextReviewIsFuture', () => {
    assert.equal(isAyahDue(due(1, 1, -1), now), false)
  })

  it('planReviewSkipsUnmemorized', () => {
    const first = record()
    const second = record(1, 2, MemorizationStatus.notMemorized)
    const selection = { type: 'surah' as const, surah: 1 }
    const p = planReview(
      selection,
      'review',
      ReviewResult.good,
      { '1:1': first, '1:2': second },
      index,
      now,
    )
    assert.equal(p.changes.length, 1)
    assert.equal(p.selectionCount, 7)
    assert.equal(p.unchangedCount, 6)
    assert.equal(p.kind, 'review')
    assert.equal(p.countsForStreak, true)
    assert.equal(p.gainAyahs, 0)
    assert.equal(p.label, 'review')
    assert.ok(p.scopeJSON.includes('1'))
    assert.deepEqual(p.changes[0].before, first)
    assert.deepEqual(p.changes[0].after, applyReview(ReviewResult.good, first, now))

    const empty = planReview(
      selection,
      '',
      ReviewResult.good,
      { '1:2': second },
      index,
      now,
    )
    assert.equal(empty.changes.length, 0)
    assert.equal(empty.countsForStreak, false)
  })

  it('suggestionPrefersLearningRange', () => {
    const values: AyahMemorizationRecord[] = []
    for (let a = 1; a <= 5; a += 1) {
      const r = record(36, a, MemorizationStatus.needsMushaf)
      r.isCurrentlyLearning = true
      values.push(r)
    }
    values.push(due(1, 1, 20))
    assert.deepEqual(getSuggestion(values, index, now), {
      type: 'continueLearning',
      surah: 36,
      remaining: 5,
    })

    const earlier = record(2, 1, MemorizationStatus.notMemorized)
    earlier.isCurrentlyLearning = true
    values.push(earlier)
    assert.deepEqual(getSuggestion(values, index, now), {
      type: 'continueLearning',
      surah: 2,
      remaining: 1,
    })
  })

  it('learningAyatThatAreMasteredDoNotCount', () => {
    const val = due(36, 1, -1)
    val.isCurrentlyLearning = true
    assert.equal(getSuggestion([val], index, now), null)
  })

  it('suggestionFallsBackToMostOverdueSurah', () => {
    const values = [due(36, 1, 6), due(36, 2, 10), due(1, 1, 2)]
    assert.deepEqual(getSuggestion(values, index, now), {
      type: 'review',
      surah: 36,
      daysSinceReview: 13,
    })

    const never = record(67, 1)
    never.firstMemorizedAt = toNormalizedIsoString(now.getTime() - 30 * dayMs)
    assert.deepEqual(getSuggestion([...values, never], index, now), {
      type: 'review',
      surah: 67,
      daysSinceReview: undefined,
    })
  })

  it('suggestionTieGoesToLowestSurah', () => {
    assert.deepEqual(getSuggestion([due(36, 1, 8), due(1, 1, 8)], index, now), {
      type: 'review',
      surah: 1,
      daysSinceReview: 15,
    })
  })

  it('suggestionNilWhenNothingMemorized', () => {
    assert.equal(getSuggestion([], index, now), null)
    assert.equal(
      getSuggestion(
        [
          record(1, 1, MemorizationStatus.notMemorized),
          record(2, 1, MemorizationStatus.needsMushaf),
        ],
        index,
        now,
      ),
      null,
    )
  })

  it('suggestionNilWhenNothingIsDue', () => {
    assert.equal(getSuggestion([due(1, 1, -2)], index, now), null)
  })

  it('agingThresholdIsStrictAndIntervalHasOneDayMinimum', () => {
    const val = due(1, 1, 14)
    assert.equal(getDisplayedStrength(val, now), ReviewStrength.needsReview)
    assert.equal(
      getDisplayedStrength(val, new Date(now.getTime() + 1000)),
      ReviewStrength.weak,
    )

    val.nextReviewAt = toNormalizedIsoString(now.getTime() - 2 * dayMs)
    val.lastReviewedAt = val.nextReviewAt
    assert.equal(getDisplayedStrength(val, now), ReviewStrength.needsReview)
    assert.equal(
      getDisplayedStrength(val, new Date(now.getTime() + 1000)),
      ReviewStrength.weak,
    )
  })

  // MARK: - DueReviewTests

  it('testNeverReviewedMemorizedAyatAreDueAndSorted', () => {
    const recs = [record(2, 5), record(1, 3), record(1, 1)]
    assert.deepEqual(getDueAyat(recs, now), [
      makeAyahKey(1, 1),
      makeAyahKey(1, 3),
      makeAyahKey(2, 5),
    ])
  })

  it('testNotMemorizedAndNotYetDueAreExcluded', () => {
    const rec1 = record(1, 1, MemorizationStatus.notMemorized)
    const rec2 = record(1, 2)
    rec2.nextReviewAt = toNormalizedIsoString(now.getTime() + dayMs)
    const rec3 = record(1, 3)
    rec3.nextReviewAt = toNormalizedIsoString(now.getTime() - dayMs)

    assert.deepEqual(getDueAyat([rec1, rec2, rec3], now), [makeAyahKey(1, 3)])
  })

  it('testMostOverdueSurahsOrderedByAverageThenSurahNumber', () => {
    const r2_1 = record(2, 1)
    r2_1.nextReviewAt = toNormalizedIsoString(now.getTime() - 10 * dayMs)
    const r2_2 = record(2, 2)
    r2_2.nextReviewAt = toNormalizedIsoString(now.getTime() - 20 * dayMs)
    const r3_1 = record(3, 1)
    r3_1.nextReviewAt = toNormalizedIsoString(now.getTime() - 15 * dayMs)
    const r5_1 = record(5, 1)
    r5_1.nextReviewAt = toNormalizedIsoString(now.getTime() - 15 * dayMs)
    const r7_1 = record(7, 1)
    r7_1.nextReviewAt = toNormalizedIsoString(now.getTime() - 1 * dayMs)

    const rows = getMostOverdueSurahs([r2_1, r2_2, r3_1, r5_1, r7_1], now, 10)
    assert.deepEqual(
      rows.map((r) => r.surah),
      [2, 3, 5, 7],
    )
    assert.equal(rows[0].dueCount, 2)
    assert.ok(Math.abs(rows[0].averageOverdueDays - 15) < 0.001)
  })
})
