import assert from 'node:assert/strict'
import test from 'node:test'
import {
  filterLabel,
  narratorLabel,
  searchReaders,
  toggleCompare,
} from '../../../packages/qiraat-core/features/readerPicker'
import { QIRAAT_NARRATORS } from '../../../packages/qiraat-core/narrators'

test('filterLabel: all, a reader and a narrator', () => {
  assert.equal(filterLabel({ kind: 'all' }), 'الكل')
  assert.equal(filterLabel({ kind: 'reader', readerId: 'Q10' }), 'خلف العاشر')
  assert.equal(filterLabel({ kind: 'reader', readerId: 'Q01' }), 'نافع المدني')
  assert.equal(filterLabel({ kind: 'reading', readingId: 'Q01-R02' }), 'ورش عن نافع')
})

test('خلف: the reader and the narrator never share a label, and neither is bare', () => {
  const reader = filterLabel({ kind: 'reader', readerId: 'Q10' })
  const narrator = filterLabel({ kind: 'reading', readingId: 'Q06-R01' })
  assert.notEqual(reader, narrator)
  assert.notEqual(reader, 'خلف')
  assert.notEqual(narrator, 'خلف')
  assert.equal(narrator, 'خلف عن حمزة')
})

test('the two «الدوري» narrators get different labels that both name their reader', () => {
  const a = narratorLabel('Q03-R01')
  const b = narratorLabel('Q07-R02')
  assert.notEqual(a, b)
  assert.ok(a.includes('أبي عمرو'))
  assert.ok(b.includes('الكسائي'))
  assert.ok(![a, b].includes('الدوري'))
})

test('every narrator label is unique and none is a bare ambiguous name', () => {
  const labels = QIRAAT_NARRATORS.map((n) => narratorLabel(n.id))
  assert.equal(new Set(labels).size, labels.length)
  assert.ok(!labels.includes('الدوري'))
})

test('searchReaders("الدوري") returns both narrators and their readers', () => {
  const r = searchReaders('الدوري')
  assert.deepEqual(r.narrators.map((n) => n.id).sort(), ['Q03-R01', 'Q07-R02'])
  assert.deepEqual(r.readers.map((x) => x.id).sort(), ['Q03', 'Q07'])
})

test('searchReaders("نافع") returns the reader with both of its narrators', () => {
  const r = searchReaders('نافع')
  assert.deepEqual(r.readers.map((x) => x.id), ['Q01'])
  assert.deepEqual(r.narrators.map((n) => n.id).sort(), ['Q01-R01', 'Q01-R02'])
})

test('searchReaders ignores diacritics and alef forms, and an empty query returns everything', () => {
  assert.deepEqual(searchReaders('أَبُو عَمْرو').readers.map((x) => x.id), ['Q03'])
  assert.equal(searchReaders('').readers.length, 10)
  assert.equal(searchReaders('  ').narrators.length, 20)
  assert.deepEqual(searchReaders('لا يوجد شيء كهذا').readers, [])
})

test('toggleCompare adds up to two and drops the oldest on a third', () => {
  assert.deepEqual(toggleCompare([], 'Q01-R01'), ['Q01-R01'])
  assert.deepEqual(toggleCompare(['Q01-R01'], 'Q05-R02'), ['Q01-R01', 'Q05-R02'])
  assert.deepEqual(toggleCompare(['Q01-R01', 'Q05-R02'], 'Q02-R01'), ['Q05-R02', 'Q02-R01'])
  assert.deepEqual(toggleCompare(['Q01-R01', 'Q05-R02'], 'Q01-R01'), ['Q05-R02'])
})
