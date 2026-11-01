import assert from 'node:assert/strict'
import test from 'node:test'

import { findNextReviewFace, findNextReviewWord } from '../../src/app/mushaf-1441/review/_lib/nextReviewWord'
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

// ── Next وجه of the same word ───────────────────────────────────────────────────────────────────

function face(id: string, word: number, overrides: Partial<ReviewRow> = {}): ReviewRow {
  return at(word, { entryId: id, ...overrides })
}

test('after approving a face, the next unreviewed face of the same word comes first', () => {
  const page = pageWith([face('a', 3), face('b', 3), face('c', 3, { reviewStatus: 'reviewed' }), face('d', 3)])
  assert.equal(findNextReviewFace(page, key(3), 'a', ALL)?.entryId, 'b')
  assert.equal(findNextReviewFace(page, key(3), 'b', ALL)?.entryId, 'd')
})

test('faces before the approved one are offered once the later ones are done', () => {
  const page = pageWith([face('a', 3), face('b', 3, { reviewStatus: 'reviewed' }), face('c', 3)])
  assert.equal(findNextReviewFace(page, key(3), 'c', ALL)?.entryId, 'a')
})

test('flagged faces count as still to review', () => {
  const page = pageWith([face('a', 3), face('b', 3, { reviewStatus: 'flagged' })])
  assert.equal(findNextReviewFace(page, key(3), 'a', ALL)?.entryId, 'b')
})

test('no other face left means null, so the caller moves to the next word', () => {
  const page = pageWith([face('a', 3), face('b', 3, { reviewStatus: 'reviewed' }), at(5)])
  assert.equal(findNextReviewFace(page, key(3), 'a', ALL), null)
  assert.equal(findNextReviewWord(page, key(3), ALL)?.key, key(5))
})

test('only faces the filter shows are offered: فرش skips the أصول face of the same word', () => {
  const page = pageWith([
    face('a', 3),
    face('u', 3, { kind: 'usul', categoryCode: 'MADD_BADAL' }),
    face('f2', 3),
  ])
  assert.equal(findNextReviewFace(page, key(3), 'a', { ...ALL, kind: 'farsh' })?.entryId, 'f2')
  assert.equal(findNextReviewFace(page, key(3), 'a', { ...ALL, kind: 'usul' })?.entryId, 'u')
  const onlyUsulLeft = pageWith([face('a', 3), face('u', 3, { kind: 'usul', categoryCode: 'MADD_BADAL' })])
  assert.equal(findNextReviewFace(onlyUsulLeft, key(3), 'a', { ...ALL, kind: 'farsh' }), null)
})

test('deleted faces and faces still being saved are never offered; other words do not count', () => {
  const page = pageWith([face('a', 3), face('d', 3, { deleted: true }), face('tmp-1', 3), face('x', 4)])
  assert.equal(findNextReviewFace(page, key(3), 'a', ALL, (r) => r.entryId.startsWith('tmp-')), null)
})

// ── «معتمد آليًا» still has to be approved by hand ──────────────────────────────────────────────

const AUTO = { reviewStatus: 'reviewed', reviewSource: 'auto-nquran' } as const

test('an auto-approved face of the same word is offered next, a manually approved one is not', () => {
  const page = pageWith([face('a', 3), face('auto', 3, AUTO), face('manual', 3, { reviewStatus: 'reviewed' })])
  assert.equal(findNextReviewFace(page, key(3), 'a', ALL)?.entryId, 'auto')
  const done = pageWith([face('a', 3), face('manual', 3, { reviewStatus: 'reviewed' })])
  assert.equal(findNextReviewFace(done, key(3), 'a', ALL), null)
})

test('an auto-approved word is not skipped when moving to the next word, under a filter too', () => {
  const page = pageWith([
    at(2),
    at(4, { ...AUTO }),
    at(5, { kind: 'usul', categoryCode: 'MADD_BADAL', ...AUTO }),
    at(6, { reviewStatus: 'reviewed' }),
  ])
  assert.equal(findNextReviewWord(page, key(2), ALL)?.key, key(4))
  assert.equal(findNextReviewWord(page, key(2), { ...ALL, kind: 'usul' })?.key, key(5))
  assert.equal(findNextReviewWord(page, key(4), { ...ALL, kind: 'farsh' })?.key, key(2))
})
