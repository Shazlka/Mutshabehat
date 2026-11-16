import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { QuranIndex } from '../../packages/memorization-core/quranIndex'
import { createMemoryReadingRepository } from '../../src/lib/storage/reading-db'
import { ReadingTrackerCore } from '../../src/lib/storage/readingTrackerCore'

describe('ReadingRepository', () => {
  it('upserts bookmarks by the iOS compound uniqueness key', async () => {
    const repository = createMemoryReadingRepository()
    const first = await repository.addBookmark({ type: 'ayah', surah: 2, ayah: 255, page: 42, note: 'first', createdAt: 1 })
    const second = await repository.addBookmark({ type: 'ayah', surah: 2, ayah: 255, page: 42, note: 'updated', createdAt: 2 })
    assert.equal(first?.id, second?.id)
    assert.equal((await repository.listBookmarks()).length, 1)
    assert.equal((await repository.listBookmarks())[0].note, 'updated')
  })

  it('credits read ayat idempotently', async () => {
    const repository = createMemoryReadingRepository()
    const item = { surah: 1, ayah: 1, page: 1 }
    assert.equal((await repository.recordReadAyahs([item])).newAyahs, 1)
    assert.equal((await repository.recordReadAyahs([item])).newAyahs, 0)
    const khatma = await repository.getOrCreateActiveKhatma()
    assert.equal((await repository.listReadAyahs(khatma.id)).length, 1)
  })

  it('auto-completes at 6,236 ayat and creates khatma N+1', async () => {
    const repository = createMemoryReadingRepository()
    const index = QuranIndex.loadDefault()
    const items = index.ayahKeys.map((key) => ({ surah: key.surah, ayah: key.ayah, page: index.page(key)! }))
    const result = await repository.recordReadAyahs(items)
    assert.equal(result.newAyahs, 6236)
    assert.equal(result.justCompletedKhatma?.status, 'completed')
    assert.equal(result.justCompletedKhatma?.percentComplete, 100)
    assert.equal(result.activeKhatma.khatmaNumber, 2)
    assert.equal(result.activeKhatma.percentComplete, 0)
  })

  it('calculates reading-day streaks and supports session delete/undo', async () => {
    const repository = createMemoryReadingRepository()
    const dates = ['2026-11-14T12:00:00Z', '2026-11-15T12:00:00Z', '2026-11-16T12:00:00Z']
    for (let index = 0; index < dates.length; index += 1) {
      await repository.addManualSession({
        items: [{ surah: 1, ayah: index + 1, page: 1 }], durationMinutes: 1, sessionDate: dates[index],
      })
    }
    assert.deepEqual(await repository.getStreaks(new Date('2026-11-16T12:00:00Z'), 'UTC'), {
      currentStreak: 3, longestStreak: 3, totalReadingDays: 3,
    })
    const event = (await repository.listActivityEvents())[0]
    const deleted = await repository.deleteSession(event.id)
    assert.ok(deleted)
    assert.equal((await repository.listActivityEvents()).length, 2)
    assert.equal(await repository.undoDeleteSession(deleted!), true)
    assert.equal((await repository.listActivityEvents()).length, 3)
  })

  it('round-trips and merges reading exports without duplicating history', async () => {
    const source = createMemoryReadingRepository()
    await source.addBookmark({ type: 'page', surah: 1, ayah: 1, page: 1, note: 'page' })
    await source.addManualSession({ items: [{ surah: 1, ayah: 1, page: 1 }], durationMinutes: 2 })
    const json = await source.exportJSON()

    const restored = createMemoryReadingRepository()
    assert.equal((await restored.importJSON(json)).ok, true)
    assert.equal((await restored.importJSON(json)).ok, true)
    assert.equal((await restored.listBookmarks()).length, 1)
    assert.equal((await restored.listActivityEvents()).length, 1)
    assert.equal((await restored.listReadingDays())[0].secondsRead, 120)
  })
})

describe('ReadingTrackerCore', () => {
  it('credits proportional prefixes, flushes, and resumes without double credit', () => {
    const core = new ReadingTrackerCore()
    const items = Array.from({ length: 6 }, (_, index) => ({ surah: 1, ayah: index + 1, page: 1 }))
    core.startPage(1, items, 0)
    assert.equal(core.creditAt(999), null)
    const credit = core.creditAt(10_000)
    assert.equal(credit?.targetCount, 2)
    core.creditApplied(credit!)
    assert.equal(core.flush(12_000), null)
    core.resume(20_000)
    assert.equal(core.creditAt(20_000), null)
  })
})

