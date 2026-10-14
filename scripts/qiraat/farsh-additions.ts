// Phase 4: generate only corroborated, source-backed farsh additions from JSON snapshots.
// Usage: npx tsx scripts/qiraat/farsh-additions.ts <live.json> <gaps-books.json> <gaps-nquran.json> <outPrefix>

import { readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import type { NquranAyahEntry, NquranReaderGroup } from '../../src/app/mushaf-1441/review/_lib/nquranReference'
import { findNquranDifferencesForWord, resolveDifferenceGroups } from '../../src/app/mushaf-1441/review/_lib/nquranReference'
import { farshSubCategory, skeleton } from './auto-review-live'
import { classifyReadingSentence, composeExplanation, usableBookExplanation, type ComposeCandidate } from './explanations'
import { BOOK_TYPE_TO_VARIANT_TYPE, type Phase1BookResult } from './subcategory'
import { loadEntriesIndex, type AyahWord, type BookRecord, type LiveEntry } from './match-sources'

const ROOT = join(__dirname, '..', '..')
const ALLOWED_TYPES = new Set(['HARAKAH', 'LETTER', 'ADDITION', 'OMISSION', 'OTHER'])
const TATWEEL = /ـ/g

export interface Corroboration {
  readers: string[]
  reading: string
  narratorIds: string[]
  sourceUrl: string
  location: string
  ref: string
}

export interface AcceptedEvidence {
  book: { src: string; row: number; record: BookRecord }
  nquran: Corroboration
  narrators: string[]
}

export interface AdditionOperation {
  operation: 'create' | 'add_narrators'
  key: string
  entryId?: string
  surah: number
  ayah: number
  w0: number
  w1: number
  readingText: string
  variantType: string
  description: string
  narrators: { id: string; action: string; wajhOrder: number; wajhNote: string | null }[]
  evidence: AcceptedEvidence[]
  payload?: Record<string, unknown>
}

export interface RejectedCandidate {
  src: string
  row: number
  ref: string
  class: string
  reason: string
}

export function hasReliablePosition(record: BookRecord, quranWord: AyahWord | undefined): boolean {
  if (record.src.toLowerCase() === 'hamza.csv' || record.positions.length === 0 || record.w0 === null || !quranWord) return false
  const ownsPosition = record.positions.some((value) => value === `${record.surah}:${record.ayah}:${record.w0}`)
  const firstHafs = record.hafs.trim().split(/\s+/)[0] ?? ''
  return ownsPosition && Boolean(skeleton(firstHafs)) && skeleton(firstHafs) === skeleton(quranWord.text)
}

export function stripTatweel(value: string): string { return value.replace(TATWEEL, '') }

export function isCleanArabicReading(value: string): boolean {
  const clean = stripTatweel(value)
  if (!clean.trim()) return false
  return [...clean].every((char) => {
    if (/\s/u.test(char) || /\p{Mark}/u.test(char)) return true
    return /\p{Letter}/u.test(char) && /\p{Script=Arabic}/u.test(char)
  })
}

const readingWithMarks = (value: string) => stripTatweel(value).normalize('NFC')
  .replace(/[ٱأإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, '')

export function hasRealReadingDifference(reading: string, hafs: string): boolean {
  return skeleton(reading) !== skeleton(hafs) || readingWithMarks(reading) !== readingWithMarks(hafs)
}

export function levenshtein(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0]
    previous[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j]
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1))
      diagonal = above
    }
  }
  return previous[b.length]
}

export function hasPlausibleEditDistance(reading: string, hafs: string): boolean {
  const base = skeleton(hafs), variant = skeleton(reading)
  return levenshtein(base, variant) <= Math.max(3, base.length / 2)
}

export function hasCompatibleWordCount(reading: string, hafsWords: readonly string[]): boolean {
  const readingCount = reading.trim().split(/\s+/).filter(Boolean).length
  return Math.abs(readingCount - hafsWords.filter(Boolean).length) <= 1
}

