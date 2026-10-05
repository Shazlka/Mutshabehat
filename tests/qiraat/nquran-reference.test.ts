import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { normalizeArabic } from '../../src/lib/arabic'
import {
  ALL_NARRATOR_IDS,
  proposeNquranDecision,
  findNquranDifferencesForWord,
  resolveDifferenceGroups,
  resolveNquranReaderLabel,
  hasNquranReferenceForSurah,
  type NquranAyahEntry,
  type NquranDifference,
} from '../../src/app/mushaf-1441/review/_lib/nquranReference'
import type { ReviewRow } from '../../src/app/mushaf-1441/review/_lib/types'

function row(overrides: Partial<Omit<ReviewRow, 'narrators'>> & { narrators: { id: string }[] }): ReviewRow {
  const { narrators: narratorIds, ...rest } = overrides
  return {
    entryId: 'e1',
    locationId: 'l1',
    version: '1',
    kind: 'farsh',
    categoryCode: null,
    categoryNameAr: null,
    surah: 2,
    ayah: 2,
    startWord: 1,
    endAyah: 2,
    endWord: 1,
    startKey: '002:002:001',
    endKey: '002:002:001',
    page: 1,
    hafsText: 'هدى',
    readingText: null,
    uthmaniText: null,
    description: null,
    performanceNote: null,
    variantType: null,
    rulingText: null,
    options: null,
    notes: null,
    reviewStatus: 'unreviewed',
    locationReviewStatus: 'unreviewed',
    verificationStatus: 'unverified',
    legacyRef: null,
    entryOrder: 1,
    deleted: false,
    appliesWasl: true,
    appliesWaqf: true,
    hamzahDetail: null,
    flags: [],
    narrators: narratorIds.map((n) => ({ id: n.id, code: null, nameAr: n.id, action: null, wajhOrder: 1, wajhNote: null })),
    ...rest,
  }
}

test('resolveNquranReaderLabel: narrator, reader, remainder, and unresolved cases', () => {
  assert.deepEqual(resolveNquranReaderLabel('ورش عن نافع'), { kind: 'narrator', narratorId: 'Q01-R02' })
  assert.deepEqual(resolveNquranReaderLabel('السوسي عن أبي عمرو'), { kind: 'narrator', narratorId: 'Q03-R02' })
  assert.deepEqual(resolveNquranReaderLabel('حمزة'), { kind: 'reader', readerId: 'Q06' })
  assert.deepEqual(resolveNquranReaderLabel('خلف العاشر'), { kind: 'reader', readerId: 'Q10' })
  assert.deepEqual(resolveNquranReaderLabel('باقي الرواة'), { kind: 'remainder' })
  assert.equal(resolveNquranReaderLabel('قارئ غير معروف').kind, 'unresolved')
})

test('resolveDifferenceGroups: the remainder group is the complement of every explicit group', () => {
  const difference: NquranDifference = {
    location: 'هدى',
    groups: [
      { readers: ['ورش عن نافع'], reading: 'قرأ بالتقليل' },
      { readers: ['حمزة'], reading: 'قرأ بالإمالة' },
      { readers: ['باقي الرواة'], reading: 'قرؤوا بالفتح' },
    ],
  }
  const resolved = resolveDifferenceGroups(difference)
  assert.equal(resolved.length, 3)
  assert.deepEqual(resolved[0].narratorIds, ['Q01-R02'])
  assert.deepEqual(resolved[1].narratorIds, ['Q06-R01', 'Q06-R02'])
  const remainder = resolved[2]
  assert.equal(remainder.narratorIds.length, ALL_NARRATOR_IDS.length - 3)
  assert.ok(!remainder.narratorIds.includes('Q01-R02'))
  assert.ok(!remainder.narratorIds.includes('Q06-R01'))
  assert.ok(!remainder.narratorIds.includes('Q06-R02'))
})

test('proposeNquranDecision: matched when a REVIEWED row already covers the group', () => {
  const resolved = { group: { readers: ['ورش عن نافع'], reading: '' }, narratorIds: ['Q01-R02'], unresolvedLabels: [] }
  const existing = [row({ reviewStatus: 'reviewed', narrators: [{ id: 'Q01-R02' }] })]
  assert.equal(proposeNquranDecision(resolved, existing).status, 'matched')
})

test('proposeNquranDecision: recorded_unreviewed when the covering row is not yet reviewed', () => {
  const resolved = { group: { readers: ['ورش عن نافع'], reading: '' }, narratorIds: ['Q01-R02'], unresolvedLabels: [] }
  const existing = [row({ reviewStatus: 'unreviewed', narrators: [{ id: 'Q01-R02' }] })]
  assert.equal(proposeNquranDecision(resolved, existing).status, 'recorded_unreviewed')
})

