import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createMemoryStore,
  exportPersonalData,
  importPersonalData,
  openPersonalStore,
} from '../../../src/lib/personal-store'
import { isEmptyNote, mergeNotes, noteId, NOTES_STORE, type QiraatWordNote } from '../../../packages/qiraat-core/features/notes'

function note(surah: number, ayah: number, token: number, over: Partial<QiraatWordNote> = {}): QiraatWordNote {
  return { id: noteId(surah, ayah, token), surah, ayah, token, text: '', favourite: false, updatedAt: '2026-01-01T00:00:00.000Z', ...over }
}

test('noteId is surah:ayah:token', () => {
  assert.equal(noteId(2, 112, 13), '2:112:13')
})

test('put, get, all and delete round-trip', async () => {
  const store = createMemoryStore()
  const n = note(2, 5, 3, { text: 'ملاحظة' })
  await store.put(NOTES_STORE, n.id, n)
  assert.deepEqual(await store.get(NOTES_STORE, n.id), n)
  assert.deepEqual(await store.all(NOTES_STORE), [n])
  await store.delete(NOTES_STORE, n.id)
  assert.equal(await store.get(NOTES_STORE, n.id), undefined)
  assert.deepEqual(await store.all(NOTES_STORE), [])
})

test('with no IndexedDB the store is not available, never throws, and still holds notes for this visit', async () => {
  const store = await openPersonalStore(null)
  assert.equal(store.available, false)
  const n = note(1, 1, 1, { favourite: true })
  await assert.doesNotReject(() => store.put(NOTES_STORE, n.id, n))
  assert.deepEqual(await store.get(NOTES_STORE, n.id), n)
})

test('an IndexedDB factory that fails to open also gives an unavailable, working store', async () => {
  const broken = { open: () => { throw new Error('blocked') } } as unknown as IDBFactory
  const store = await openPersonalStore(broken)
  assert.equal(store.available, false)
  await assert.doesNotReject(() => store.put(NOTES_STORE, 'k', { id: 'k' }))
})

test('export then import into an empty store restores every note', async () => {
  const a = createMemoryStore()
  const notes = [note(2, 5, 3, { text: 'أ' }), note(3, 1, 1, { favourite: true })]
  for (const n of notes) await a.put(NOTES_STORE, n.id, n)
  const json = await exportPersonalData(a)
  const b = createMemoryStore()
  const result = await importPersonalData(b, json)
  assert.equal(result.imported, 2)
  assert.deepEqual((await b.all<QiraatWordNote>(NOTES_STORE)).sort((x, y) => x.id.localeCompare(y.id)), notes.sort((x, y) => x.id.localeCompare(y.id)))
})

test('importing keeps the newer version of a note that exists on both sides', async () => {
  const store = createMemoryStore()
  const local = note(2, 5, 3, { text: 'قديم', updatedAt: '2026-01-01T00:00:00.000Z' })
  await store.put(NOTES_STORE, local.id, local)
  const other = createMemoryStore()
  const newer = note(2, 5, 3, { text: 'جديد', updatedAt: '2026-02-01T00:00:00.000Z' })
  await other.put(NOTES_STORE, newer.id, newer)
  await importPersonalData(store, await exportPersonalData(other))
  assert.equal((await store.get<QiraatWordNote>(NOTES_STORE, local.id))?.text, 'جديد')
})

test('malformed or wrongly shaped import rejects with a message and changes nothing', async () => {
  const store = createMemoryStore()
  const n = note(2, 5, 3, { text: 'باقية' })
  await store.put(NOTES_STORE, n.id, n)
  await assert.rejects(() => importPersonalData(store, '{not json'), /ملف/)
  await assert.rejects(() => importPersonalData(store, JSON.stringify({ version: 99, stores: {} })), /ملف/)
  await assert.rejects(() => importPersonalData(store, JSON.stringify({ version: 1, stores: { [NOTES_STORE]: [{ text: 'no id' }] } })), /ملف/)
  assert.deepEqual(await store.all(NOTES_STORE), [n])
})

test('mergeNotes keeps the newer text per id and the union of ids', () => {
  const merged = mergeNotes(
    [note(2, 5, 3, { text: 'محلي', updatedAt: '2026-03-01T00:00:00.000Z' }), note(2, 6, 1)],
    [note(2, 5, 3, { text: 'وارد', updatedAt: '2026-02-01T00:00:00.000Z' }), note(3, 1, 1)],
  )
  assert.deepEqual(merged.map((n) => n.id).sort(), ['2:5:3', '2:6:1', '3:1:1'])
  assert.equal(merged.find((n) => n.id === '2:5:3')?.text, 'محلي')
})

test('a note with no text that is not a favourite is empty and is not kept', () => {
  assert.equal(isEmptyNote(note(1, 1, 1)), true)
  assert.equal(isEmptyNote(note(1, 1, 1, { text: '   ' })), true)
  assert.equal(isEmptyNote(note(1, 1, 1, { favourite: true })), false)
  assert.equal(isEmptyNote(note(1, 1, 1, { text: 'x' })), false)
})

test('putting a note again replaces it', async () => {
  const store = createMemoryStore()
  await store.put(NOTES_STORE, '2:5:3', note(2, 5, 3, { text: 'أول' }))
  await store.put(NOTES_STORE, '2:5:3', note(2, 5, 3, { text: 'ثانٍ' }))
  assert.equal((await store.all(NOTES_STORE)).length, 1)
  assert.equal((await store.get<QiraatWordNote>(NOTES_STORE, '2:5:3'))?.text, 'ثانٍ')
})

test('two stores do not share data', async () => {
  const a = createMemoryStore()
  const b = createMemoryStore()
  await a.put(NOTES_STORE, 'k', { id: 'k' })
  assert.deepEqual(await b.all(NOTES_STORE), [])
})

test('the export is versioned and dated', async () => {
  const parsed = JSON.parse(await exportPersonalData(createMemoryStore()))
  assert.equal(parsed.version, 1)
  assert.ok(!Number.isNaN(Date.parse(parsed.exportedAt)))
  assert.deepEqual(parsed.stores[NOTES_STORE], [])
})

test('importing a note with the same update time keeps the local one', async () => {
  const store = createMemoryStore()
  await store.put(NOTES_STORE, '2:5:3', note(2, 5, 3, { text: 'محلي' }))
  const other = createMemoryStore()
  await other.put(NOTES_STORE, '2:5:3', note(2, 5, 3, { text: 'وارد' }))
  assert.equal((await importPersonalData(store, await exportPersonalData(other))).imported, 0)
  assert.equal((await store.get<QiraatWordNote>(NOTES_STORE, '2:5:3'))?.text, 'محلي')
})

test('importing an empty backup imports nothing and succeeds', async () => {
  const result = await importPersonalData(createMemoryStore(), await exportPersonalData(createMemoryStore()))
  assert.equal(result.imported, 0)
})