export function findCorroboration(
  narrators: readonly string[], groups: readonly Corroboration[],
): Corroboration | null {
  return [...groups].filter((group) => classifyReadingSentence(group.reading).length === 0)
    .sort((a, b) => a.narratorIds.length - b.narratorIds.length || a.ref.localeCompare(b.ref))
    .find((group) => narrators.every((id) => group.narratorIds.includes(id))) ?? null
}

const ACTION_TERMS: Readonly<Record<string, readonly string[]>> = {
  fath: ['فتح', 'بالفتح', 'مفتوح'],
  damm: ['ضم', 'بالضم', 'مضموم'],
  kasr: ['كسر', 'بالكسر', 'مكسور'],
  sukun: ['إسكان', 'اسكان', 'بالسكون', 'ساكن'],
  tashdid: ['تشديد', 'بالتشديد', 'مشدد'],
  takhfif: ['تخفيف', 'بالتخفيف', 'مخفف'],
  addition: ['إثبات', 'اثبات', 'زيادة', 'بزيادة'],
  omission: ['حذف', 'إسقاط', 'اسقاط', 'بلا'],
}

function actionSignatures(value: string): Set<string> {
  const normalized = skeleton(value)
  return new Set(Object.entries(ACTION_TERMS)
    .filter(([, terms]) => terms.some((term) => normalized.includes(skeleton(term))))
    .map(([name]) => name))
}

/** Only rejects an explicit source contradiction. Silence on either side remains compatible. */
export function sourceActionsCompatible(bookExplanation: string | undefined, nquranSentence: string): boolean {
  const book = actionSignatures(bookExplanation ?? '')
  const nquran = actionSignatures(nquranSentence)
  if (book.size === 0) return true
  if (nquran.size === 0) return false
  return [...book].some((value) => nquran.has(value))
}

function overlapsWord(entry: LiveEntry, word: number): boolean {
  return entry.word <= word && (entry.end_word ?? entry.word) >= word
}

export function respectsNarratorOnceRule(
  className: string, narrators: readonly string[], record: BookRecord, entries: readonly LiveEntry[], matchedIds: readonly string[],
): { ok: boolean; targetEntryId?: string } {
  const atWord = entries.filter((entry) => entry.kind === 'variant' && entry.surah === record.surah && entry.ayah === record.ayah && overlapsWord(entry, record.w0!))
  const hasNarrator = (entry: LiveEntry, id: string) => entry.authorities.some((authority) => authority.id === id)
  if (className === 'MISSING') return { ok: !atWord.some((entry) => narrators.some((id) => hasNarrator(entry, id))) }
  const targets = atWord.filter((entry) => matchedIds.includes(entry.id) && skeleton(entry.reading_text ?? '') === skeleton(record.text))
  if (targets.length !== 1) return { ok: false }
  if (atWord.some((entry) => narrators.some((id) => hasNarrator(entry, id)))) return { ok: false }
  return { ok: true, targetEntryId: targets[0].id }
}

export function isUnambiguousAndConflictFree(
  row: Phase1BookResult, narrators: readonly string[], conflictKeys: ReadonlySet<string>,
): boolean {
  if (row.ambiguous || row.record.w0 === null) return false
  return !narrators.some((id) => conflictKeys.has(`${row.record.surah}:${row.record.ayah}:${row.record.w0}:${id}`))
}

function buildConflictKeys(rows: readonly Phase1BookResult[]): Set<string> {
  const keys = new Set<string>()
  for (const row of rows.filter((item) => item.class === 'TEXT_CONFLICT')) {
    const words = row.record.positions.map((value) => value.split(':').map(Number))
      .filter(([surah, ayah, word]) => surah === row.record.surah && ayah === row.record.ayah && Number.isInteger(word))
      .map(([, , word]) => word)
    for (const word of words) for (const id of row.record.n) keys.add(`${row.record.surah}:${row.record.ayah}:${word}:${id}`)
  }
  return keys
}