test('proposeNquranDecision: partial when an existing row shares only some narrators', () => {
  const resolved = { group: { readers: ['حمزة'], reading: '' }, narratorIds: ['Q06-R01', 'Q06-R02'], unresolvedLabels: [] }
  const existing = [row({ reviewStatus: 'reviewed', narrators: [{ id: 'Q06-R01' }] })]
  assert.equal(proposeNquranDecision(resolved, existing).status, 'partial')
})

test('proposeNquranDecision: missing when no existing row shares any narrator', () => {
  const resolved = { group: { readers: ['حمزة'], reading: '' }, narratorIds: ['Q06-R01', 'Q06-R02'], unresolvedLabels: [] }
  const existing = [row({ reviewStatus: 'reviewed', narrators: [{ id: 'Q01-R01' }] })]
  assert.equal(proposeNquranDecision(resolved, existing).status, 'missing')
})

test('proposeNquranDecision: unresolved when the group itself has no resolvable narrator ids', () => {
  const resolved = { group: { readers: ['قارئ غير معروف'], reading: '' }, narratorIds: [], unresolvedLabels: ['قارئ غير معروف'] }
  assert.equal(proposeNquranDecision(resolved, []).status, 'unresolved')
})

// Real ayah words (page-word fixtures), so the tests use the Mushaf's own spellings.
function ayahWordsOf(surah: number, ayah: number): { word: number; text: string }[] {
  const dir = new URL('../../packages/quran-data/mushaf1441/fixtures/page-words/', import.meta.url)
  const out: { word: number; text: string }[] = []
  for (let page = 1; page <= 604; page += 1) {
    const data = JSON.parse(readFileSync(new URL(`page-${String(page).padStart(3, '0')}.json`, dir), 'utf8'))
    for (const line of data.lines)
      for (const w of line.words)
        if (w.charTypeName === 'word' && w.surahNumber === surah && w.ayahNumber === ayah) {
          out.push({ word: w.wordIndexInAyah, text: w.textUthmani })
        }
    if (out.length > 0 && page > 1 && data.lines.every((l: { words: { surahNumber: number; ayahNumber: number }[] }) => l.words.every((w) => w.surahNumber !== surah || w.ayahNumber !== ayah))) break
  }
  return out.sort((x, y) => x.word - y.word)
}

function locationsFor(surah: number, ayah: number, wordIndex: number): string[] {
  const entry = loadSurah(surah).find((e) => e.ayah === ayah)!
  const words = ayahWordsOf(surah, ayah)
  const text = words[wordIndex - 1].text
  return findNquranDifferencesForWord(entry.differences, text, { wordIndex, ayahWords: words }).map((d) => d.location)
}

const indexOfWord = (words: { word: number; text: string }[], plain: string) =>
  words.findIndex((w) => normalizeArabic(w.text).replace(/[ءا]/g, '') === normalizeArabic(plain).replace(/[ءا]/g, '')) + 1

test('findNquranDifferencesForWord: whole words only, a short location never matches inside another word', () => {
  const words = ayahWordsOf(2, 50)
  const bahr = indexOfWord(words, 'البحر')
  assert.ok(bahr > 0)
  // «آل» is a word of 2:50 («آل فرعون»); it must not be offered on «ٱلْبَحْرَ» or any word merely containing «ال».
  assert.equal(locationsFor(2, 50, bahr).includes('آل'), false)
  assert.equal(locationsFor(2, 50, indexOfWord(words, 'آل')).includes('آل'), true)
})

test('findNquranDifferencesForWord: «آل» (2:49) is not offered on «ذَٰلِكُم» although it contains «ال»', () => {
  const words = ayahWordsOf(2, 49)
  assert.equal(locationsFor(2, 49, indexOfWord(words, 'ذلكم')).includes('آل'), false)
  assert.equal(locationsFor(2, 49, indexOfWord(words, 'آل')).includes('آل'), true)
})

test('findNquranDifferencesForWord: صلة ميم الجمع «نساءكم وفي» belongs to the first word only', () => {
  const words = ayahWordsOf(2, 49)
  const nisaakum = indexOfWord(words, 'نساءكم')
  assert.ok(nisaakum > 0)
  assert.ok(locationsFor(2, 49, nisaakum).includes('نساءكم وفي'))
  assert.equal(locationsFor(2, 49, nisaakum + 1).includes('نساءكم وفي'), false)
})

