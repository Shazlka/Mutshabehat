import assert from 'node:assert/strict'
import test from 'node:test'
import {
  classifyReadingSentence,
  composeExplanation,
  entryFamily,
  explainEntry,
  type BookCandidate,
  type NquranCandidate,
  type SourceBookRecord,
} from '../../scripts/qiraat/explanations'
import { generateExplanationsSql } from '../../scripts/qiraat/explanations-sql'
import type { LiveEntry } from '../../scripts/qiraat/match-sources'

function entry(overrides: Partial<LiveEntry> = {}): LiveEntry {
  return {
    id: 'r-p002-test', kind: 'ruling', surah: 2, ayah: 1, word: 1, page: 2,
    base_text: 'ٱلرَّحْمَـٰنِ', category_code: 'IMALAH_TAQLIL', ruling_text: null,
    authorities: [{ id: 'Q01-R02' }], ...overrides,
  }
}

function record(overrides: Partial<SourceBookRecord> = {}): SourceBookRecord {
  return {
    n: ['Q01-R02'], kind: 'usul', type: 'IMALAH', text: 'ٱلرَّحْمَـٰنِ',
    explain: 'قرأ بالإمالة في هذا الموضع', src: 'warsh.csv', row: 9, srcPage: '12',
    surah: 2, ayah: 1, w0: 1, w1: 1, hafs: 'ٱلرَّحْمَـٰنِ',
    positions: ['2:1:1'], hafsWords: ['الرحمن'], ...overrides,
  }
}

function book(overrides: Partial<BookCandidate> = {}): BookCandidate {
  const source = record()
  return { sentence: source.explain!, record: source, narrators: ['Q01-R02'], ...overrides }
}

function nquran(overrides: Partial<NquranCandidate> = {}): NquranCandidate {
  return {
    sentence: 'قرأ بالإمالة في هذا الموضع.', label: 'ورش عن نافع', sourceUrl: 'https://www.nquran.com/example',
    ref: '2:1:الرحمن', narrators: ['Q01-R02'], families: ['imalah'], ...overrides,
  }
}

test('classifyReadingSentence documents and recognizes every supported topic family', () => {
  assert.deepEqual(classifyReadingSentence('قرأ بالإمالة والتقليل'), ['imalah'])
  assert.deepEqual(classifyReadingSentence('له صلة ميم الجمع'), ['mim_jam'])
  assert.deepEqual(classifyReadingSentence('في هاء الضمير صلة'), ['silah'])
  assert.deepEqual(classifyReadingSentence('قرأ بالسكت'), ['sakt'])
  assert.deepEqual(classifyReadingSentence('قرأ بالنقل'), ['naql'])
  assert.deepEqual(classifyReadingSentence('له تسهيل الهمزة'), ['hamz'])
  assert.deepEqual(classifyReadingSentence('قرأ بالإدغام بلا غنة'), ['idgham'])
  assert.deepEqual(classifyReadingSentence('قرأ بالمد والتوسط'), ['madd'])
  assert.deepEqual(classifyReadingSentence('قرأ بترقيق الراء'), ['tarqiq'])
  assert.deepEqual(classifyReadingSentence('أثبت ياء الإضافة'), ['yaat'])
  assert.deepEqual(classifyReadingSentence('وقفًا على المرسوم'), ['waqf'])
  assert.deepEqual(classifyReadingSentence('عبارة غير مصنفة'), [])
})

test('entry family precedence keeps overlapping madd and hamz codes in the intended topic', () => {
  assert.equal(entryFamily('MADD_BADAL'), 'madd')
  assert.equal(entryFamily('WAQF_HAMZA'), 'hamz')
  assert.equal(entryFamily('USUL_TASHIL'), 'hamz')
  assert.equal(entryFamily('WAQF_RASM'), 'waqf')
})

test('composition deduplicates only identical label/sentence pairs and appends provenance as the last line', () => {
  const composed = composeExplanation([
    { sentence: 'قرأ بالإمالة.', label: 'ورش', narrators: ['Q01-R02'], source: 'book', ref: 'book:1', provenance: 'كتاب ورش ص12' },
    { sentence: 'قرأ بالإمالة.', label: 'ورش', narrators: ['Q01-R02'], source: 'nquran', ref: 'nq:1', provenance: 'nquran.com' },
    { sentence: 'قرأ بالإمالة.', label: 'حمزة', narrators: ['Q06-R01'], source: 'nquran', ref: 'nq:2', provenance: 'nquran.com' },
  ])
  assert.ok(composed)
  assert.equal(composed!.used.length, 3)
  assert.deepEqual(new Set(composed!.used.map((item) => item.source)), new Set(['book', 'nquran']))
  assert.equal(composed!.text, 'ورش: قرأ بالإمالة.\nحمزة: قرأ بالإمالة.\n[المصدر: nquran.com؛ كتاب ورش ص12]')
  assert.equal(composed!.truncated, false)
})

test('mim-jam keeps both source groups and their exact nquran labels', () => {
  const result = explainEntry(entry({
    category_code: 'USUL_MIM_JAM',
    authorities: ['Q01-R01', 'Q02-R01', 'Q02-R02', 'Q08-R01', 'Q08-R02'].map((id) => ({ id })),
  }), [], [
    nquran({ label: 'قالون عن نافع', sentence: 'قرأ بصلة ميم الجمع وصلاً بخلف عنه.', narrators: ['Q01-R01'], families: ['mim_jam'] }),
    nquran({ label: 'أبو جعفر، ابن كثير', sentence: 'قرأ بصلة ميم الجمع وصلا.', narrators: ['Q08-R01', 'Q08-R02', 'Q02-R01', 'Q02-R02'], families: ['mim_jam'] }),
  ])
  assert.equal(result.explanation?.text, 'قالون عن نافع: قرأ بصلة ميم الجمع وصلاً بخلف عنه.\nأبو جعفر، ابن كثير: قرأ بصلة ميم الجمع وصلا.\n[المصدر: nquran.com]')
  assert.equal(result.explanation?.partial, undefined)
})

