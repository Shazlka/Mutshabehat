import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { MemorizationStatus, createBlankRecord, makeAyahKey, type BatchPlan } from '../../packages/memorization-core/types'
import { createMemoryMemorizationRepository } from '../../src/lib/storage/memorization-db'

function plan(
  status: MemorizationStatus,
  before: ReturnType<typeof createBlankRecord> | null,
  now: string,
  label = 'update',
): BatchPlan {
  const key = makeAyahKey(1, 1)
  const after = { ...(before ?? createBlankRecord(key, now)), status, lastStatusChangedAt: now, updatedAt: now }
  return {
    kind: 'update', label, scopeJSON: '{"type":"ayat"}', selectionCount: 1,
    changes: [{ key, before, after }], countsForStreak: true,
    gainAyahs: before ? 0 : 1, unchangedCount: 0,
  }
}

describe('MemorizationRepository', () => {
  it('applies a plan and undo restores the exact prior sparse row and revokes streak credit', async () => {
    const repository = createMemoryMemorizationRepository()
    const now = '2026-11-16T10:00:00.000Z'
    const batch = await repository.applyPlan(plan(MemorizationStatus.mastered, null, now), now)
    assert.ok(batch)
    assert.equal((await repository.record(makeAyahKey(1, 1)))?.status, MemorizationStatus.mastered)
    assert.equal((await repository.streak(now)).current, 1)

    const undone = await repository.undoBatch(batch!.id, { now: '2026-11-16T10:01:00.000Z' })
    assert.equal(undone.ok, true)
    assert.equal(await repository.record(makeAyahKey(1, 1)), undefined)
    assert.equal((await repository.streak(now)).current, 0)
    const original = (await repository.listBatches()).find((candidate) => candidate.id === batch!.id)
    assert.ok(original?.undoneAt)
    assert.equal(original?.countsForStreak, false)
  })

  it('detects overlap with a newer non-undone batch', async () => {
    const repository = createMemoryMemorizationRepository()
    const firstAt = '2026-11-16T10:00:00.000Z'
    const first = await repository.applyPlan(plan(MemorizationStatus.mastered, null, firstAt, 'first'), firstAt)
    const current = await repository.record(makeAyahKey(1, 1))
    const secondAt = '2026-11-16T11:00:00.000Z'
    await repository.applyPlan(plan(MemorizationStatus.needsMushaf, current!, secondAt, 'second'), secondAt)

    const result = await repository.undoBatch(first!.id)
    assert.equal(result.ok, false)
    assert.equal(result.reason, 'overlap')
    assert.equal(result.conflicts?.length, 1)
    assert.equal((await repository.record(makeAyahKey(1, 1)))?.status, MemorizationStatus.needsMushaf)
  })

  it('round-trips exports and merge keeps the newer ayah while unioning history', async () => {
    const older = createMemoryMemorizationRepository()
    const oldAt = '2026-11-15T10:00:00.000Z'
    await older.applyPlan(plan(MemorizationStatus.needsMushaf, null, oldAt, 'old'), oldAt)
    const oldJSON = await older.exportJSON()

    const newer = createMemoryMemorizationRepository()
    const newAt = '2026-11-16T10:00:00.000Z'
    await newer.applyPlan(plan(MemorizationStatus.mastered, null, newAt, 'new'), newAt)
    const result = await newer.importJSON(oldJSON, 'merge')
    assert.equal(result.ok, true)
    assert.equal((await newer.record(makeAyahKey(1, 1)))?.status, MemorizationStatus.mastered)
    assert.equal((await newer.listBatches()).length, 2)
    assert.equal((await newer.events()).length, 2)

    const roundTrip = createMemoryMemorizationRepository()
    assert.equal((await roundTrip.importJSON(await newer.exportJSON(), 'replace')).ok, true)
    assert.deepEqual(await roundTrip.loadRecords(), await newer.loadRecords())
    assert.equal((await roundTrip.listBatches()).length, 2)
  })
})