test('findNquranDifferencesForWord: a phrase must occur in this ayah, not just share a word with it', () => {
  const differences: NquranDifference[] = [{ location: 'قلوبهم وعلى', groups: [] }]
  // 2:7 has «وَعَلَىٰ» twice (after «قُلُوبِهِمْ» and after «سَمْعِهِمْ»); only the first belongs to the phrase.
  const words = ayahWordsOf(2, 7)
  const keys = words.map((w) => normalizeArabic(w.text).replace(/[ءا]/g, ''))
  const first = keys.indexOf('وعلي') + 1
  const second = keys.indexOf('وعلي', first) + 1
  assert.ok(first > 0 && second > first)
  const offered = (wordIndex: number) =>
    findNquranDifferencesForWord(differences, words[wordIndex - 1].text, { wordIndex, ayahWords: words }).length
  assert.equal(offered(first), 1)
  assert.equal(offered(second), 0)
})

test('findNquranDifferencesForWord: a phrase running into the next ayah is offered on the words that end this one', () => {
  const words = ayahWordsOf(2, 7)
  const last = words.length
  assert.ok(locationsFor(2, 7, last).includes('عظيم ومن'))
})

test('findNquranDifferencesForWord: a modern spelling still finds the Mushaf word («الصلاة» = «ٱلصَّلَوٰةَ»)', () => {
  const words = ayahWordsOf(2, 3)
  const salat = words.findIndex((w) => normalizeArabic(w.text).startsWith('الصلو')) + 1
  assert.ok(salat > 0)
  assert.ok(locationsFor(2, 3, salat).includes('الصلاة'))
  assert.equal(locationsFor(2, 3, salat - 1).includes('الصلاة'), false)
})

test('findNquranDifferencesForWord: a location that is only a long vowel does not hang or match', () => {
  const words = ayahWordsOf(2, 3)
  const differences: NquranDifference[] = [{ location: 'يا', groups: [] }]
  assert.deepEqual(findNquranDifferencesForWord(differences, words[0].text, { wordIndex: 1, ayahWords: words }), [])
})

test('findNquranDifferencesForWord: without the ayah it still matches whole tokens only', () => {
  const differences: NquranDifference[] = [
    { location: 'آل', groups: [] },
    { location: 'فيه هدى', groups: [] },
  ]
  assert.deepEqual(findNquranDifferencesForWord(differences, 'ٱلْبَحْرَ').map((d) => d.location), [])
  assert.deepEqual(findNquranDifferencesForWord(differences, 'هُدًۭى').map((d) => d.location), ['فيه هدى'])
})

// ── Full dataset (all 114 surahs) ───────────────────────────────────────────────────────────────

const REFERENCE_DIR = new URL('../../src/app/mushaf-1441/review/_lib/reference/nquran/', import.meta.url)

function loadSurah(n: number): NquranAyahEntry[] {
  return JSON.parse(readFileSync(new URL(`surah-${String(n).padStart(3, '0')}.json`, REFERENCE_DIR), 'utf8'))
}

test('nquran reference covers exactly surahs 1..114', () => {
  assert.equal(hasNquranReferenceForSurah(1), true)
  assert.equal(hasNquranReferenceForSurah(114), true)
  assert.equal(hasNquranReferenceForSurah(0), false)
  assert.equal(hasNquranReferenceForSurah(115), false)
})

test('every surah file is complete: 6236 ayahs, contiguous, right surah number', () => {
  let total = 0
  for (let n = 1; n <= 114; n += 1) {
    const entries = loadSurah(n)
    assert.ok(entries.length > 0, `surah ${n} empty`)
    entries.forEach((entry, i) => {
      assert.equal(entry.surahNumber, n, `surah ${n} ayah ${i + 1} wrong surahNumber`)
      assert.equal(entry.ayah, i + 1, `surah ${n}: ayah gap at index ${i}`)
      assert.match(entry.sourceUrl, /^https:\/\/www\.nquran\.com\//)
    })
    total += entries.length
  }
  assert.equal(total, 6236)
})

test('every reader label in the whole dataset resolves, and every group maps to narrators', () => {
  const unresolved = new Set<string>()
  let emptyGroups = 0
  for (let n = 1; n <= 114; n += 1) {
    for (const entry of loadSurah(n)) {
      for (const difference of entry.differences) {
        for (const group of difference.groups) {
          for (const label of group.readers) {
            if (resolveNquranReaderLabel(label).kind === 'unresolved') unresolved.add(label)
          }
        }
        for (const resolved of resolveDifferenceGroups(difference)) {
          if (resolved.narratorIds.length === 0) emptyGroups += 1
        }
      }
    }
  }
  assert.deepEqual([...unresolved], [], 'unresolved reader labels')
  assert.equal(emptyGroups, 0, 'groups that resolve to no narrators')
})
