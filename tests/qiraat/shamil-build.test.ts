import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const SCRIPT = new URL('../../scripts/qiraat/build_shamil_reference.py', import.meta.url).pathname
const COMMITTED = new URL('../../src/app/mushaf-1441/review/_lib/reference/shamil/', import.meta.url)

type Json = Record<string, unknown>

function entry(id: string, over: Json = {}): Json {
  return {
    entry_id: id, page: 3, surah: 2, ayahs: [9], words: [{ text: 'يَخْدَعُونَ', normalized: 'يخدعون' }],
    type: 'farsh', type_basis: 'x', category: 'الأصول/فرش', scope: 'this_word', source_text: 'نص', justification: null, flags: [], ...over,
  }
}

function record(entryId: string, wajh: number, over: Json = {}): Json {
  return {
    id: `${entryId}_w${wajh}`, entry_id: entryId, page: 3, surah: 2, ayahs: [9], words: [], type: 'farsh', category: 'الأصول/فرش',
    wajh, description: `وصف ${wajh}`, reading_text: null, condition: 'both', condition_basis: 'default', narrators: ['hafs'], readers: ['asim'], ...over,
  }
}

function writeSource(dir: string, name: string, entries: Json[], records: Json[]): string {
  const file = join(dir, name)
  writeFileSync(file, JSON.stringify({ meta: {}, readers: [], narrators: [], entries, records, poetry: [], indexes: {} }))
  return file
}

function run(out: string, files: string[], extra: string[] = []) {
  return spawnSync('python3', [SCRIPT, '--out', out, ...extra, ...files], { encoding: 'utf8' })
}

type OutEntry = { words: string[]; wajhs: Record<string, unknown>[]; [key: string]: unknown }
type OutIndex = { surahs: Record<string, unknown> }

function readSurah(path: string): OutEntry[] {
  return JSON.parse(readFileSync(path, 'utf8')) as OutEntry[]
}

function readIndex(path: string): OutIndex {
  return JSON.parse(readFileSync(path, 'utf8')) as OutIndex
}

test('merges overlapping files by id', () => {
  const dir = mkdtempSync(join(tmpdir(), 'shamil-'))
  const a = writeSource(dir, 'a.json', [entry('e1')], [record('e1', 1)])
  const b = writeSource(dir, 'b.json', [entry('e1'), entry('e2', { ayahs: [10] })], [record('e1', 1), record('e2', 1)])
  const out = join(dir, 'out')
  const r = run(out, [a, b])
  assert.equal(r.status, 0, r.stderr)
  const surah = readSurah(join(out, 'surah-002.json'))
  assert.equal(surah.length, 2)
  assert.deepEqual(readIndex(join(out, 'index.json')).surahs['2'], { pages: [3, 3], entries: 2, records: 2 })
})

test('later file wins on conflict and the id is reported', () => {
  const dir = mkdtempSync(join(tmpdir(), 'shamil-'))
  const a = writeSource(dir, 'a.json', [entry('e1')], [record('e1', 1)])
  const b = writeSource(dir, 'b.json', [entry('e1')], [record('e1', 1, { description: 'جديد' })])
  const out = join(dir, 'out')
  const r = run(out, [a, b])
  assert.equal(r.status, 0, r.stderr)
  assert.equal(readSurah(join(out, 'surah-002.json'))[0].wajhs[0].description, 'جديد')
  assert.match(r.stdout + r.stderr, /e1_w1/)
})

test('emits the documented entry shape with wajhs sorted by wajh', () => {
  const dir = mkdtempSync(join(tmpdir(), 'shamil-'))
  const src = writeSource(dir, 'a.json', [entry('e1', { flags: ['f'] })], [record('e1', 2, { reading_text: 'ر' }), record('e1', 1)])
  const out = join(dir, 'out')
  assert.equal(run(out, [src]).status, 0)
  const [e] = readSurah(join(out, 'surah-002.json'))
  assert.deepEqual(Object.keys(e).sort(), ['ayahs', 'category', 'entryId', 'flags', 'page', 'scope', 'sourceText', 'type', 'wajhs', 'words'])
  assert.deepEqual(e.words, ['يَخْدَعُونَ'])
  assert.deepEqual(e.wajhs.map((w) => w.wajh), [1, 2])
  assert.deepEqual(Object.keys(e.wajhs[1]).sort(), ['category', 'condition', 'conditionBasis', 'description', 'id', 'narrators', 'readingText', 'type', 'wajh'])
  assert.equal(e.wajhs[1].readingText, 'ر')
})

