import assert from 'node:assert/strict'
import test from 'node:test'
import type { BookRecord, LiveEntry } from '../../scripts/qiraat/match-sources'
import {
  findCorroboration,
  generateAdditionsSql,
  generateRollbackSql,
  hasCompatibleWordCount,
  hasPlausibleEditDistance,
  hasRealReadingDifference,
  hasReliablePosition,
  isCleanArabicReading,
  isUnambiguousAndConflictFree,
  mergeNarrators,
  respectsNarratorOnceRule,
  sourceActionsCompatible,
  stripTatweel,
  type AcceptedEvidence,
  type AdditionOperation,
  type Corroboration,
} from '../../scripts/qiraat/farsh-additions'
import type { Phase1BookResult } from '../../scripts/qiraat/subcategory'

function record(overrides: Partial<BookRecord> = {}): BookRecord {
  return { n: ['Q08-R01'], kind: 'farsh', type: 'OMISSION', text: 'مَلِكِ', explain: 'قرأ بحذف الألف', note: '', wajh: '1',
    src: 'Abu Jafer.csv', row: 2, surah: 1, ayah: 4, w0: 1, w1: 1, hafs: 'مَـٰلِكِ',
    positions: ['1:4:1'], hafsWords: ['ملك'], ...overrides }
}

function entry(overrides: Partial<LiveEntry> = {}): LiveEntry {
  return { id: 'v-one', kind: 'variant', surah: 1, ayah: 4, word: 1, end_word: 1,
    base_text: 'مَـٰلِكِ', reading_text: 'مَلِكِ', authorities: [{ id: 'Q08-R01' }], ...overrides }
}

function corroboration(overrides: Partial<Corroboration> = {}): Corroboration {
  return { readers: ['أبو جعفر'], reading: 'قرأ بحذف الألف.', narratorIds: ['Q08-R01', 'Q08-R02'],
    sourceUrl: 'https://www.nquran.com/source', location: 'مالك', ref: '1:4:مالك', ...overrides }
}

function evidence(id: string, row: number): AcceptedEvidence {
  const rec = record({ n: [id], row })
  return { book: { src: rec.src, row, record: rec }, nquran: corroboration(), narrators: [id] }
}

test('position reliability has positive and negative cases, including OCR misalignment and Hamza.csv', () => {
  const word = { word: 1, text: 'مَـٰلِكِ' }
  assert.equal(hasReliablePosition(record(), word), true)
  assert.equal(hasReliablePosition(record({ hafs: 'لَهُ' }), word), false)
  assert.equal(hasReliablePosition(record({ src: 'Hamza.csv', positions: [] }), word), false)
})

test('nquran corroboration requires one non-baseline group containing every wanted narrator', () => {
  const groups = [corroboration()]
  assert.equal(findCorroboration(['Q08-R01'], groups)?.ref, '1:4:مالك')
  assert.equal(findCorroboration(['Q08-R01', 'Q07-R01'], groups), null)
  assert.equal(findCorroboration(['Q08-R01'], [corroboration({ reading: 'قرأ بالإدغام الكبير.' })]), null)
})

test('explicit source action words must agree while source silence remains compatible', () => {
  assert.equal(sourceActionsCompatible('قرأ بالكسر', 'قرأ بكسر الباء.'), true)
  assert.equal(sourceActionsCompatible('قرأ بالكسر', 'قرأ بضم الباء.'), false)
  assert.equal(sourceActionsCompatible('قراءة هذا الموضع', 'قرأ بضم الباء.'), true)
  assert.equal(sourceActionsCompatible('قرأ بالإسكان', 'قراءة هذا الموضع.'), false)
})

test('clean reading accepts Arabic letters and harakat after tatweel stripping and rejects OCR garbage', () => {
  assert.equal(stripTatweel('مَـٰلِكِ'), 'مَٰلِكِ')
  assert.equal(isCleanArabicReading('مَـٰلِكِ'), true)
  assert.equal(isCleanArabicReading('النَّهٍار..'), false)
  assert.equal(isCleanArabicReading('مَلِكِ 2'), false)
})

test('reading must differ from Hafs in letters or harakat', () => {
  assert.equal(hasRealReadingDifference('مَلِكِ', 'مَـٰلِكِ'), true)
  assert.equal(hasRealReadingDifference('مَـٰلِكِ', 'مَـٰلِكِ'), false)
})

