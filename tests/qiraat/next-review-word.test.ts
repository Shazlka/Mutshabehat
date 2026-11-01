import assert from 'node:assert/strict'
import test from 'node:test'

import { findNextReviewWord } from '../../src/app/mushaf-1441/review/_lib/nextReviewWord'
import type { ReviewPage, ReviewRow } from '../../src/app/mushaf-1441/review/_lib/types'
import { row } from './_helpers/review-row'

const key = (w: number) => `002:002:${String(w).padStart(3, '0')}`

function pageWith(rows: ReviewRow[], wordCount = 8): ReviewPage {
  return {
    page: 2,
    words: Array.from({ length: wordCount }, (_, i) => ({
      key: key(i + 1), surah: 2, ayah: 2, word: i + 1, line: 1, text: `w${i + 1}`,
    })),
    rows,
    stats: { total: rows.length, unreviewed: 0, reviewed: 0, flagged: 0, deleted: 0 },
    narrators: [],
    categories: [],
    variantTypes: [],
    subCategories: [],
  }
}

function at(word: number, overrides: Partial<ReviewRow> = {}): ReviewRow {
  return row({
    entryId: `e${word}-${overrides.kind ?? 'farsh'}`,
    startWord: word,
    endWord: word,
    startKey: key(word),
    endKey: key(word),
    narrators: [{ id: 'Q01-R01' }],
    ...overrides,
  })
}

const ALL = { status: 'all', kind: 'all', category: null } as const

test('no filter: next unreviewed word after the current one', () => {
  const page = pageWith([at(2), at(4, { kind: 'usul', categoryCode: 'IDGHAM_KABIR' }), at(6)])
  assert.equal(findNextReviewWord(page, key(2), ALL)?.key, key(4))
  assert.equal(findNextReviewWord(page, key(2))?.key, key(4))
})

test('فرش filter skips أصول words and lands on the next فرش word', () => {
  const page = pageWith([
    at(2),
    at(4, { kind: 'usul', categoryCode: 'IDGHAM_KABIR' }),
    at(5, { kind: 'usul', categoryCode: 'MADD_BADAL' }),
    at(7),
  ])
  assert.equal(findNextReviewWord(page, key(2), { ...ALL, kind: 'farsh' })?.key, key(7))
})

test('أصول filter lands only on أصول words, and the category narrows it further', () => {
  const page = pageWith([
    at(2, { kind: 'usul', categoryCode: 'IDGHAM_KABIR' }),
    at(3),
    at(4, { kind: 'usul', categoryCode: 'MADD_BADAL' }),
    at(6, { kind: 'usul', categoryCode: 'IDGHAM_KABIR' }),
  ])
  assert.equal(findNextReviewWord(page, key(2), { ...ALL, kind: 'usul' })?.key, key(4))
  assert.equal(findNextReviewWord(page, key(2), { ...ALL, kind: 'usul', category: 'IDGHAM_KABIR' })?.key, key(6))
})

test('a word whose only matching row is already reviewed is skipped in favour of one still to review', () => {
  const page = pageWith([at(2), at(4, { reviewStatus: 'reviewed' }), at(6)])
  assert.equal(findNextReviewWord(page, key(2), { ...ALL, kind: 'farsh' })?.key, key(6))
})

test('wraps to the first matching word at the end of the page, never to the current word', () => {
  const page = pageWith([at(1), at(2, { kind: 'usul', categoryCode: 'MADD_BADAL' }), at(5)])
  assert.equal(findNextReviewWord(page, key(5), { ...ALL, kind: 'farsh' })?.key, key(1))
  assert.equal(findNextReviewWord(pageWith([at(5)]), key(5), { ...ALL, kind: 'farsh' }), null)
})

test('with a filter on, no matching word means no move (no arbitrary next word)', () => {
  const page = pageWith([at(2), at(4, { kind: 'usul', categoryCode: 'MADD_BADAL' })])
  assert.equal(findNextReviewWord(page, key(2), { ...ALL, kind: 'usul', category: 'IDGHAM_KABIR' }), null)
  // Without a filter the old fallback (next word in sequence) still applies.
  assert.equal(findNextReviewWord(pageWith([at(2, { reviewStatus: 'reviewed' })]), key(2), ALL)?.key, key(3))
})

test('deleted rows never count', () => {
  const page = pageWith([at(2), at(4, { deleted: true })])
  assert.equal(findNextReviewWord(page, key(2), { ...ALL, kind: 'farsh' }), null)
})
