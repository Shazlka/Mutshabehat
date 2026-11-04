import assert from 'node:assert/strict'
import test from 'node:test'
import { buildUsulIndex } from '../../../packages/qiraat-core/features/usulIndex'
import type { QiraatRuling } from '../../../packages/qiraat-core/types'

function ruling(id: string, category: string, over: Partial<QiraatRuling> = {}): QiraatRuling {
  return {
    id, pageNumber: 1, category, categoryAr: `باب ${category}`, color: '#112233', wordAnchored: true, surah: 2, ayah: 5,
    startToken: 3, endToken: 3, endAyah: 5, baseText: 'نص', verificationStatus: 'REVIEWED',
    attribution: [{ authorityId: 'Q01', action: id }], readings: [], hasAlternate: false, createdAt: '', updatedAt: '', ...over,
  }
}

// Ported from apps/ios MushafCore UsulIndexTests (8 cases), adapted to the web's page-keyed input.
test('rows with the same category and span become one place and keep every row', () => {
  const index = buildUsulIndex({ 4: [ruling('a', 'SAKT'), ruling('b', 'SAKT'), ruling('c', 'SAKT')] })
  assert.equal(index.length, 1)
  assert.equal(index[0].places.length, 1)
  assert.deepEqual(index[0].places[0].rulings.map((r) => r.id), ['a', 'b', 'c'])
  assert.equal(index[0].places[0].rulings.flatMap((r) => r.attribution).length, 3)
  assert.equal(index[0].count, 1)
})

test('different spans or categories stay separate places', () => {
  const index = buildUsulIndex({
    4: [ruling('a', 'SAKT'), ruling('b', 'SAKT', { endToken: 4 }), ruling('c', 'IKHFA')],
  })
  assert.equal(index.find((c) => c.code === 'SAKT')?.places.length, 2)
  assert.equal(index.find((c) => c.code === 'IKHFA')?.places.length, 1)
})

test('a ruling with an empty baseText still appears, using another row\'s text when one has it', () => {
  const alone = buildUsulIndex({ 4: [ruling('a', 'SAKT', { baseText: '' })] })
  assert.equal(alone[0].places.length, 1)
  assert.equal(alone[0].places[0].baseText, '')
  const shared = buildUsulIndex({ 4: [ruling('a', 'SAKT', { baseText: '' }), ruling('b', 'SAKT', { baseText: 'عِوَجَا' })] })
  assert.equal(shared[0].places[0].baseText, 'عِوَجَا')
})

test('a place carries the page it was loaded under, or the page a resolver gives for its start word', () => {
  assert.equal(buildUsulIndex({ 9: [ruling('a', 'SAKT', { pageNumber: 1 })] })[0].places[0].page, 9)
  const resolved = buildUsulIndex({ 9: [ruling('a', 'SAKT')] }, (surah, ayah, token) => (surah === 2 && ayah === 5 && token === 3 ? 4 : undefined))
  assert.equal(resolved[0].places[0].page, 4)
})

test('categories are ordered by place count descending, then by code; places by position', () => {
  const index = buildUsulIndex({
    7: [ruling('a', 'ZED', { ayah: 9 }), ruling('b', 'ZED', { ayah: 3 })],
    3: [ruling('c', 'ALPHA'), ruling('d', 'BETA'), ruling('e', 'BETA', { ayah: 6 })],
  })
  assert.deepEqual(index.map((c) => c.code), ['BETA', 'ZED', 'ALPHA'])
  assert.deepEqual(index[1].places.map((p) => p.ayah), [3, 9])
  assert.deepEqual(index[0].places.map((p) => p.page), [3, 3])
})

test('count equals the number of places, and the category keeps its Arabic name and colour', () => {
  const index = buildUsulIndex({ 1: [ruling('a', 'SAKT'), ruling('b', 'SAKT', { ayah: 6 })] })
  assert.equal(index[0].count, index[0].places.length)
  assert.equal(index[0].categoryAr, 'باب SAKT')
  assert.equal(index[0].color, '#112233')
})

test('rulings that are not word-anchored (عد الآي) are left out; empty input gives []', () => {
  assert.deepEqual(buildUsulIndex({ 1: [ruling('a', 'AYAH_COUNT', { wordAnchored: false })] }), [])
  assert.deepEqual(buildUsulIndex({}), [])
})

test('the same ruling loaded twice (a page fetched again) counts once', () => {
  const r = ruling('a', 'SAKT')
  const index = buildUsulIndex({ 4: [r], 5: [r] })
  assert.equal(index[0].places[0].rulings.length, 1)
})
