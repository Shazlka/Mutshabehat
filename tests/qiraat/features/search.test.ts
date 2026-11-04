import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSearchIndex, groupResults } from '../../../packages/qiraat-core/features/search'
import type { QiraatRuling, QiraatVariant } from '../../../packages/qiraat-core/types'

function variant(id: string, page: number, ayah: number, token: number, readingIds: string[], hafsText: string, variantText = 'بدل'): QiraatVariant {
  return {
    id, surah: 2, ayah, startToken: token, endToken: token, operation: 'REPLACE', hafsText, variantText,
    differenceType: 'HARAKAH', verificationStatus: 'REVIEWED', createdAt: '', updatedAt: '', readingIds: readingIds as never,
  }
}
function ruling(id: string, category: string, ayah: number, token: number, baseText: string, readingIds: string[], over: Partial<QiraatRuling> = {}): QiraatRuling {
  return {
    id, pageNumber: 1, category, categoryAr: `باب ${category}`, color: '#123456', wordAnchored: true, surah: 2, ayah,
    startToken: token, endToken: token, endAyah: ayah, baseText, verificationStatus: 'REVIEWED',
    attribution: [], readings: readingIds.map((readingId) => ({ readingId: readingId as never, action: 'x', isDefault: true })),
    hasAlternate: false, createdAt: '', updatedAt: '', ...over,
  }
}

const index = buildSearchIndex(
  {
    5: [variant('v1', 5, 3, 2, ['Q01-R01', 'Q05-R02'], 'ٱلصِّرَٰطَ'), variant('v2', 5, 4, 1, ['Q02-R01'], 'مَٰلِكِ')],
    9: [variant('v3', 9, 1, 1, ['Q01-R02'], 'يَخْدَعُونَ')],
  },
  {
    5: [ruling('r1', 'SAKT', 3, 2, 'ٱلصِّرَٰطَ', ['Q03-R01']), ruling('r2', 'IKHFA', 8, 1, 'مِنْ', ['Q01-R01'])],
  },
)

test('an authority query for a reader finds the records of both of its narrators', () => {
  const nafi = index.search({ kind: 'authority', authorityId: 'Q01' })
  assert.deepEqual(nafi.map((r) => `${r.page}:${r.ayah}:${r.token}`), ['5:3:2', '5:8:1', '9:1:1'])
  const warsh = index.search({ kind: 'authority', authorityId: 'Q01-R02' })
  assert.deepEqual(warsh.map((r) => r.page), [9])
})

test('a word query ignores diacritics and alef wasla, and also finds the variant text', () => {
  const byWord = index.search({ kind: 'word', text: 'الصراط' })
  assert.deepEqual(byWord.map((r) => r.displayText), ['ٱلصِّرَٰطَ'])
  assert.equal(byWord[0].recordCount, 2) // the variant and the ruling at the same place
  assert.deepEqual(byWord[0].kinds, ['variant', 'ruling'])
  assert.equal(index.search({ kind: 'word', text: 'بدل' }).length, 3) // every variant carries «بدل» as its variant text
})

test('a word query matches a part of the word and an empty or blank query matches nothing', () => {
  assert.equal(index.search({ kind: 'word', text: 'خدع' }).length, 1)
  assert.deepEqual(index.search({ kind: 'word', text: '   ' }), [])
})

test('a category query returns only the rulings of that باب, and the categories are listed with counts', () => {
  assert.deepEqual(index.search({ kind: 'category', code: 'IKHFA' }).map((r) => r.ayah), [8])
  assert.deepEqual(index.categories, [
    { code: 'IKHFA', nameAr: 'باب IKHFA', rulingCount: 1 },
    { code: 'SAKT', nameAr: 'باب SAKT', rulingCount: 1 },
  ])
})

test('results are ordered by surah, page, ayah and token', () => {
  const all = index.search({ kind: 'word', text: 'ا' })
  const keys = all.map((r) => [r.surah, r.page, r.ayah, r.token])
  assert.deepEqual(keys, [...keys].sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3]))
})

test('groupResults groups by surah, then page, with results in ayah and token order', () => {
  const groups = groupResults(index.search({ kind: 'authority', authorityId: 'Q01' }))
  assert.deepEqual(groups.map((g) => [g.surah, g.pages.map((p) => p.page)]), [[2, [5, 9]]])
  assert.deepEqual(groups[0].pages[0].results.map((r) => r.ayah), [3, 8])
})

test('an empty index answers every query with an empty list', () => {
  const empty = buildSearchIndex({}, {})
  assert.deepEqual(empty.search({ kind: 'word', text: 'ا' }), [])
  assert.deepEqual(empty.search({ kind: 'authority', authorityId: 'Q01' }), [])
  assert.deepEqual(empty.categories, [])
  assert.deepEqual(groupResults([]), [])
})

test('rulings that are not word-anchored never match a word or authority query', () => {
  const idx = buildSearchIndex({}, { 1: [ruling('c', 'AYAH_COUNT', 1, 1, 'نص', ['Q01-R01'], { wordAnchored: false })] })
  assert.deepEqual(idx.search({ kind: 'word', text: 'نص' }), [])
  assert.deepEqual(idx.search({ kind: 'authority', authorityId: 'Q01' }), [])
})

test('authority search follows the rulings\' readings, as the page marks do, not attribution-only rows', () => {
  const only = buildSearchIndex({}, {
    1: [ruling('a', 'SAKT', 1, 1, 'نص', [], { attribution: [{ authorityId: 'Q07', action: 'سكت' }] })],
  })
  assert.equal(only.search({ kind: 'authority', authorityId: 'Q07' }).length, 0)
  const withReadings = buildSearchIndex({}, {
    1: [ruling('b', 'SAKT', 1, 1, 'نص', ['Q07-R02'], { attribution: [{ authorityId: 'Q07', action: 'سكت' }] })],
  })
  assert.equal(withReadings.search({ kind: 'authority', authorityId: 'Q07' }).length, 1)
  assert.equal(withReadings.search({ kind: 'authority', authorityId: 'Q07-R02' }).length, 1)
  assert.equal(withReadings.search({ kind: 'authority', authorityId: 'Q07-R01' }).length, 0)
})

test('a place shows source text even when its first record has none', () => {
  const idx = buildSearchIndex({}, { 1: [ruling('a', 'SAKT', 1, 1, '', ['Q01-R01']), ruling('b', 'IKHFA', 1, 1, 'نص', ['Q01-R01'])] })
  assert.equal(idx.search({ kind: 'authority', authorityId: 'Q01' })[0].displayText, 'نص')
})

test('a multi-word ruling opens at its start token', () => {
  const idx = buildSearchIndex({}, { 1: [ruling('a', 'IDGHAM_KABIR', 4, 7, 'كلمتان', ['Q03-R01'], { endToken: 8 })] })
  const [hit] = idx.search({ kind: 'category', code: 'IDGHAM_KABIR' })
  assert.deepEqual([hit.ayah, hit.token], [4, 7])
})

test('a variant and a ruling at one anchor are one place with both kinds counted', () => {
  const idx = buildSearchIndex({ 1: [variant('v', 1, 3, 3, ['Q02-R01'], 'نص')] }, { 1: [ruling('r', 'SAKT', 3, 3, 'نص', ['Q02-R01'])] })
  const hits = idx.search({ kind: 'authority', authorityId: 'Q02-R01' })
  assert.equal(hits.length, 1)
  assert.deepEqual([hits[0].recordCount, hits[0].kinds], [2, ['variant', 'ruling']])
})
