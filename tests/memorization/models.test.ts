import assert from 'node:assert/strict'
import test, { describe, it } from 'node:test'
import {
  MemorizationStatus,
  ReviewStrength,
  ReviewResult,
  createBlankRecord,
  makeAyahKey,
  toNormalizedIsoString,
  type AyahMemorizationRecord,
  type ChangeEvent,
  type BatchRecord,
} from '../../packages/memorization-core/types'
import { DEFAULT_MEMORIZATION_POLICY } from '../../packages/memorization-core/policy'

describe('MemorizationModelsTests', () => {
  const now = new Date(1_790_000_000 * 1000)

  it('statusRawValuesAreStable', () => {
    assert.equal(MemorizationStatus.mastered, 1)
    assert.equal(MemorizationStatus.memorizedWithErrors, 2)
    assert.equal(MemorizationStatus.needsMushaf, 3)
    assert.equal(MemorizationStatus.notMemorized, 4)
    assert.equal(ReviewStrength.strong, 1)
    assert.equal(ReviewStrength.good, 2)
    assert.equal(ReviewStrength.needsReview, 3)
    assert.equal(ReviewStrength.weak, 4)
    assert.equal(ReviewStrength.notReviewed, 5)
    assert.equal(ReviewResult.excellent, 1)
    assert.equal(ReviewResult.forgot, 4)
  })

  it('blankRecordIsNotMemorized', () => {
    const key = makeAyahKey(1, 1)
    const record = createBlankRecord(key, now)
    assert.equal(record.status, MemorizationStatus.notMemorized)
    assert.equal(record.reviewStrength, ReviewStrength.notReviewed)
    assert.equal(record.isCurrentlyLearning, false)
    assert.equal(record.firstMemorizedAt, null)
    assert.equal(record.lastStatusChangedAt, null)
    assert.equal(record.lastReviewedAt, null)
    assert.equal(record.nextReviewAt, null)
    assert.equal(record.reviewCount, 0)
    assert.equal(record.successfulReviewCount, 0)
    assert.equal(record.consecutiveSuccessfulReviews, 0)
    assert.equal(record.errorCount, 0)
    assert.equal(record.updatedAt, toNormalizedIsoString(now))
    assert.equal(record.surah, 1)
    assert.equal(record.ayah, 1)
  })

  it('recordCodableRoundTrip', () => {
    const key = makeAyahKey(2, 255)
    const record: AyahMemorizationRecord = {
      ...createBlankRecord(key, 1_790_000_000 * 1000),
      status: MemorizationStatus.memorizedWithErrors,
      reviewStrength: ReviewStrength.good,
      isCurrentlyLearning: true,
      firstMemorizedAt: toNormalizedIsoString(1_780_000_000 * 1000),
      nextReviewAt: toNormalizedIsoString(1_790_100_000 * 1000),
      reviewCount: 4,
    }
    const json = JSON.stringify(record)
    const decoded = JSON.parse(json)
    assert.deepEqual(decoded, record)
  })

  it('changeEventCodableRoundTripWithNilBefore', () => {
    const key = makeAyahKey(36, 1)
    const after: AyahMemorizationRecord = {
      ...createBlankRecord(key, now),
      status: MemorizationStatus.mastered,
    }
    const event: ChangeEvent = {
      batchID: '123e4567-e89b-12d3-a456-426614174000',
      surah: 36,
      ayah: 1,
      at: toNormalizedIsoString(now),
      before: null,
      after,
    }
    const json = JSON.stringify(event)
    const decoded = JSON.parse(json)
    assert.deepEqual(decoded, event)
    assert.equal(decoded.before, null)
    assert.equal(decoded.surah, key.surah)
    assert.equal(decoded.ayah, key.ayah)
  })

  it('batchRecordCodableRoundTrip', () => {
    const batch: BatchRecord = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      createdAt: toNormalizedIsoString(now),
      kind: 'import',
      label: 'سورة يس',
      scopeJSON: '{}',
      ayahCount: 83,
      deviceID: 'device',
      countsForStreak: false,
      gainAyahs: 0,
      undoneAt: null,
      undoesBatchID: null,
    }
    const json = JSON.stringify(batch)
    const decoded = JSON.parse(json)
    assert.deepEqual(decoded, batch)
    assert.equal(batch.kind, 'import')
  })

  it('policyStandardValues', () => {
    const policy = DEFAULT_MEMORIZATION_POLICY
    assert.equal(policy.statusWeights[MemorizationStatus.mastered], 1.0)
    assert.equal(policy.statusWeights[MemorizationStatus.memorizedWithErrors], 0.75)
    assert.equal(policy.statusWeights[MemorizationStatus.needsMushaf], 0.4)
    assert.equal(policy.statusWeights[MemorizationStatus.notMemorized], 0.0)
    assert.deepEqual(policy.intervalLadderDays, [1, 3, 7, 14, 30, 60])
    assert.equal(policy.forgotIntervalDays, 1)
    assert.equal(policy.mistakesIntervalDays, 2)
    assert.equal(policy.confirmationAyahThreshold, 30)
    assert.deepEqual(policy.milestonePercents, [25, 50, 75, 100])
  })
})