function nquranGroupsAtWord(record: BookRecord, word: AyahWord, ayahWords: readonly AyahWord[], ayah: NquranAyahEntry): Corroboration[] {
  const differences = findNquranDifferencesForWord(ayah.differences, word.text, { wordIndex: word.word, ayahWords })
  const output: Corroboration[] = []
  for (const difference of differences) for (const resolved of resolveDifferenceGroups(difference)) {
    if (resolved.unresolvedLabels.length > 0 || resolved.narratorIds.length === 0 || resolved.narratorIds.includes('Q05-R02')) continue
    output.push({ readers: resolved.group.readers, reading: resolved.group.reading, narratorIds: resolved.narratorIds,
      sourceUrl: ayah.sourceUrl, location: difference.location,
      ref: `${record.surah}:${record.ayah}:${difference.location}` })
  }
  return output
}

function bestExplanation(evidence: readonly AcceptedEvidence[]): AcceptedEvidence | null {
  return [...evidence].filter((item) => usableBookExplanation(item.book.record))
    .sort((a, b) => (b.book.record.explain?.length ?? 0) - (a.book.record.explain?.length ?? 0) ||
      a.book.src.localeCompare(b.book.src) || a.book.row - b.book.row)[0] ?? null
}

function composeDescription(evidence: readonly AcceptedEvidence[]): string | null {
  const best = bestExplanation(evidence)
  if (!best) return null
  const candidates: ComposeCandidate[] = [{ sentence: best.book.record.explain!.trim(), label: best.nquran.readers.join('، '),
    narrators: best.narrators, source: 'book' as const, ref: `${best.book.src}:${best.book.row}`,
    provenance: `${best.book.src}:${best.book.row}` }]
  const seen = new Set<string>()
  for (const item of evidence) {
    const key = `${item.nquran.readers.join('\u0000')}\u0000${item.nquran.reading}`
    if (seen.has(key)) continue
    seen.add(key)
    candidates.push({ sentence: item.nquran.reading, label: item.nquran.readers.join('، '), narrators: item.narrators,
      source: 'nquran' as const, ref: item.nquran.ref, provenance: 'nquran.com' })
  }
  return composeExplanation(candidates, 2000)?.text ?? null
}

export function mergeNarrators(evidence: readonly AcceptedEvidence[]): AdditionOperation['narrators'] {
  const byId = new Map<string, AdditionOperation['narrators'][number]>()
  for (const item of evidence) for (const id of item.narrators) if (!byId.has(id)) {
    const order = Number(item.book.record.wajh)
    byId.set(id, { id, action: item.nquran.reading, wajhOrder: Number.isInteger(order) && order >= 1 ? order : 1,
      wajhNote: item.book.record.note?.trim() || null })
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id))
}

