import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPageSummary, type SummaryWord } from '../../../packages/qiraat-core/features/pageSummary'
import type { QiraatRuling, QiraatVariant } from '../../../packages/qiraat-core/types'

function word(id: string, token: number, line: number, indexInLine: number, page = 5): SummaryWord {
  return { id, surah: 2, ayah: 7, tokenInAyah: token, page, line, indexInLine, text: `كلمة${token}` }
}
function variant(id: string, token: number, readingIds: string[], endToken = token): QiraatVariant {
  return {
    id, surah: 2, ayah: 7, startToken: token, endToken, operation: 'REPLACE', hafsText: 'x', variantText: 'y',
    differenceType: 'HARAKAH', verificationStatus: 'REVIEWED', createdAt: '', updatedAt: '', readingIds: readingIds as never,
  }
}
function ruling(id: string, category: string, token: number, attribution: { authorityId: string; action: string }[]): QiraatRuling {
  return {
    id, pageNumber: 5, category, categoryAr: `باب ${category}`, color: '#123456', wordAnchored: true, surah: 2, ayah: 7,
    startToken: token, endToken: token, endAyah: 7, baseText: 'x', verificationStatus: 'REVIEWED', attribution, readings: [],
    hasAlternate: false, createdAt: '', updatedAt: '',
  }
}
const ALL = { kind: 'all' } as const
const words = [word('w3', 3, 2, 1), word('w1', 1, 1, 1), word('w2', 2, 1, 2), word('other', 1, 1, 1, 6)]

test('items follow the page layout order and skip unmarked words and other pages', () => {
  const items = buildPageSummary({ page: 5, words, variants: [variant('v', 2, ['Q01-R01']), variant('v3', 3, ['Q01-R01'])], rulings: [], filter: ALL })
  assert.deepEqual(items.map((i) => i.wordId), ['w2', 'w3'])
})

test('a word with a variant and a ruling is one item carrying both', () => {
  const items = buildPageSummary({
    page: 5, words, filter: ALL,
    variants: [variant('v', 2, ['Q01-R01'])],
    rulings: [ruling('r', 'SAKT', 2, [{ authorityId: 'Q02', action: 'سكت' }])],
  })
  assert.equal(items.length, 1)
  assert.equal(items[0].variants.length, 1)
  assert.equal(items[0].rulingGroups.length, 1)
})

test('rulings on a word group by category and each ruling groups its authorities by action', () => {
  const items = buildPageSummary({
    page: 5, words, filter: ALL, variants: [],
    rulings: [
      ruling('r1', 'IMALAH_TAQLIL', 1, [{ authorityId: 'Q06', action: 'إمالة' }, { authorityId: 'Q01-R02', action: 'تقليل' }]),
      ruling('r2', 'IMALAH_TAQLIL', 1, [{ authorityId: 'Q07', action: 'إمالة' }]),
      ruling('r3', 'SAKT', 1, [{ authorityId: 'Q05', action: 'سكت' }]),
    ],
  })
  assert.equal(items.length, 1)
  assert.deepEqual(items[0].rulingGroups.map((g) => g.category), ['IMALAH_TAQLIL', 'SAKT'])
  assert.equal(items[0].rulingGroups[0].rulings.length, 2)
  assert.deepEqual(items[0].rulingGroups[0].rulings[0].actionGroups.map((g) => g.action), ['إمالة', 'تقليل'])
})

test('both narrators of a reader roll up into one reader pill; one narrator stays a narrator pill', () => {
  const items = buildPageSummary({
    page: 5, words, filter: ALL,
    variants: [variant('a', 1, ['Q01-R01', 'Q01-R02']), variant('b', 2, ['Q01-R02'])],
    rulings: [],
  })
  const [first, second] = items
  assert.deepEqual(first.variants[0].pills.map((p) => p.kind), ['reader'])
  assert.deepEqual(second.variants[0].pills.map((p) => p.kind), ['narrator'])
})

test('a filter keeps only that reader and drops the other authorities from the pills', () => {
  const items = buildPageSummary({
    page: 5, words, variants: [variant('a', 1, ['Q01-R01', 'Q05-R02'])], rulings: [], filter: { kind: 'reader', readerId: 'Q01' },
  })
  assert.equal(items.length, 1)
  assert.deepEqual(items[0].variants[0].pills.map((p) => p.readerId), ['Q01'])
})

test('a multi-word variant gives an item for each of its words', () => {
  const items = buildPageSummary({ page: 5, words, variants: [variant('v', 1, ['Q01-R01'], 2)], rulings: [], filter: ALL })
  assert.deepEqual(items.map((i) => i.wordId), ['w1', 'w2'])
})

test('an empty page, or a filter that matches nothing, gives an empty list', () => {
  assert.deepEqual(buildPageSummary({ page: 5, words, variants: [], rulings: [], filter: ALL }), [])
  assert.deepEqual(buildPageSummary({ page: 5, words: [], variants: [variant('v', 1, ['Q01-R01'])], rulings: [], filter: ALL }), [])
  assert.deepEqual(
    buildPageSummary({ page: 5, words, variants: [variant('v', 1, ['Q01-R01'])], rulings: [], filter: { kind: 'reader', readerId: 'Q09' } }),
    [],
  )
})

test('a ruling with no attribution rows but readings keeps its actions', () => {
  const r = ruling('r', 'SAKT', 1, [])
  r.readings = [{ readingId: 'Q01-R01' as never, action: 'سكت', isDefault: true }]
  const items = buildPageSummary({ page: 5, words, variants: [], rulings: [r], filter: ALL })
  assert.equal(items[0].rulingGroups[0].rulings[0].actionGroups[0].action, 'سكت')
})
