import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildEntriesIndex,
  classifyBookRecord,
  classifyNquranGroup,
  matchBookRecordToEntries,
  type BookRecord,
  type LiveEntry,
  type LocatedNquranDifference,
} from '../../scripts/qiraat/match-sources'

const WORDS = new Map([['1:1', [
  { word: 1, text: 'بِسْمِ' },
  { word: 2, text: 'ٱللَّهِ' },
  { word: 3, text: 'ٱلرَّحْمَـٰنِ' },
  { word: 4, text: 'ٱلرَّحِيمِ' },
]]])

function entry(overrides: Partial<LiveEntry> = {}): LiveEntry {
  return {
    id: 'entry-1',
    kind: 'variant',
    surah: 1,
    ayah: 1,
    word: 1,
    end_word: 1,
    base_text: 'بِسْمِ',
    reading_text: 'بِسْمِ',
    category_code: null,
    authorities: [{ id: 'Q01-R02' }],
    ...overrides,
  }
}

function record(overrides: Partial<BookRecord> = {}): BookRecord {
  return {
    n: ['Q01-R02'],
    kind: 'farsh',
    type: 'HARAKAH',
    text: 'بِسْمِ',
    src: 'fixture.csv',
    row: 2,
    surah: 1,
    ayah: 1,
    w0: 1,
    w1: 1,
    hafs: 'بِسْمِ',
    positions: ['1:1:1'],
    hafsWords: ['بسم'],
    ...overrides,
  }
}

function classify(book: BookRecord, entries: LiveEntry[]) {
  const matches = matchBookRecordToEntries(book, buildEntriesIndex(entries, WORDS))
  return { matches, classification: classifyBookRecord(book, matches) }
}

test('book MATCHED: same narrator and farsh reading', () => {
  assert.equal(classify(record(), [entry()]).classification.class, 'MATCHED')
})

test('book NARRATORS_MISSING: spelling matches but one source narrator is absent', () => {
  const result = classify(record({ n: ['Q01-R01', 'Q01-R02'] }), [entry()]).classification
  assert.equal(result.class, 'NARRATORS_MISSING')
  assert.deepEqual(result.missingNarrators, ['Q01-R01'])
})

test('book TEXT_CONFLICT: the same word and narrator have another spelling', () => {
  const result = classify(record({ text: 'ٱللَّهِ' }), [entry({ reading_text: 'ٱلرَّحْمَـٰنِ' })]).classification
  assert.equal(result.class, 'TEXT_CONFLICT')
})

test('book MISSING: no entry covers the source narrator', () => {
  const result = classify(record({ n: ['Q06-R01'] }), [entry()]).classification
  assert.equal(result.class, 'MISSING')
})

test('book UNMATCHABLE: neither positions nor Hafs words are usable', () => {
  const result = classify(record({ positions: [], hafsWords: [], w0: null, w1: null }), [entry()]).classification
  assert.equal(result.class, 'UNMATCHABLE')
})

test('Hamza-style records with no positions match by Hafs-word skeleton', () => {
  const book = record({ src: 'Hamza.csv', positions: [], w0: null, w1: null, hafsWords: ['بسم'] })
  assert.deepEqual(matchBookRecordToEntries(book, buildEntriesIndex([entry()], WORDS)).matches.map((item) => item.id), ['entry-1'])
})

test('family matching allows a farsh IMALAH book row to match an IMALAH_TAQLIL ruling', () => {
  const book = record({ type: 'IMALAH', text: 'ٱللَّهِ' })
  const ruling = entry({ kind: 'ruling', reading_text: null, category_code: 'IMALAH_TAQLIL' })
  assert.equal(classify(book, [ruling]).classification.class, 'MATCHED')
})

test('performance-only variant matches when its reading equals its Hafs base', () => {
  const book = record({ text: 'ٱللَّهِ' })
  const performanceOnly = entry({ reading_text: 'بِسْمِ' })
  assert.equal(classify(book, [performanceOnly]).classification.class, 'MATCHED')
})

test('ambiguous matches are reported and ordered by largest narrator overlap', () => {
  const book = record({ n: ['Q01-R01', 'Q01-R02'] })
  const smaller = entry({ id: 'smaller', authorities: [{ id: 'Q01-R02' }] })
  const larger = entry({ id: 'larger', authorities: [{ id: 'Q01-R01' }, { id: 'Q01-R02' }] })
  const matches = matchBookRecordToEntries(book, buildEntriesIndex([smaller, larger], WORDS))
  assert.equal(matches.ambiguous, true)
  assert.deepEqual(matches.matches.map((item) => item.id), ['larger', 'smaller'])
})

function difference(readers: string[]): LocatedNquranDifference {
  return {
    surah: 1,
    ayah: 1,
    wordNumbers: [1],
    location: 'بسم',
    groups: [{ readers, reading: 'fixture' }],
  }
}

test('nquran MATCHED: one entry covers every narrator in the resolved group', () => {
  const diff = difference(['حمزة'])
  const result = classifyNquranGroup(diff, diff.groups[0], buildEntriesIndex([
    entry({ authorities: [{ id: 'Q06-R01' }, { id: 'Q06-R02' }] }),
  ], WORDS))
  assert.equal(result?.class, 'MATCHED')
})

test('nquran NARRATORS_MISSING: an entry covers only part of the resolved group', () => {
  const diff = difference(['حمزة'])
  const result = classifyNquranGroup(diff, diff.groups[0], buildEntriesIndex([
    entry({ authorities: [{ id: 'Q06-R01' }] }),
  ], WORDS))
  assert.equal(result?.class, 'NARRATORS_MISSING')
  assert.deepEqual(result?.missingNarrators, ['Q06-R02'])
})

test('nquran MISSING: no entry covers any narrator in the resolved group', () => {
  const diff = difference(['حمزة'])
  assert.equal(classifyNquranGroup(diff, diff.groups[0], buildEntriesIndex([entry()], WORDS))?.class, 'MISSING')
})

test('nquran UNRESOLVED_READER: unknown source labels are not guessed', () => {
  const diff = difference(['قارئ غير معروف'])
  assert.equal(classifyNquranGroup(diff, diff.groups[0], buildEntriesIndex([], WORDS))?.class, 'UNRESOLVED_READER')
})

test('nquran baseline groups containing Hafs are skipped', () => {
  const diff = difference(['حفص عن عاصم'])
  assert.equal(classifyNquranGroup(diff, diff.groups[0], buildEntriesIndex([], WORDS)), null)
})