test('edit distance accepts plausible variants and rejects distant OCR text', () => {
  assert.equal(hasPlausibleEditDistance('مَلِكِ', 'مَـٰلِكِ'), true)
  assert.equal(hasPlausibleEditDistance('النَّهَار', 'لَهُ'), false)
})

test('word-count rule accepts plus or minus one word only', () => {
  assert.equal(hasCompatibleWordCount('مَلِكِ', ['مالك']), true)
  assert.equal(hasCompatibleWordCount('كلمة كلمة كلمة', ['مالك']), false)
})

test('narrator-once rule blocks MISSING collisions and targets an equal-reading NARRATORS_MISSING entry', () => {
  assert.equal(respectsNarratorOnceRule('MISSING', ['Q08-R01'], record(), [entry()], []).ok, false)
  assert.equal(respectsNarratorOnceRule('MISSING', ['Q08-R02'], record(), [entry()], []).ok, true)
  const addition = respectsNarratorOnceRule('NARRATORS_MISSING', ['Q08-R02'], record(), [entry()], ['v-one'])
  assert.deepEqual(addition, { ok: true, targetEntryId: 'v-one' })
  assert.equal(respectsNarratorOnceRule('NARRATORS_MISSING', ['Q08-R02'], record(), [entry({ reading_text: 'قَوْل' })], ['v-one']).ok, false)
})

test('ambiguity and same-word narrator TEXT_CONFLICT each reject', () => {
  const row: Phase1BookResult = { record: record(), class: 'MISSING', matchedEntryIds: [], missingNarrators: ['Q08-R01'], ambiguous: false }
  assert.equal(isUnambiguousAndConflictFree(row, ['Q08-R01'], new Set()), true)
  assert.equal(isUnambiguousAndConflictFree({ ...row, ambiguous: true }, ['Q08-R01'], new Set()), false)
  assert.equal(isUnambiguousAndConflictFree(row, ['Q08-R01'], new Set(['1:4:1:Q08-R01'])), false)
})

test('merging evidence deduplicates narrators while retaining source-backed action text', () => {
  const merged = mergeNarrators([evidence('Q08-R01', 2), evidence('Q08-R02', 3), evidence('Q08-R01', 4)])
  assert.deepEqual(merged.map((item) => item.id), ['Q08-R01', 'Q08-R02'])
  assert.ok(merged.every((item) => item.action === 'قرأ بحذف الألف.'))
})

test('SQL quotes JSON, creates through the RPC, and narrator additions are guarded/idempotent', () => {
  const create: AdditionOperation = { operation: 'create', key: 'create', surah: 1, ayah: 4, w0: 1, w1: 1,
    readingText: 'مَلِكِ', variantType: 'omission', description: "قارئ: O'Neil", narrators: [], evidence: [],
    payload: { description: "قارئ: O'Neil", deviceId: 'auto-review' } }
  const add: AdditionOperation = { ...create, operation: 'add_narrators', key: 'add', entryId: "v-o'neil",
    narrators: [{ id: 'Q08-R02', action: "قرأ O'Neil", wajhOrder: 1, wajhNote: null }] }
  const sql = generateAdditionsSql([create, add])
  assert.ok(sql.includes('qiraat_review_create_entry'))
  assert.ok(sql.includes("O''Neil"))
  assert.ok(sql.includes('WHERE EXISTS'))
  assert.ok(sql.includes('AND NOT EXISTS'))
  assert.ok(sql.trimEnd().endsWith('COMMIT;'))
})

test('rollback materializes a guarded id list and only soft-deletes same-day auto-review entries', () => {
  const operation: AdditionOperation = { operation: 'create', key: 'x', surah: 1, ayah: 4, w0: 1, w1: 1,
    readingText: "مَلِكِ", variantType: 'omission', description: 'source', narrators: [], evidence: [] }
  const sql = generateRollbackSql([operation])
  assert.ok(sql.includes('target_ids AS'))
  assert.ok(sql.includes("e.device_id = 'auto-review'"))
  assert.ok(sql.includes('e.created_at >= current_date'))
  assert.ok(sql.includes('SET deleted_at = now()'))
})