const sqlEscape = (value: string) => value.replace(/'/g, "''")
const sqlLiteral = (value: string) => `'${sqlEscape(value)}'`

export function generateAdditionsSql(operations: readonly AdditionOperation[]): string {
  const lines = ['-- Qiraat Phase 4 corroborated farsh additions. Approval is deliberately separate.', 'BEGIN;',
    "SELECT set_config('app.device_id', 'auto-review', true);", '']
  for (const operation of operations) {
    if (operation.operation === 'create') {
      lines.push(`SELECT qiraat_review_create_entry('${sqlEscape(JSON.stringify(operation.payload))}'::jsonb);`)
      continue
    }
    for (const narrator of operation.narrators) {
      lines.push(`INSERT INTO qiraat_entry_authorities (entry_id, authority_id, action_ar, is_default, wajh_order, wajh_note, device_id)\n` +
        `SELECT ${sqlLiteral(operation.entryId!)}, ${sqlLiteral(narrator.id)}, ${sqlLiteral(narrator.action)}, ${narrator.wajhOrder === 1 ? 'true' : 'false'}, ${narrator.wajhOrder}, ${narrator.wajhNote ? sqlLiteral(narrator.wajhNote) : 'NULL'}, 'auto-review'\n` +
        `WHERE EXISTS (SELECT 1 FROM qiraat_entries e WHERE e.id = ${sqlLiteral(operation.entryId!)} AND e.deleted_at IS NULL)\n` +
        `AND NOT EXISTS (SELECT 1 FROM qiraat_entry_authorities ea WHERE ea.entry_id = ${sqlLiteral(operation.entryId!)} AND ea.authority_id = ${sqlLiteral(narrator.id)} AND ea.deleted_at IS NULL);`)
    }
  }
  lines.push('', 'COMMIT;', '')
  return lines.join('\n')
}

export function generateRollbackSql(operations: readonly AdditionOperation[]): string {
  const creates = operations.filter((item) => item.operation === 'create')
  if (creates.length === 0) return "-- No created entries in this batch.\nBEGIN;\nSELECT set_config('app.device_id', 'auto-review', true);\nCOMMIT;\n"
  const values = creates.map((item) => `(${item.surah}, ${item.ayah}, ${item.w0}, ${item.w1}, ${sqlLiteral(item.readingText)})`).join(',\n    ')
  return `-- Soft-delete only same-day auto-review entries matching this generated batch.\nBEGIN;\nSELECT set_config('app.device_id', 'auto-review', true);\nWITH generated_targets(surah, ayah, w0, w1, reading_text) AS (\n  VALUES\n    ${values}\n), target_ids AS (\n  SELECT e.id\n  FROM generated_targets g\n  JOIN qiraat_loci l ON l.surah_number = g.surah AND l.start_ayah = g.ayah AND l.start_word = g.w0\n    AND l.end_ayah = g.ayah AND l.end_word = g.w1\n  JOIN qiraat_entries e ON e.locus_id = l.id AND e.kind = 'variant' AND e.deleted_at IS NULL\n  JOIN qiraat_variant_details vd ON vd.entry_id = e.id AND vd.reading_text = g.reading_text\n  WHERE e.device_id = 'auto-review' AND e.created_at >= current_date AND e.created_at < current_date + interval '1 day'\n)\nUPDATE qiraat_entries SET deleted_at = now() WHERE id IN (SELECT id FROM target_ids) AND deleted_at IS NULL;\nCOMMIT;\n`
}

function seededSamples<T>(values: readonly T[], count: number): T[] {
  let state = 0x4f3a21c7
  return values.map((value) => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return { value, rank: state >>> 0 } })
    .sort((a, b) => a.rank - b.rank).slice(0, count).map((item) => item.value)
}

function renderSummary(operations: readonly AdditionOperation[], queue: readonly RejectedCandidate[], usulFamilies: Record<string, number>): string {
  const reasons = [...new Set(queue.map((item) => item.reason))].sort()
  const books = [...new Set(operations.flatMap((item) => item.evidence.map((e) => e.book.src)))].sort()
  const samples = seededSamples(operations, 25)
  return `${['# Qiraat Phase 4 corroborated farsh additions', '',
    `- Accepted new entries: ${operations.filter((item) => item.operation === 'create').length}`,
    `- Accepted narrator-addition operations: ${operations.filter((item) => item.operation === 'add_narrators').length}`,
    `- Narrators added to existing entries: ${operations.filter((item) => item.operation === 'add_narrators').reduce((sum, item) => sum + item.narrators.length, 0)}`,
    `- Rejected book rows: ${queue.length}`, '',
    '## Rejected by rule', '', '| Rule | Count |', '|---|---:|',
    ...reasons.map((reason) => `| ${reason} | ${queue.filter((item) => item.reason === reason).length} |`), '',
    '## Accepted evidence rows by book', '', '| Book | Count |', '|---|---:|',
    ...books.map((book) => `| ${book} | ${operations.flatMap((item) => item.evidence).filter((e) => e.book.src === book).length} |`), '',
    '## 25 deterministic random accepted samples', '', '| Operation | Reference | Book row | nquran location | Narrators |', '|---|---|---|---|---|',
    ...samples.map((item) => { const e = item.evidence[0]; return `| ${item.operation} | ${item.surah}:${item.ayah}:${item.w0}-${item.w1} | ${e.book.src}:${e.book.row} | ${e.nquran.ref} | ${item.narrators.map((n) => n.id).join(',')} |` }), '',
    '## Information only: nquran MISSING groups by sentence family', '', '| Family | Count |', '|---|---:|',
    ...Object.entries(usulFamilies).sort(([a], [b]) => a.localeCompare(b)).map(([family, count]) => `| ${family} | ${count} |`), '',
  ].join('\n')}\n`
}

