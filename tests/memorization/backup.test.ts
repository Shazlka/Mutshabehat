import assert from 'node:assert/strict'
import test, { describe, it } from 'node:test'
import {
  MemorizationStatus,
  createBlankRecord,
  makeAyahKey,
  toNormalizedIsoString,
  type AyahMemorizationRecord,
  type BatchRecord,
  type ChangeEvent,
} from '../../packages/memorization-core/types'
import {
  sha256Hex,
  encodeStableJson,
  planRetentionDatesToDelete,
  decodeMemorizationExport,
  mergeMemorizationExports,
  MemorizationExportError,
  MEMORIZATION_EXPORT_CURRENT_VERSION,
  type BackupManifest,
  type GoalDefinition,
  type MemorizationExport,
  type GoalKind,
} from '../../packages/memorization-core/backup'

describe('BackupCoreTests & MemorizationMergeTests', () => {
  const t0 = new Date(1_790_000_000 * 1000)
  const at = (seconds: number): string =>
    toNormalizedIsoString(new Date(t0.getTime() + seconds * 1000))

  const record = (
    surah: number,
    ayah: number,
    status: MemorizationStatus,
    updated: string,
  ): AyahMemorizationRecord => {
    const r = createBlankRecord(makeAyahKey(surah, ayah), updated)
    r.status = status
    return r
  }

  const batch = (id: string, created: string, undone: string | null = null): BatchRecord => ({
    id,
    createdAt: created,
    kind: 'update',
    label: 'x',
    scopeJSON: '{}',
    ayahCount: 1,
    deviceID: 'd',
    countsForStreak: true,
    gainAyahs: 1,
    undoneAt: undone,
    undoesBatchID: null,
  })

  const makeEvent = (
    batchID: string,
    surah: number,
    ayah: number,
    time: string,
  ): ChangeEvent => ({
    batchID,
    surah,
    ayah,
    at: time,
    before: null,
    after: record(surah, ayah, MemorizationStatus.mastered, time),
  })

  const makeExport = (
    options: {
      records?: AyahMemorizationRecord[]
      batches?: BatchRecord[]
      events?: ChangeEvent[]
      goals?: GoalDefinition[]
      meta?: Record<string, string>
      device?: string
      formatVersion?: number
    } = {},
  ): MemorizationExport => ({
    formatVersion: options.formatVersion ?? MEMORIZATION_EXPORT_CURRENT_VERSION,
    exportedAt: toNormalizedIsoString(t0),
    deviceID: options.device ?? 'local',
    records: options.records ?? [],
    batches: options.batches ?? [],
    events: options.events ?? [],
    goals: options.goals ?? [],
    meta: options.meta ?? {},
  })

  // MARK: - Hash and manifest

  it('sha256KnownVector', () => {
    assert.equal(
      sha256Hex('abc'),
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('manifestRoundTrip', () => {
    const manifest: BackupManifest = {
      formatVersion: 1,
      createdAt: toNormalizedIsoString(1_790_000_000_123),
      deviceID: 'dev',
      appVersion: '1.0 (1)',
      files: [
        {
          name: 'memorization.json',
          sha256: 'aa',
          size: 10,
          rowCount: 5,
        },
        {
          name: 'reading.sqlite',
          sha256: 'bb',
          size: 20,
          rowCount: null,
        },
      ],
    }
    const json = encodeStableJson(manifest)
    const decoded = JSON.parse(json)
    assert.deepEqual(decoded, manifest)
  })

  it('datesRoundTripExactlyAtMillisecondPrecision', () => {
    for (const milliseconds of [
      1_790_000_000_123,
      1_790_000_000_999,
      1_790_000_001_000,
      1_790_000_000_001,
      0,
      1_000,
    ]) {
      const dateStr = toNormalizedIsoString(milliseconds)
      assert.equal(new Date(dateStr).getTime(), milliseconds)
    }
    assert.ok(toNormalizedIsoString(1_790_000_000_123).endsWith('.123Z'))
    assert.ok(toNormalizedIsoString(1_790_000_001_000).endsWith('.000Z'))
  })

  it('retentionKeepsOnePerDayFor14Days', () => {
    const makeDate = (day: number, hour = 10): Date =>
      new Date(Date.UTC(2026, 9, day, hour)) // October 2026

    const existing: Date[] = []
    for (let day = 1; day <= 20; day += 1) {
      existing.push(makeDate(day))
    }
    const olderDuplicate = makeDate(20, 8)
    existing.push(olderDuplicate)

    const toDelete = planRetentionDatesToDelete(
      existing,
      makeDate(20, 12),
      14,
      'UTC',
    )
    const expected = new Set([
      ...Array.from({ length: 6 }, (_, i) => toNormalizedIsoString(makeDate(i + 1))),
      toNormalizedIsoString(olderDuplicate),
    ])

    assert.equal(toDelete.length, 7)
    assert.deepEqual(new Set(toDelete), expected)
  })

  it('retentionNeverDeletesLatestOfToday', () => {
    const makeDate = (day: number, hour = 10): Date =>
      new Date(Date.UTC(2026, 9, day, hour))

    const latest = makeDate(20, 11)
    const toDelete = planRetentionDatesToDelete(
      [makeDate(20, 9), latest, makeDate(20, 10)],
      makeDate(20, 12),
      14,
      'UTC',
    )
    assert.ok(!toDelete.includes(toNormalizedIsoString(latest)))
    assert.equal(toDelete.length, 2)
  })

  it('retentionOnEmptyListIsEmpty', () => {
    const makeDate = (day: number, hour = 10): Date =>
      new Date(Date.UTC(2026, 9, day, hour))
    assert.deepEqual(planRetentionDatesToDelete([], makeDate(20), 14, 'UTC'), [])
  })

  // MARK: - Export decode

  it('exportRoundTrips', () => {
    const r = record(1, 1, MemorizationStatus.mastered, toNormalizedIsoString(t0))
    const exp = makeExport({ records: [r], meta: { device_id: 'dev' } })
    const json = encodeStableJson(exp)
    const decoded = decodeMemorizationExport(json)
    assert.deepEqual(decoded, exp)
  })

  it('exportDecodeRejectsNewerFormat', () => {
    const exp = makeExport({ formatVersion: 99 })
    const json = encodeStableJson(exp)
    assert.throws(
      () => decodeMemorizationExport(json),
      (err: unknown) => err instanceof MemorizationExportError && (err as MemorizationExportError).code === 'newerFormat',
    )
  })

  it('exportDecodeRejectsTruncatedJSON', () => {
    const exp = makeExport()
    const json = encodeStableJson(exp)
    const truncated = json.slice(0, Math.floor(json.length / 2))
    assert.throws(
      () => decodeMemorizationExport(truncated),
      (err: unknown) => err instanceof MemorizationExportError && (err as MemorizationExportError).code === 'corrupt',
    )
  })

  it('exportDecodeRejectsGarbage', () => {
    assert.throws(
      () => decodeMemorizationExport('not json'),
      (err: unknown) => err instanceof MemorizationExportError && (err as MemorizationExportError).code === 'corrupt',
    )
    assert.throws(
      () => decodeMemorizationExport(''),
      (err: unknown) => err instanceof MemorizationExportError && (err as MemorizationExportError).code === 'corrupt',
    )
  })

  it('goalDefinitionRoundTripsEveryKind', () => {
    const kinds: GoalKind[] = [
      { type: 'ayatPerDay', count: 10 },
      { type: 'pageEquivalentsPerWeek', target: 2.5 },
      { type: 'completeSurah', surah: 36 },
      { type: 'completeJuz', juz: 30 },
      { type: 'completeQuranBy', date: toNormalizedIsoString(1_800_000_000 * 1000) },
    ]
    for (const kind of kinds) {
      const goal: GoalDefinition = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        kind,
        createdAt: toNormalizedIsoString(1_790_000_000 * 1000),
      }
      const json = encodeStableJson(goal)
      const decoded = JSON.parse(json)
      assert.deepEqual(decoded, goal)
    }
  })

  // MARK: - MemorizationMergeTests

  it('mergeKeepsNewerAyahRow', () => {
    const local = makeExport({
      records: [record(1, 1, MemorizationStatus.needsMushaf, at(10))],
    })
    const incoming = makeExport({
      records: [
        record(1, 1, MemorizationStatus.mastered, at(20)),
        record(1, 2, MemorizationStatus.mastered, at(5)),
      ],
    })
    const merged = mergeMemorizationExports(local, incoming)
    assert.equal(merged.records.length, 2)
    assert.equal(merged.records.find((r) => r.ayah === 1)?.status, MemorizationStatus.mastered)
    assert.equal(merged.records.find((r) => r.ayah === 2)?.status, MemorizationStatus.mastered)
  })

  it('mergeKeepsLocalRowWhenIncomingIsOlder', () => {
    const local = makeExport({
      records: [record(1, 1, MemorizationStatus.mastered, at(30))],
    })
    const incoming = makeExport({
      records: [record(1, 1, MemorizationStatus.needsMushaf, at(10))],
    })
    assert.equal(
      mergeMemorizationExports(local, incoming).records[0]?.status,
      MemorizationStatus.mastered,
    )
  })

  it('mergeKeepsLocalOnTie', () => {
    const local = makeExport({
      records: [record(1, 1, MemorizationStatus.memorizedWithErrors, at(10))],
    })
    const incoming = makeExport({
      records: [record(1, 1, MemorizationStatus.mastered, at(10))],
    })
    assert.equal(
      mergeMemorizationExports(local, incoming).records[0]?.status,
      MemorizationStatus.memorizedWithErrors,
    )
  })

  it('mergeUnionsBatchesAndEventsById', () => {
    const a = '11111111-1111-1111-1111-111111111111'
    const b = '22222222-2222-2222-2222-222222222222'
    const local = makeExport({
      batches: [batch(a, at(1))],
      events: [makeEvent(a, 1, 1, at(1))],
    })
    const incoming = makeExport({
      batches: [batch(a, at(1)), batch(b, at(2))],
      events: [makeEvent(a, 1, 1, at(1)), makeEvent(b, 1, 2, at(2))],
    })
    const merged = mergeMemorizationExports(local, incoming)
    assert.deepEqual(new Set(merged.batches.map((x) => x.id)), new Set([a, b]))
    assert.equal(merged.events.length, 2)
  })

  it('mergeKeepsUndoneFromEitherSide', () => {
    const id = '11111111-1111-1111-1111-111111111111'
    const undone = at(50)
    const localUndone = mergeMemorizationExports(
      makeExport({ batches: [batch(id, at(1), undone)] }),
      makeExport({ batches: [batch(id, at(1))] }),
    )
    assert.equal(localUndone.batches[0]?.undoneAt, undone)

    const incomingUndone = mergeMemorizationExports(
      makeExport({ batches: [batch(id, at(1))] }),
      makeExport({ batches: [batch(id, at(1), undone)] }),
    )
    assert.equal(incomingUndone.batches[0]?.undoneAt, undone)
  })

  it('mergeUnionsGoalsById', () => {
    const g1: GoalDefinition = {
      id: '11111111-1111-1111-1111-111111111111',
      kind: { type: 'completeSurah', surah: 36 },
      createdAt: toNormalizedIsoString(t0),
    }
    const g2: GoalDefinition = {
      id: '22222222-2222-2222-2222-222222222222',
      kind: { type: 'ayatPerDay', count: 5 },
      createdAt: toNormalizedIsoString(t0),
    }
    const merged = mergeMemorizationExports(
      makeExport({ goals: [g1] }),
      makeExport({ goals: [g1, g2] }),
    )
    assert.deepEqual(new Set(merged.goals.map((g) => g.id)), new Set([g1.id, g2.id]))
  })

  it('mergeMetaKeepsEarliestCompletionAndUnionsMilestones', () => {
    const local = makeExport({
      meta: {
        quran_completed_at: '2026-10-05T10:00:00.000Z',
        milestones_seen: 'surah:1,percent:25',
        device_id: 'local',
        current_from: '2:1',
      },
    })
    const incoming = makeExport({
      meta: {
        quran_completed_at: '2026-09-01T10:00:00.000Z',
        milestones_seen: 'percent:25,juz:30',
        device_id: 'other',
        current_from: '3:1',
        extra: 'v',
      },
    })
    const merged = mergeMemorizationExports(local, incoming)
    assert.equal(merged.meta.quran_completed_at, '2026-09-01T10:00:00.000Z')
    assert.deepEqual(
      new Set(merged.meta.milestones_seen.split(',')),
      new Set(['surah:1', 'percent:25', 'juz:30']),
    )
    assert.equal(merged.meta.device_id, 'local')
    assert.equal(merged.meta.current_from, '2:1')
    assert.equal(merged.meta.extra, 'v')
    assert.equal(merged.deviceID, 'local')
  })

  it('mergeIsIdempotent', () => {
    const a = '11111111-1111-1111-1111-111111111111'
    const b = '22222222-2222-2222-2222-222222222222'
    const local = makeExport({
      records: [
        record(1, 1, MemorizationStatus.needsMushaf, at(10)),
        record(2, 5, MemorizationStatus.mastered, at(3)),
      ],
      batches: [batch(a, at(1))],
      events: [makeEvent(a, 1, 1, at(1))],
      meta: { milestones_seen: 'surah:1' },
    })
    const incoming = makeExport({
      records: [record(1, 1, MemorizationStatus.mastered, at(20))],
      batches: [batch(a, at(1), at(40)), batch(b, at(2))],
      events: [makeEvent(b, 1, 2, at(2))],
      meta: { milestones_seen: 'percent:25' },
    })

    const once = mergeMemorizationExports(local, incoming)
    const twice = mergeMemorizationExports(local, once)
    assert.deepEqual(once, twice)
    assert.deepEqual(mergeMemorizationExports(local, incoming), once)
  })

  it('mergeOfEmptyIsEmpty', () => {
    const merged = mergeMemorizationExports(makeExport(), makeExport())
    assert.equal(merged.records.length, 0)
    assert.equal(merged.batches.length, 0)
    assert.equal(merged.events.length, 0)
    assert.equal(merged.goals.length, 0)
  })
})
