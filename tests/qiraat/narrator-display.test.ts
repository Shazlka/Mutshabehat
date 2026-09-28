import assert from 'node:assert/strict'
import test from 'node:test'
import {
  describeNarratorGroup,
  describeNarratorGroupText,
} from '../../src/app/mushaf-1441/review/_components/narratorDisplay'
import { CANONICAL_READERS } from '../../src/app/mushaf-1441/review/_components/ReaderNarratorSelector'

const NAFI = CANONICAL_READERS.find((r) => r.id === 'Q01')!
const IBN_KATHIR = CANONICAL_READERS.find((r) => r.id === 'Q02')!

test('both narrators of a reader collapse to the reader name+color', () => {
  const result = describeNarratorGroup([
    { id: NAFI.narrators[0].id, nameAr: NAFI.narrators[0].nameAr },
    { id: NAFI.narrators[1].id, nameAr: NAFI.narrators[1].nameAr },
  ])
  assert.equal(result.length, 1)
  assert.equal(result[0].key, NAFI.id)
  assert.equal(result[0].label, NAFI.nameAr)
  assert.equal(result[0].color, NAFI.color)
})

test('a reader with only one narrator present shows that narrator, colored with the reader color', () => {
  const result = describeNarratorGroup([{ id: NAFI.narrators[0].id, nameAr: NAFI.narrators[0].nameAr }])
  assert.equal(result.length, 1)
  assert.equal(result[0].key, NAFI.narrators[0].id)
  assert.equal(result[0].label, NAFI.narrators[0].nameAr)
  assert.equal(result[0].color, NAFI.color)
})

test('mixed input preserves order and both entries (one fully-collapsed reader + one single-narrator reader)', () => {
  const result = describeNarratorGroup([
    { id: NAFI.narrators[0].id, nameAr: NAFI.narrators[0].nameAr },
    { id: IBN_KATHIR.narrators[0].id, nameAr: IBN_KATHIR.narrators[0].nameAr },
    { id: NAFI.narrators[1].id, nameAr: NAFI.narrators[1].nameAr },
  ])
  assert.equal(result.length, 2)
  // Nafi's pair collapses at the position of its first appearance.
  assert.equal(result[0].key, NAFI.id)
  assert.equal(result[0].label, NAFI.nameAr)
  assert.equal(result[0].color, NAFI.color)
  // Ibn Kathir keeps its single narrator, colored with Ibn Kathir's color.
  assert.equal(result[1].key, IBN_KATHIR.narrators[0].id)
  assert.equal(result[1].label, IBN_KATHIR.narrators[0].nameAr)
  assert.equal(result[1].color, IBN_KATHIR.color)
})

test('empty input returns an empty array', () => {
  assert.deepEqual(describeNarratorGroup([]), [])
})

test('an unrecognized narrator id falls back defensively instead of throwing', () => {
  const result = describeNarratorGroup([{ id: 'UNKNOWN-ID', nameAr: 'غير معروف' }])
  assert.equal(result.length, 1)
  assert.equal(result[0].key, 'UNKNOWN-ID')
  assert.equal(result[0].label, 'غير معروف')
  assert.equal(result[0].color, '#888')
})

test('describeNarratorGroupText joins the collapsed labels with the Arabic comma separator', () => {
  const text = describeNarratorGroupText([
    { id: NAFI.narrators[0].id, nameAr: NAFI.narrators[0].nameAr },
    { id: NAFI.narrators[1].id, nameAr: NAFI.narrators[1].nameAr },
    { id: IBN_KATHIR.narrators[0].id, nameAr: IBN_KATHIR.narrators[0].nameAr },
  ])
  assert.equal(text, `${NAFI.nameAr}، ${IBN_KATHIR.narrators[0].nameAr}`)
})
