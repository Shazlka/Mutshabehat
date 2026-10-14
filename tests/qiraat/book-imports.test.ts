import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildBookImports,
  categoryForRecord,
  detectsMultipleReaders,
  garbageReason,
  generateBlockSql,
  splitIntoPageBlocks,
  type BookImport,
} from '../../scripts/qiraat/book-imports'
import type { LiveEntry } from '../../scripts/qiraat/match-sources'
import type { MushafIndex, ReanchoredBookRow, SourceBookRecord } from '../../scripts/qiraat/reanchor'

const allowed = new Set(['IMALAH_TAQLIL', 'TAGHLIZ_LAM', 'YAAT_IDAFA', 'YAAT_ZAWAID', 'USUL_SAKT', 'IDGHAM_KABIR', 'TARK_GHUNNA', 'WAQF_HAMZA', 'TAGHYIR_HAMZ', 'USUL_TASHIL'])
const distributions = new Map([['Q01-R01', new Set(['TAGHYIR_HAMZ'])], ['Q06-R01', new Set(['USUL_TASHIL'])]])

test('deterministic category table maps direct and keyword-refined rules', () => {
  assert.equal(categoryForRecord({ type: 'IMALAH', explain: 'شرح الإمالة', n: ['Q01-R01'] }, distributions, allowed), 'IMALAH_TAQLIL')
  assert.equal(categoryForRecord({ type: 'TAGHLIDH_LAM', explain: 'شرح التغليظ', n: ['Q01-R01'] }, distributions, allowed), 'TAGHLIZ_LAM')
  assert.equal(categoryForRecord({ type: 'YAAT_IDAFAH', explain: 'فتح ياء الإضافة', n: ['Q01-R01'] }, distributions, allowed), 'YAAT_IDAFA')
  assert.equal(categoryForRecord({ type: 'YAAT_ZAWAID', explain: 'إثبات ياء الزوائد', n: ['Q01-R01'] }, distributions, allowed), 'YAAT_ZAWAID')
  assert.equal(categoryForRecord({ type: 'HA_SAKT', explain: 'الوقف بهاء السكت', n: ['Q01-R01'] }, distributions, allowed), 'USUL_SAKT')
  assert.equal(categoryForRecord({ type: 'IDGHAM', explain: 'الإدغام الكبير', n: ['Q01-R01'] }, distributions, allowed), 'IDGHAM_KABIR')
  assert.equal(categoryForRecord({ type: 'IDGHAM', explain: 'إدغام التنوين بغير غنة', n: ['Q01-R01'] }, distributions, allowed), 'TARK_GHUNNA')
  assert.equal(categoryForRecord({ type: 'HAMZ', explain: 'تسهيل الهمزة', n: ['Q06-R01'] }, distributions, allowed), 'USUL_TASHIL')
})

test('a category outside live distinct codes is rejected', () => {
  assert.equal(categoryForRecord({ type: 'IMALAH', explain: 'شرح الإمالة', n: ['Q01-R01'] }, distributions, new Set()), null)
})

test('multi-reader Kisai paragraph is queued by detection', () => {
  assert.equal(detectsMultipleReaders({ n: ['Q07-R01', 'Q07-R02'],
    explain: 'إمالة نَجَّاهُمْ للكسائي وخَتَّارٍ للدوري، وإدغام التنوين بغير غنة للضرير' }), true)
})

test('garbage filters reject short, odd, and rule-name-only rows', () => {
  assert.equal(garbageReason({ text: 'اب', explain: 'شرح مصدر' }, true), 'GARBAGE_SHORT')
  assert.equal(garbageReason({ text: 'abcd', explain: 'شرح مصدر' }, true), 'GARBAGE_READING')
  assert.equal(garbageReason({ text: 'هوزا', explain: 'إمالة' }, true), 'RULE_NAME_ONLY')
})

function book(overrides: Partial<SourceBookRecord> = {}): SourceBookRecord {
  return { n: ['Q01-R01'], kind: 'farsh', type: 'LETTER', text: 'ابجر', explain: 'شرح مصدر صحيح', src: 'fixture.csv', row: 3,
    surah: 1, ayah: 1, w0: 1, w1: 1, hafs: 'ابجد', page: 1, srcPage: 4, positions: ['1:1:1'], hafsWords: ['ابجد'], ...overrides }
}
function row(record = book()): ReanchoredBookRow {
  return { record, class: 'MISSING', matchedEntryIds: [], missingNarrators: record.n, ambiguous: false,
    reanchor: { method: 'aligned', surah: 1, ayah: 1, w0: 1, w1: 1, page: 1 }, rematchClass: 'MISSING', correctedRecord: record }
}
const mushaf: MushafIndex = { ayahWords: new Map([['1:1', [{ word: 1, text: 'ابجد' }]]]), pageByWord: new Map([['1:1:1', 1]]) }