const inputPath = (value: string) => isAbsolute(value) ? value : resolve(ROOT, value)

export function main(argv = process.argv.slice(2)): void {
  const [liveArg, booksArg, nquranGapsArg, outArg] = argv
  if (!liveArg || !booksArg || !nquranGapsArg || !outArg) {
    console.error('Usage: npx tsx scripts/qiraat/farsh-additions.ts <live.json> <gaps-books.json> <gaps-nquran.json> <outPrefix>')
    process.exitCode = 1
    return
  }
  const livePath = inputPath(liveArg)
  const entries = JSON.parse(readFileSync(livePath, 'utf8')) as LiveEntry[]
  const bookData = JSON.parse(readFileSync(inputPath(booksArg), 'utf8')) as { records: Phase1BookResult[] }
  const nquranGaps = JSON.parse(readFileSync(inputPath(nquranGapsArg), 'utf8')) as { groups: { class: string; record: { group: NquranReaderGroup } }[] }
  const index = loadEntriesIndex(livePath, join(ROOT, 'packages/quran-data/mushaf1441/fixtures/page-words'))
  const conflicts = buildConflictKeys(bookData.records)
  const nquranCache = new Map<number, NquranAyahEntry[]>()
  const prelim: (AcceptedEvidence & { class: string; record: BookRecord; targetEntryId?: string })[] = []
  const queue: RejectedCandidate[] = []
  const reject = (row: Phase1BookResult, reason: string) => queue.push({ src: row.record.src, row: row.record.row,
    ref: `${row.record.surah}:${row.record.ayah}:${row.record.w0 ?? '?'}`, class: row.class, reason })

  for (const row of bookData.records) {
    const record = row.record
    if (!['MISSING', 'NARRATORS_MISSING'].includes(row.class) || record.kind !== 'farsh' || !ALLOWED_TYPES.has(record.type.toUpperCase())) continue
    const narrators = row.class === 'NARRATORS_MISSING' ? row.missingNarrators : record.n
    const words = index.ayahWords.get(`${record.surah}:${record.ayah}`) ?? []
    const word = words.find((item) => item.word === record.w0)
    if (!hasReliablePosition(record, word)) { reject(row, 'position_reliability'); continue }
    let surahData = nquranCache.get(record.surah)
    if (!surahData) {
      surahData = JSON.parse(readFileSync(join(ROOT, 'src/app/mushaf-1441/review/_lib/reference/nquran', `surah-${String(record.surah).padStart(3, '0')}.json`), 'utf8')) as NquranAyahEntry[]
      nquranCache.set(record.surah, surahData)
    }
    const ayah = surahData.find((item) => item.ayah === record.ayah)
    const corroboration = ayah && word ? findCorroboration(narrators, nquranGroupsAtWord(record, word, words, ayah)) : null
    if (!corroboration) { reject(row, 'nquran_corroboration'); continue }
    if (!sourceActionsCompatible(record.explain, corroboration.reading)) { reject(row, 'source_action_conflict'); continue }
    if (!isCleanArabicReading(record.text)) { reject(row, 'clean_reading'); continue }
    const cleanReading = stripTatweel(record.text).trim().replace(/\s+/g, ' ')
    if (!hasRealReadingDifference(cleanReading, record.hafs)) { reject(row, 'real_reading_difference'); continue }
    if (!hasPlausibleEditDistance(cleanReading, record.hafs)) { reject(row, 'edit_distance'); continue }
    const hafsWords = record.hafsWords.length > 0 ? record.hafsWords : record.hafs.trim().split(/\s+/)
    if (!hasCompatibleWordCount(cleanReading, hafsWords)) { reject(row, 'word_count'); continue }
    const once = respectsNarratorOnceRule(row.class, narrators, record, entries, row.matchedEntryIds)
    if (!once.ok) { reject(row, 'narrator_once'); continue }
    if (!isUnambiguousAndConflictFree(row, narrators, conflicts)) { reject(row, 'ambiguity_or_text_conflict'); continue }
    prelim.push({ book: { src: record.src, row: record.row, record: { ...record, text: cleanReading } }, nquran: corroboration,
      narrators: [...new Set(narrators)].sort(), class: row.class, record: { ...record, text: cleanReading }, targetEntryId: once.targetEntryId })
  }

  const grouped = new Map<string, typeof prelim>()
  for (const item of prelim) {
    const key = item.class === 'MISSING'
      ? `create:${item.record.surah}:${item.record.ayah}:${item.record.w0}:${item.record.w1}:${skeleton(item.record.text)}`
      : `add:${item.targetEntryId}:${skeleton(item.record.text)}`
    const bucket = grouped.get(key) ?? []
    bucket.push(item)
    grouped.set(key, bucket)
  }

  const operations: AdditionOperation[] = []
  for (const [key, evidence] of grouped) {
    const description = composeDescription(evidence)
    if (!description) {
      for (const item of evidence) reject({ record: item.record, class: item.class as Phase1BookResult['class'], matchedEntryIds: [], missingNarrators: item.narrators, ambiguous: false }, 'book_explanation')
      continue
    }
    const first = evidence[0]
    const narrators = mergeNarrators(evidence)
    const variantType = BOOK_TYPE_TO_VARIANT_TYPE[first.record.type.toUpperCase()] ?? farshSubCategory(first.record.hafs, first.record.text)
    const operation: AdditionOperation = { operation: first.class === 'MISSING' ? 'create' : 'add_narrators', key,
      ...(first.targetEntryId ? { entryId: first.targetEntryId } : {}), surah: first.record.surah, ayah: first.record.ayah,
      w0: first.record.w0!, w1: first.record.w1 ?? first.record.w0!, readingText: first.record.text, variantType,
      description, narrators, evidence }
    if (operation.operation === 'create') operation.payload = {
      surah: operation.surah, ayah: operation.ayah, startWord: operation.w0, endAyah: operation.ayah, endWord: operation.w1,
      kind: 'farsh', readingText: operation.readingText,
      hafsText: (index.ayahWords.get(`${operation.surah}:${operation.ayah}`) ?? []).filter((word) => word.word >= operation.w0 && word.word <= operation.w1).map((word) => word.text).join(' '),
      description: operation.description, performanceNote: null, variantType: operation.variantType,
      notes: `sources: ${operation.evidence.map((item) => `${item.book.src}:${item.book.row}; ${item.nquran.sourceUrl}`).join(' | ')}`,
      deviceId: 'auto-review', narrators: operation.narrators,
    }
    operations.push(operation)
  }
  operations.sort((a, b) => a.key.localeCompare(b.key))
  queue.sort((a, b) => a.src.localeCompare(b.src) || a.row - b.row)

  const usulFamilies: Record<string, number> = {}
  for (const item of nquranGaps.groups.filter((group) => group.class === 'MISSING')) {
    const families = classifyReadingSentence(item.record.group.reading)
    for (const family of families.length > 0 ? families : ['unclassified']) usulFamilies[family] = (usulFamilies[family] ?? 0) + 1
  }
  const prefix = inputPath(outArg)
  writeFileSync(`${prefix}.json`, `${JSON.stringify(operations, null, 2)}\n`)
  writeFileSync(`${prefix}-queue.json`, `${JSON.stringify(queue, null, 2)}\n`)
  writeFileSync(`${prefix}.sql`, generateAdditionsSql(operations))
  writeFileSync(`${prefix}-rollback.sql`, generateRollbackSql(operations))
  const summary = renderSummary(operations, queue, usulFamilies)
  writeFileSync(`${prefix}-summary.md`, summary)
  process.stdout.write(summary.split('## 25 deterministic random accepted samples')[0])
}

if (process.argv[1]?.includes('farsh-additions.ts')) main()
