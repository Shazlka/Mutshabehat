import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  ALL_NARRATOR_IDS,
  proposeNquranDecision,
  rankDifferencesForWord,
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

test('rankDifferencesForWord: a difference whose location contains the word sorts first', () => {
  const differences: NquranDifference[] = [
    { location: 'الكافرين', groups: [] },
    { location: 'فيه هدى', groups: [] },
  ]
  const ranked = rankDifferencesForWord(differences, 'هدى')
  assert.equal(ranked[0].difference.location, 'فيه هدى')
  assert.equal(ranked[0].matchesWord, true)
  assert.equal(ranked[1].matchesWord, false)
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