test('narrator-once rejects a second farsh reading for a narrator at the word', () => {
  const live: LiveEntry[] = [{ id: 'v1', kind: 'variant', surah: 1, ayah: 1, word: 1, base_text: 'ابجد', reading_text: 'حطي', authorities: [{ id: 'Q01-R01' }] }]
  const result = buildBookImports(live, [row()], mushaf, () => new Set(), { allowFarsh: true })
  assert.equal(result.imports.length, 0)
  assert.equal(result.queue[0].reason, 'NARRATOR_ONCE')
})

test('narrator-once also rejects competing readings generated in the same batch', () => {
  const second = book({ row: 4, text: 'ابجس' })
  const result = buildBookImports([], [row(), row(second)], mushaf, () => new Set(), { allowFarsh: true })
  assert.equal(result.imports.length, 0)
  assert.deepEqual(result.queue.map((item) => item.reason), ['GENERATED_NARRATOR_CONFLICT', 'GENERATED_NARRATOR_CONFLICT'])
})

function generatedImport(page: number, payload: Record<string, unknown> = { description: "قول القارئ" }): BookImport {
  return { key: `k${page}`, kind: 'farsh', page, surah: 1, ayah: 1, w0: 1, w1: 1, readingText: 'هوزا', variantType: 'consonant',
    narrators: [{ id: 'Q01-R01', action: 'شرح مصدر', wajhOrder: 1, wajhNote: null }], evidence: [], nquranConfirms: false, payload }
}

test('SQL quotes JSON safely and RPC duplicate behavior keeps generation idempotent', () => {
  const sql = generateBlockSql([generatedImport(1, { description: "قول ' مصدر" })])
  assert.match(sql, /قول '' مصدر/)
  assert.equal((sql.match(/qiraat_review_create_entry/g) ?? []).length, 1)
  assert.match(sql, /CREATE TEMP TABLE _auto_new_ids/)
  assert.match(sql, /created_at >= now\(\)/)
})

test('page blocks split at 50-page boundaries', () => {
  assert.deepEqual([...splitIntoPageBlocks([generatedImport(1), generatedImport(50), generatedImport(51), generatedImport(604)]).keys()],
    ['001-050', '051-100', '601-604'])
})

import { sameWordAsHafs, imalahLetterConsistent, wordHasHamza, explanationNamesOtherWord } from '../../scripts/qiraat/book-imports'

test('guards: a rule row must be about the same word as the Hafs word', () => {
  assert.equal(sameWordAsHafs('…نَجَّاهُمْ', 'خَتَّارٍ'), false)
  assert.equal(sameWordAsHafs('الْكَافِرِينَ', 'ٱلْكَـٰفِرِينَ'), true)
})
test('guards: imalah letter named in the explanation must be in the word', () => {
  assert.equal(imalahLetterConsistent('إمالة فتحة الجيم والألف', 'جَآءَ'), true)
  assert.equal(imalahLetterConsistent('إمالة فتحة الكاف والألف', 'وَإِذْ'), false)
  assert.equal(imalahLetterConsistent('قرأها الكسائي بالإمالة', 'وَإِذْ'), true)
})
test('guards: hamz rules need a hamza in the word', () => {
  assert.equal(wordHasHamza('يُؤْمِنُونَ'), true)
  assert.equal(wordHasHamza('الرَّحْمَنِ'), false)
})

test('guards: an explanation that quotes another vocalised word is rejected', () => {
  assert.equal(explanationNamesOtherWord('إدغام الثاء في التاء في لبثتم، وإمالة أَزْكَى', 'لَبِثْتُمْ'), true)
  assert.equal(explanationNamesOtherWord('مع الإمالة (آتَانِ)', 'ٱللَّهُ'), true)
  assert.equal(explanationNamesOtherWord('إمالة فتحة الجيم والألف', 'جَآءَ'), false)
  assert.equal(explanationNamesOtherWord('الوقف بهاء السكت', 'وَهُوَ'), false)
})
