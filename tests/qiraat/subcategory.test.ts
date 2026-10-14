import assert from 'node:assert/strict'
import test from 'node:test'
import type { BookRecord, LiveEntry } from '../../scripts/qiraat/match-sources'
import {
  bookTypeSupportsDerivation,
  generateSubcategorySql,
  isHumanApproved,
  proposeSubcategory,
  type Phase1BookResult,
} from '../../scripts/qiraat/subcategory'

function entry(overrides: Partial<LiveEntry> = {}): LiveEntry {
  return { id: 'v-one', kind: 'variant', status: 'unreviewed', review_source: null, device_id: 'seed',
    surah: 1, ayah: 4, word: 1, end_word: 1, base_text: 'قَالَ', reading_text: 'قَلَ',
    variant_type: 'other', authorities: [{ id: 'Q08-R01' }], ...overrides }
}

function record(overrides: Partial<BookRecord> = {}): BookRecord {
  return { n: ['Q08-R01'], kind: 'farsh', type: 'OMISSION', text: 'قَلَ', src: 'book.csv', row: 2,
    surah: 1, ayah: 4, w0: 1, w1: 1, hafs: 'قَالَ', positions: ['1:4:1'], hafsWords: ['قال'], ...overrides }
}

function phase1(overrides: Partial<Phase1BookResult> = {}): Phase1BookResult {
  return { record: record(), class: 'MATCHED', matchedEntryIds: ['v-one'], missingNarrators: [], ambiguous: false, ...overrides }
}

test('book type agreement accepts exact derivation and special vowel families only', () => {
  assert.equal(bookTypeSupportsDerivation('OMISSION', 'omission'), 'omission')
  assert.equal(bookTypeSupportsDerivation('HAMZ', 'vowel'), 'hamza')
  assert.equal(bookTypeSupportsDerivation('LETTER', 'vowel'), null)
  assert.equal(bookTypeSupportsDerivation('WAQF', 'vowel'), null)
})

test('proposal requires an unambiguous Phase 1 match whose type agrees', () => {
  assert.equal(proposeSubcategory(entry(), [phase1()]).proposal?.to, 'omission')
  assert.match(proposeSubcategory(entry(), [phase1({ ambiguous: true })]).queue?.reason ?? '', /no unambiguous/)
})

test('human-approved rows are skipped but reviewed bulk rows remain eligible', () => {
  const manual = entry({ status: 'reviewed', review_source: null, device_id: 'iphone' })
  const bulk = entry({ status: 'reviewed', review_source: null, device_id: 'bulk-import' })
  assert.equal(isHumanApproved(manual), true)
  assert.equal(isHumanApproved(bulk), false)
  assert.equal(proposeSubcategory(manual, [phase1()]).proposal, undefined)
  assert.equal(proposeSubcategory(bulk, [phase1()]).proposal?.to, 'omission')
})

test('subcategory SQL quotes ids and remains guarded by variant_type other', () => {
  const sql = generateSubcategorySql([{ entryId: "v-o'neil", ref: '1:4:1', from: 'other', to: 'omission', derived: 'omission', evidence: [] }])
  assert.ok(sql.includes("set_config('app.device_id', 'auto-review', true)"))
  assert.ok(sql.includes("entry_id = 'v-o''neil'"))
  assert.ok(sql.includes("AND variant_type = 'other'"))
  assert.ok(sql.trimEnd().endsWith('COMMIT;'))
})
