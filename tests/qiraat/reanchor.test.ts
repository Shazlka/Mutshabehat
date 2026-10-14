import assert from 'node:assert/strict'
import test from 'node:test'
import { reanchorRecord, type MushafIndex } from '../../scripts/qiraat/reanchor'
import type { BookRecord } from '../../scripts/qiraat/match-sources'

function record(overrides: Partial<BookRecord> = {}): BookRecord {
  return { n: ['Q01-R01'], kind: 'farsh', type: 'HARAKAH', text: 'هوزا', explain: 'شرح مصدر', src: 'fixture.csv', row: 2,
    surah: 1, ayah: 2, w0: 2, w1: 2, hafs: 'ابجد', positions: ['1:2:2'], hafsWords: ['ابجد'], ...overrides }
}

function mushaf(values: Record<string, string[]>): MushafIndex {
  const ayahWords = new Map(Object.entries(values).map(([key, words]) => [key, words.map((text, index) => ({ word: index + 1, text }))]))
  const pageByWord = new Map<string, number>()
  for (const [key, words] of ayahWords) for (const word of words) pageByWord.set(`${key}:${word.word}`, 7)
  return { ayahWords, pageByWord }
}

test('aligned anchor uses the stated word', () => {
  assert.equal(reanchorRecord(record(), mushaf({ '1:2': ['هوز', 'ابجد'] })).method, 'aligned')
})

test('same-ayah anchor moves to the closest matching word', () => {
  const result = reanchorRecord(record(), mushaf({ '1:2': ['ابجد', 'هوز'] }))
  assert.deepEqual({ method: result.method, w0: result.w0 }, { method: 'same-ayah', w0: 1 })
})

test('neighbour anchor searches nearby ayahs', () => {
  const result = reanchorRecord(record(), mushaf({ '1:1': ['ابجد'], '1:2': ['هوز'] }))
  assert.deepEqual({ method: result.method, ayah: result.ayah }, { method: 'neighbour', ayah: 1 })
})

test('equidistant same-ayah candidates are ambiguous', () => {
  const result = reanchorRecord(record(), mushaf({ '1:2': ['ابجد', 'هوز', 'ابجد'] }))
  assert.equal(result.method, 'ambiguous')
})

test('multi-word Hafs phrase requires consecutive words', () => {
  const result = reanchorRecord(record({ hafs: 'ابجد هوز', w0: 1, w1: 2 }), mushaf({ '1:2': ['ابجد', 'هوز', 'حطي'] }))
  assert.deepEqual({ method: result.method, w0: result.w0, w1: result.w1, partial: result.partialPhrase },
    { method: 'aligned', w0: 1, w1: 2, partial: undefined })
})

test('missing Hafs word is not found', () => {
  assert.equal(reanchorRecord(record(), mushaf({ '1:2': ['هوز'] })).method, 'not-found')
})