test('rejects an unknown narrator id', () => {
  const dir = mkdtempSync(join(tmpdir(), 'shamil-'))
  const src = writeSource(dir, 'a.json', [entry('e1')], [record('e1', 1, { narrators: ['nobody_x'] })])
  const r = run(join(dir, 'out'), [src])
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /nobody_x/)
})

test('rejects a record whose entry is missing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'shamil-'))
  const src = writeSource(dir, 'a.json', [entry('e1')], [record('e1', 1), record('ghost', 1)])
  const r = run(join(dir, 'out'), [src])
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /ghost/)
})

test('rejects an entry with no records', () => {
  const dir = mkdtempSync(join(tmpdir(), 'shamil-'))
  const src = writeSource(dir, 'a.json', [entry('e1'), entry('e2')], [record('e1', 1)])
  const r = run(join(dir, 'out'), [src])
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /e2/)
})

test('rejects a record with empty narrators', () => {
  const dir = mkdtempSync(join(tmpdir(), 'shamil-'))
  const src = writeSource(dir, 'a.json', [entry('e1')], [record('e1', 1, { narrators: [] })])
  const r = run(join(dir, 'out'), [src])
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /e1_w1/)
})

test('is idempotent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'shamil-'))
  const src = writeSource(dir, 'a.json', [entry('e1'), entry('e2', { page: 4 })], [record('e1', 1), record('e2', 1)])
  const o1 = join(dir, 'o1')
  const o2 = join(dir, 'o2')
  execFileSync('python3', [SCRIPT, '--out', o1, src])
  execFileSync('python3', [SCRIPT, '--out', o2, src])
  for (const f of ['surah-002.json', 'index.json']) {
    assert.equal(readFileSync(join(o1, f), 'utf8'), readFileSync(join(o2, f), 'utf8'))
  }
})

test('running with only new files keeps what the output already holds', () => {
  const dir = mkdtempSync(join(tmpdir(), 'shamil-'))
  const out = join(dir, 'out')
  const a = writeSource(dir, 'a.json', [entry('e1'), entry('e2', { page: 4 })], [record('e1', 1), record('e2', 1)])
  const b = writeSource(dir, 'b.json', [entry('e3', { page: 9 })], [record('e3', 1)])
  assert.equal(run(out, [a]).status, 0)
  const r = run(out, [b])
  assert.equal(r.status, 0, r.stderr)
  const surah = readSurah(join(out, 'surah-002.json'))
  assert.deepEqual(surah.map((e) => e.entryId), ['e1', 'e2', 'e3'])
  assert.deepEqual(readIndex(join(out, 'index.json')).surahs['2'], { pages: [3, 9], entries: 3, records: 3 })
})

test('a new input replaces the existing entry with the same id and keeps the rest', () => {
  const dir = mkdtempSync(join(tmpdir(), 'shamil-'))
  const out = join(dir, 'out')
  const a = writeSource(dir, 'a.json', [entry('e1'), entry('e2', { page: 4 })], [record('e1', 1), record('e2', 1)])
  const b = writeSource(dir, 'b.json', [entry('e1')], [record('e1', 1, { description: 'معدَّل' }), record('e1', 2)])
  assert.equal(run(out, [a]).status, 0)
  assert.equal(run(out, [b]).status, 0)
  const surah = readSurah(join(out, 'surah-002.json'))
  assert.equal(surah.length, 2)
  assert.deepEqual(surah[0].wajhs.map((w) => w.description), ['معدَّل', 'وصف 2'])
})

test('--fresh rebuilds from the inputs only and says what it dropped', () => {
  const dir = mkdtempSync(join(tmpdir(), 'shamil-'))
  const out = join(dir, 'out')
  const a = writeSource(dir, 'a.json', [entry('e1'), entry('e2', { page: 4 })], [record('e1', 1), record('e2', 1)])
  const b = writeSource(dir, 'b.json', [entry('e3', { page: 9 })], [record('e3', 1)])
  assert.equal(run(out, [a]).status, 0)
  const r = run(out, [b], ['--fresh'])
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(readSurah(join(out, 'surah-002.json')).map((e) => e.entryId), ['e3'])
  assert.match(r.stdout + r.stderr, /dropp\w+ 2/i)
})

test('committed surah-002.json has 220 entries / 738 wajhs and index lists pages [2,13]', () => {
  const surah = readSurah(new URL('surah-002.json', COMMITTED).pathname)
  assert.equal(surah.length, 220)
  assert.equal(surah.reduce((n, e) => n + e.wajhs.length, 0), 738)
  assert.deepEqual(readIndex(new URL('index.json', COMMITTED).pathname).surahs['2'], { pages: [2, 13], entries: 220, records: 738 })
})