test('three-narrator sakt/naql attributes the two Hamza groups and marks uncovered Warsh partial', () => {
  const result = explainEntry(entry({
    category_code: 'USUL_SAKT',
    authorities: ['Q01-R02', 'Q06-R01', 'Q06-R02'].map((id) => ({ id })),
  }), [], [
    nquran({ label: 'خلف عن حمزة', sentence: 'قرأ بالسكت وصلاً، ووقف بالسكت والنقل.', narrators: ['Q06-R01'], families: ['sakt', 'naql'] }),
    nquran({ label: 'خلاد عن حمزة', sentence: 'قرأ بالسكت وعدمه وصلاً، ووقف بالسكت والنقل.', narrators: ['Q06-R02'], families: ['sakt', 'naql'] }),
  ])
  assert.deepEqual(result.explanation?.text.split('\n').slice(0, -1).map((line) => line.split(':')[0]),
    ['خلف عن حمزة', 'خلاد عن حمزة'])
  assert.equal(result.explanation?.partial, true)
})

test('partial is tagged when emitted groups do not cover every entry narrator', () => {
  const result = explainEntry(entry({ authorities: [{ id: 'Q01-R02' }, { id: 'Q06-R01' }] }), [], [nquran()])
  assert.equal(result.explanation?.partial, true)
})

test('truncation drops whole items from the end and never cuts a sentence', () => {
  const sentence = `جملة ${'طويلة '.repeat(8)}.`
  const composed = composeExplanation([
    { sentence, label: 'ورش', narrators: ['Q01-R02'], source: 'nquran', ref: '1', provenance: 'nquran.com' },
    { sentence: 'هذه الجملة يجب أن تسقط كاملة.', label: 'حمزة', narrators: ['Q06-R01'], source: 'nquran', ref: '2', provenance: 'nquran.com' },
  ], sentence.length + 35)
  assert.ok(composed)
  assert.equal(composed!.truncated, true)
  assert.ok(composed!.text.includes(sentence))
  assert.ok(!composed!.text.includes('هذه الجملة'))
  assert.ok(composed!.text.endsWith('[المصدر: nquran.com]'))
})

test('single-narrator single-group explanation may omit its label', () => {
  const result = explainEntry(entry(), [], [nquran()])
  assert.equal(result.explanation?.text, 'قرأ بالإمالة في هذا الموضع.\n[المصدر: nquran.com]')
})

test('never overwrite: an existing field emits no explanation', () => {
  const result = explainEntry(entry({ ruling_text: 'نص موجود' }), [book()], [nquran()])
  assert.equal(result.explanation, undefined)
  assert.equal(result.queue?.reason, 'field already has text')
})

test('topic mismatch is skipped when there is no usable book source', () => {
  const result = explainEntry(entry(), [], [nquran({ sentence: 'قرأ بالسكت.', families: ['sakt'] })])
  assert.equal(result.explanation, undefined)
  assert.match(result.queue?.reason ?? '', /topic mismatch/)
})

test('conflicting narrator readings are queued without text', () => {
  const farsh = entry({ kind: 'variant', category_code: null, description_ar: null, reading_text: 'مَلِكِ' })
  const first = book({ record: record({ kind: 'farsh', text: 'مَلِكِ' }) })
  const second = book({ record: record({ kind: 'farsh', text: 'مَالِكِ', row: 10 }) })
  const result = explainEntry(farsh, [first, second], [])
  assert.equal(result.explanation, undefined)
  assert.match(result.queue?.reason ?? '', /conflicting book readings/)
})

test('SQL quotes apostrophes and keeps additive idempotent guards', () => {
  const sql = generateExplanationsSql({
    "r-p002-o'neil": {
      field: 'ruling_text', text: "نص القارئ O'Neil [المصدر: nquran.com]", confidence: 'nquran',
      evidence: [{ source: 'nquran', ref: '2:1:x' }],
    },
    'v-p003-two': {
      field: 'description_ar', text: 'نص الكتاب [المصدر: كتاب ورش ص12]', confidence: 'book',
      evidence: [{ source: 'book', ref: 'warsh.csv:9' }],
    },
  })
  assert.ok(sql.includes("SELECT set_config('app.device_id', 'auto-review', true);"))
  assert.ok(sql.includes("O''Neil"))
  assert.ok(sql.includes("entry_id = 'r-p002-o''neil'"))
  assert.ok(sql.includes("btrim(coalesce(text_ar,'')) = ''"))
  assert.ok(sql.includes("btrim(coalesce(description_ar,'')) = ''"))
  assert.equal((sql.match(/UPDATE qiraat_ruling_details/g) ?? []).length, 1)
  assert.equal((sql.match(/UPDATE qiraat_variant_details/g) ?? []).length, 1)
  assert.ok(sql.trimEnd().endsWith('COMMIT;'))
})

test('SQL page range includes only ids in the requested pages', () => {
  const value = { field: 'ruling_text' as const, text: 'نص [المصدر: nquran.com]', confidence: 'nquran' as const, evidence: [] }
  const sql = generateExplanationsSql({ 'r-p002-a': value, 'r-p051-b': value }, [1, 10])
  assert.ok(sql.includes('r-p002-a'))
  assert.ok(!sql.includes('r-p051-b'))
})
