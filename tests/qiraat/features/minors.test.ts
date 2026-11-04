import assert from 'node:assert/strict'
import test from 'node:test'
import { rollupAuthorityPills } from '../../../packages/qiraat-core/attribution'
import { openPersonalStore } from '../../../src/lib/personal-store'
import { mutoonWorks, searchMutoon } from '../../../packages/qiraat-core/features/mutoon'
import { aggregateRulings } from '../../../packages/qiraat-core/features/aggregateRulings'
import type { QiraatRuling } from '../../../packages/qiraat-core/types'

test('the narrator «خلف» is never a bare pill name: «الراوي خلف عن حمزة»', () => {
  assert.equal(rollupAuthorityPills(['Q06-R01'])[0].name, 'الراوي خلف عن حمزة')
  assert.equal(rollupAuthorityPills(['Q10'])[0].name, 'الإمام خلف العاشر')
  assert.equal(rollupAuthorityPills(['Q03-R01'])[0].name, 'الراوي الدوري عن أبي عمرو')
  assert.equal(rollupAuthorityPills(['Q01-R02'])[0].name, 'الراوي ورش')
})

test('openPersonalStore does not throw when reading indexedDB itself throws', async () => {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB')
  Object.defineProperty(globalThis, 'indexedDB', { get() { throw new Error('SecurityError') }, configurable: true })
  try {
    const store = await openPersonalStore()
    assert.equal(store.available, false)
  } finally {
    if (had) Object.defineProperty(globalThis, 'indexedDB', had)
    else delete (globalThis as { indexedDB?: unknown }).indexedDB
  }
})

test('a malformed «المتون» snapshot gives no works instead of throwing', () => {
  const bad = { seq: 1, document: { mutoon: { schemaVersion: 1, works: [{ work: 'durrah', title: 'x', author: 'y', bookId: null }, { work: 'tayyibah', title: 't', author: 'a', bookId: null, chapters: [{ title: 'c', farsh: false }] }] } } } as never
  assert.doesNotThrow(() => mutoonWorks(bad))
  assert.doesNotThrow(() => searchMutoon(bad, 'ا'))
  assert.deepEqual(mutoonWorks(bad).map((w) => w.chapters.length), [0, 1])
})

function row(id: string, over: Partial<QiraatRuling> = {}): QiraatRuling {
  return {
    id, pageNumber: 1, category: 'SAKT', categoryAr: 'السكت', color: '#7C3AED', wordAnchored: true, surah: 2, ayah: 5, startToken: 3,
    endToken: 3, endAyah: 5, baseText: 'نص', verificationStatus: 'REVIEWED', attribution: [], readings: [], hasAlternate: false,
    createdAt: '', updatedAt: '', ...over,
  }
}

test('rows with the same category and span merge into one ruling that keeps every attribution row and reading', () => {
  const merged = aggregateRulings([
    row('a', { attribution: [{ authorityId: 'Q01', action: 'سكت' }], readings: [{ readingId: 'Q01-R01' as never, action: 'سكت', isDefault: true }] }),
    row('b', { attribution: [{ authorityId: 'Q02', action: 'سكت' }, { authorityId: 'Q01', action: 'سكت' }], hasAlternate: true, notes: 'ملاحظة' }),
    row('c', { category: 'IKHFA', categoryAr: 'الإخفاء' }),
  ])
  assert.equal(merged.length, 2)
  assert.deepEqual(merged[0].attribution.map((a) => a.authorityId), ['Q01', 'Q02'])
  assert.equal(merged[0].readings.length, 1)
  assert.equal(merged[0].hasAlternate, true)
  assert.equal(merged[0].notes, 'ملاحظة')
  assert.equal(merged[0].id, 'a')
  assert.equal(merged[1].category, 'IKHFA')
})

test('different spans stay separate, a lone row is returned unchanged, and the input is not mutated', () => {
  const a = row('a')
  const before = JSON.stringify(a)
  const out = aggregateRulings([a, row('b', { endToken: 4 })])
  assert.equal(out.length, 2)
  assert.equal(aggregateRulings([a])[0], a)
  assert.equal(JSON.stringify(a), before)
  assert.deepEqual(aggregateRulings([]), [])
})

test('merging keeps «تحتاج مراجعة» when any row needs it and joins distinct source notes', () => {
  const [m] = aggregateRulings([row('a', { sourceNotes: ['x'] }), row('b', { verificationStatus: 'NEEDS_MANUAL_REVIEW', sourceNotes: ['x', 'y'] })])
  assert.equal(m.verificationStatus, 'NEEDS_MANUAL_REVIEW')
  assert.deepEqual(m.sourceNotes, ['x', 'y'])
})
