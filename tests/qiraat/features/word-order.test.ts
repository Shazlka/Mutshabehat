import assert from 'node:assert/strict'
import test from 'node:test'
import {
  comesBefore,
  markedWords,
  nearestMarked,
  nextMarked,
  previousMarked,
  variantWajhNumbers,
  type OrderableWord,
} from '../../../packages/qiraat-core/features/wordOrder'
import type { QiraatVariant } from '../../../packages/qiraat-core/types'

function w(id: string, surah: number, ayah: number, tokenInAyah: number, page: number, line = 1, indexInLine = 1): OrderableWord {
  return { id, surah, ayah, tokenInAyah, page, line, indexInLine }
}

function variant(id: string, over: Partial<QiraatVariant> = {}): QiraatVariant {
  return {
    id, surah: 2, ayah: 1, startToken: 1, endToken: 1, operation: 'REPLACE', hafsText: 'a', variantText: 'b',
    differenceType: 'HARAKAH', verificationStatus: 'REVIEWED', createdAt: '', updatedAt: '', readingIds: ['Q01-R01'],
    ...over,
  }
}

test('order follows Quran position, not line layout', () => {
  const early = w('a', 2, 5, 1, 3, 15, 9)
  const late = w('b', 2, 5, 2, 3, 1, 1)
  assert.equal(comesBefore(early, late), true)
  assert.equal(comesBefore(late, early), false)
})

test('a spread gives the same marked list whichever page is listed first', () => {
  const words = [w('p17-1', 2, 20, 1, 17), w('p16-1', 2, 10, 1, 16), w('p16-2', 2, 10, 2, 16)]
  const all = () => true
  const left = markedWords([16, 17], words, all).map((x) => x.id)
  const right = markedWords([17, 16], words, all).map((x) => x.id)
  assert.deepEqual(left, ['p16-1', 'p16-2', 'p17-1'])
  assert.deepEqual(right, left)
})

test('markedWords drops other pages, unmarked words and duplicate ids', () => {
  const words = [w('a', 2, 1, 1, 5), w('a', 2, 1, 1, 5), w('b', 2, 1, 2, 5), w('c', 2, 1, 3, 6)]
  const list = markedWords([5], words, (x) => x.id !== 'b')
  assert.deepEqual(list.map((x) => x.id), ['a'])
})

test('nextMarked and previousMarked stop at the ends', () => {
  const list = [w('a', 2, 1, 1, 5), w('b', 2, 1, 2, 5), w('c', 2, 1, 3, 5)]
  assert.equal(nextMarked(list, list[2]), null)
  assert.equal(previousMarked(list, list[0]), null)
  assert.equal(nextMarked(list, list[0])?.id, 'b')
  assert.equal(previousMarked(list, list[2])?.id, 'b')
})

test('nextMarked returns null when the current word is not in the list', () => {
  const list = [w('a', 2, 1, 1, 5)]
  assert.equal(nextMarked(list, w('zz', 2, 9, 9, 5)), null)
})

test('nearestMarked keeps an exact match', () => {
  const list = [w('a', 2, 1, 1, 5), w('b', 2, 1, 2, 5)]
  assert.equal(nearestMarked(list, list[1])?.id, 'b')
})

test('nearestMarked moves a removed word to the next marked word in Quran order', () => {
  const list = [w('a', 2, 1, 1, 5), w('c', 2, 1, 3, 5)]
  assert.equal(nearestMarked(list, w('b', 2, 1, 2, 5))?.id, 'c')
})

test('nearestMarked falls back to the last word when none follows', () => {
  const list = [w('a', 2, 1, 1, 5), w('b', 2, 1, 2, 5)]
  assert.equal(nearestMarked(list, w('z', 2, 9, 9, 5))?.id, 'b')
})

test('nearestMarked on an empty list is null', () => {
  assert.equal(nearestMarked([], w('z', 2, 9, 9, 5)), null)
})

test('variantWajhNumbers is empty for a single face', () => {
  assert.deepEqual(variantWajhNumbers([variant('v1')]), {})
})

test('variantWajhNumbers numbers distinct faces in appearance order', () => {
  const out = variantWajhNumbers([variant('v1', { uthmaniText: 'x' }), variant('v2', { uthmaniText: 'y' })])
  assert.deepEqual(out, { v1: 1, v2: 2 })
})

test('variantWajhNumbers gives the same number to variants with identical text, note and readers', () => {
  const out = variantWajhNumbers([
    variant('v1', { uthmaniText: 'x', readingIds: ['Q01-R02', 'Q01-R01'] }),
    variant('v2', { uthmaniText: 'y' }),
    variant('v3', { uthmaniText: 'x', readingIds: ['Q01-R01', 'Q01-R02'] }),
  ])
  assert.equal(out.v1, 1)
  assert.equal(out.v3, 1)
  assert.equal(out.v2, 2)
})

test('variantWajhNumbers distinguishes faces by performance note', () => {
  const out = variantWajhNumbers([variant('v1', { performanceNote: 'إشمام' }), variant('v2', { performanceNote: 'روم' })])
  assert.deepEqual(out, { v1: 1, v2: 2 })
})
