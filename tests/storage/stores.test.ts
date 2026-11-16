import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createMemoryReadingRepository } from '../../src/lib/storage/reading-db'
import { createMemoryMemorizationRepository } from '../../src/lib/storage/memorization-db'
import { createReadingStore } from '../../src/lib/hooks/useReadingStore'
import { createMemorizationStore } from '../../src/lib/hooks/useMemorizationStore'
import { MemorizationStatus, createBlankRecord, makeAyahKey, type BatchPlan } from '../../packages/memorization-core/types'

function makeTestPlan(
  status: MemorizationStatus,
  before: ReturnType<typeof createBlankRecord> | null,
  now: string,
): BatchPlan {
  const key = makeAyahKey(2, 255)
  const after = { ...(before ?? createBlankRecord(key, now)), status, lastStatusChangedAt: now, updatedAt: now }
  return {
    kind: 'update',
    label: 'test update',
    scopeJSON: '{"type":"ayat"}',
    selectionCount: 1,
    changes: [{ key, before, after }],
    countsForStreak: true,
    gainAyahs: before ? 0 : 1,
    unchangedCount: 0,
  }
}

describe('ReadingStore and MemorizationStore external store subscribers', () => {
  it('ReadingStore notifies subscribers on mutations and updates snapshot', async () => {
    const repository = createMemoryReadingRepository()
    const store = createReadingStore(repository)

    let notificationCount = 0
    const unsubscribe = store.subscribe(() => {
      notificationCount += 1
    })

    // Initial snapshot
    const initialSnapshot = store.getSnapshot()
    assert.equal(initialSnapshot.loading, false)
    assert.equal(initialSnapshot.bookmarks.length, 0)

    // Add bookmark
    const bookmark = await store.addBookmark({
      type: 'ayah',
      surah: 2,
      ayah: 255,
      page: 42,
      note: 'Ayat al-Kursi',
    })
    assert.ok(bookmark)
    assert.equal(notificationCount, 1)
    assert.equal(store.getSnapshot().bookmarks.length, 1)
    assert.equal(store.getSnapshot().bookmarks[0].note, 'Ayat al-Kursi')

    // Record read ayahs
    const recordResult = await store.recordReadAyahs([{ surah: 2, ayah: 255, page: 42 }])
    assert.equal(recordResult.newAyahs, 1)
    assert.ok(store.getSnapshot().activeKhatma)

    // Manual session
    await store.addManualSession({
      items: [{ surah: 2, ayah: 255, page: 42 }],
      durationMinutes: 5,
    })
    // One event for the recorded read and one for the manual session, both on the same day.
    assert.equal(store.getSnapshot().activityEvents.length, 2)
    assert.equal(store.getSnapshot().readingDays.length, 1)

    // Export / Import
    const exported = await store.exportJSON()
    assert.ok(exported.includes('Ayat al-Kursi'))
    const importResult = await store.importJSON(exported)
    assert.equal(importResult.ok, true)

    // Remove bookmark
    const removed = await store.removeBookmark(bookmark.id)
    assert.equal(removed, true)
    assert.equal(store.getSnapshot().bookmarks.length, 0)

    unsubscribe()
  })

  it('MemorizationStore notifies subscribers on plan application and undo', async () => {
    const repository = createMemoryMemorizationRepository()
    const store = createMemorizationStore(repository)

    let notificationCount = 0
    const unsubscribe = store.subscribe(() => {
      notificationCount += 1
    })

    const initialSnapshot = store.getSnapshot()
    assert.equal(initialSnapshot.loading, false)
    assert.equal(Object.keys(initialSnapshot.records).length, 0)

    const now = '2026-11-16T12:00:00.000Z'
    const plan = makeTestPlan(MemorizationStatus.mastered, null, now)

    // Apply plan
    const batch = await store.applyPlan(plan, now)
    assert.ok(batch)
    assert.equal(notificationCount, 1)
    const afterApply = store.getSnapshot()
    assert.equal(afterApply.records['2:255']?.status, MemorizationStatus.mastered)
    assert.equal(afterApply.batches.length, 1)
    assert.equal(afterApply.events.length, 1)

    // Save and delete goal
    const goal = {
      id: 'g-1',
      kind: { type: 'completeSurah' as const, surah: 36 },
      createdAt: now,
    }
    assert.equal(await store.saveGoal(goal), true)
    assert.equal(store.getSnapshot().goals.length, 1)
    assert.equal(await store.deleteGoal('g-1'), true)
    assert.equal(store.getSnapshot().goals.length, 0)

    // Undo batch
    const undoResult = await store.undoBatch(batch.id, { now: '2026-11-16T12:05:00.000Z' })
    assert.equal(undoResult.ok, true)
    const afterUndo = store.getSnapshot()
    assert.equal(afterUndo.records['2:255'], undefined)

    unsubscribe()
  })
})
