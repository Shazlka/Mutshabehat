// Phase 4b: prove book anchors against Mushaf-1441, then re-run the Phase 1 matcher.
// Usage: npx tsx scripts/qiraat/reanchor.ts <live.json> <records.json> <gaps-books.json> <outPrefix>

import { readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { skeleton } from './auto-review-live'
import {
  classifyBookRecord,
  loadEntriesIndex,
  matchBookRecordToEntries,
  type AyahWord,
  type BookClassification,
  type BookRecord,
  type EntriesIndex,
  type LiveEntry,
} from './match-sources'

const ROOT = join(__dirname, '..', '..')

export type ReanchorMethod = 'aligned' | 'same-ayah' | 'neighbour' | 'ambiguous' | 'not-found' | 'no-hafs'
export type RematchClass = 'MATCHED_AFTER_REANCHOR' | 'NARRATORS_MISSING' | 'TEXT_CONFLICT' | 'MISSING' |
  'AMBIGUOUS' | 'NOT_FOUND' | 'NO_HAFS'

export interface PositionOverride { surah: number; ayah: number; w0: number; w1: number }
export type SourceBookRecord = BookRecord & { page?: string | number; srcPage?: string | number }

export interface ReanchorResult {
  method: ReanchorMethod
  surah?: number
  ayah?: number
  w0?: number
  w1?: number
  page?: number
  partialPhrase?: true
  candidates?: PositionOverride[]
}

export interface Phase1BookRow {
  record: SourceBookRecord
  class: string
  matchedEntryIds: string[]
  missingNarrators: string[]
  ambiguous: boolean
}

export interface ReanchoredBookRow extends Phase1BookRow {
  reanchor: ReanchorResult
  rematchClass: RematchClass
  rematch?: BookClassification
  correctedRecord?: BookRecord
}

export interface MushafIndex {
  ayahWords: Map<string, AyahWord[]>
  pageByWord: Map<string, number>
}

const key = (surah: number, ayah: number) => `${surah}:${ayah}`
const wordKey = (surah: number, ayah: number, word: number) => `${surah}:${ayah}:${word}`

/** Comparison form required by Phase 4b: existing skeleton, letters only, with seated hamza folded. */
export function anchorSkeleton(value: string): string {
  return skeleton(value).replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/[^ء-غف-ي]/g, '')
}

function sourceHafsWords(record: BookRecord): string[] {
  const raw = record.hafs.trim().split(/\s+/).filter(Boolean)
  return (raw.length > 0 ? raw : record.hafsWords).map(anchorSkeleton).filter(Boolean)
}

function phraseMatches(words: readonly AyahWord[], startIndex: number, wanted: readonly string[]): boolean {
  if (wanted.length === 0 || startIndex + wanted.length > words.length) return false
  return wanted.every((part, offset) => anchorSkeleton(words[startIndex + offset].text) === part)
}

function candidatesInAyah(words: readonly AyahWord[], wanted: readonly string[]): PositionOverride[] {
  if (wanted.length === 0) return []
  const output: PositionOverride[] = []
  for (let index = 0; index < words.length; index += 1) {
    if (!phraseMatches(words, index, wanted)) continue
    const first = words[index]
    const last = words[index + wanted.length - 1]
    output.push({ surah: 0, ayah: 0, w0: first.word, w1: last.word })
  }
  return output
}

function nearestCandidate(candidates: readonly PositionOverride[], originalWord: number | null):
  { value?: PositionOverride; ambiguous: boolean } {
  if (candidates.length === 0) return { ambiguous: false }
  if (originalWord === null) return candidates.length === 1 ? { value: candidates[0], ambiguous: false } : { ambiguous: true }
  const distance = Math.min(...candidates.map((candidate) => Math.abs(candidate.w0 - originalWord)))
  const nearest = candidates.filter((candidate) => Math.abs(candidate.w0 - originalWord) === distance)
  return nearest.length === 1 ? { value: nearest[0], ambiguous: false } : { ambiguous: true }
}

function locate(
  record: BookRecord,
  mushaf: MushafIndex,
  wanted: readonly string[],
): { result?: ReanchorResult; ambiguous?: PositionOverride[] } {
  const currentWords = mushaf.ayahWords.get(key(record.surah, record.ayah)) ?? []
  const originalIndex = currentWords.findIndex((word) => word.word === record.w0)
  if (originalIndex >= 0 && phraseMatches(currentWords, originalIndex, wanted)) {
    const last = currentWords[originalIndex + wanted.length - 1]
    return { result: { method: 'aligned', surah: record.surah, ayah: record.ayah,
      w0: currentWords[originalIndex].word, w1: last.word } }
  }

  const same = candidatesInAyah(currentWords, wanted).map((candidate) => ({ ...candidate, surah: record.surah, ayah: record.ayah }))
  const nearest = nearestCandidate(same, record.w0)
  if (nearest.ambiguous) return { ambiguous: same }
  if (nearest.value) return { result: { method: 'same-ayah', ...nearest.value } }

  for (const offset of [-1, 1, -2, 2, -3, 3]) {
    const ayah = record.ayah + offset
    if (ayah < 1) continue
    const words = mushaf.ayahWords.get(key(record.surah, ayah)) ?? []
    const matches = candidatesInAyah(words, wanted).map((candidate) => ({ ...candidate, surah: record.surah, ayah }))
    if (matches.length === 1) return { result: { method: 'neighbour', ...matches[0] } }
    if (matches.length > 1) return { ambiguous: matches }
  }
  return {}
}

export function reanchorRecord(record: BookRecord, mushaf: MushafIndex): ReanchorResult {
  const phrase = sourceHafsWords(record)
  if (phrase.length === 0) return { method: 'no-hafs' }
  const full = locate(record, mushaf, phrase)
  if (full.ambiguous) return { method: 'ambiguous', candidates: full.ambiguous }
  if (full.result) {
    const result = full.result
    return { ...result, page: mushaf.pageByWord.get(wordKey(result.surah!, result.ayah!, result.w0!)) }
  }
  if (phrase.length > 1) {
    const first = locate(record, mushaf, phrase.slice(0, 1))
    if (first.ambiguous) return { method: 'ambiguous', partialPhrase: true, candidates: first.ambiguous }
    if (first.result) {
      const result = first.result
      return { ...result, partialPhrase: true,
        page: mushaf.pageByWord.get(wordKey(result.surah!, result.ayah!, result.w0!)) }
    }
  }
  return { method: 'not-found' }
}

interface WordsPage {
  lines: { words: { surahNumber: number; ayahNumber: number; wordIndexInAyah: number; textUthmani: string; charTypeName: string; pageNumber: number }[] }[]
}

export function loadMushafIndex(pageWordsDir: string): MushafIndex {
  const ayahWords = new Map<string, AyahWord[]>()
  const pageByWord = new Map<string, number>()
  for (let page = 1; page <= 604; page += 1) {
    const data = JSON.parse(readFileSync(join(pageWordsDir, `page-${String(page).padStart(3, '0')}.json`), 'utf8')) as WordsPage
    for (const line of data.lines) for (const word of line.words) {
      if (word.charTypeName !== 'word') continue
      const bucket = ayahWords.get(key(word.surahNumber, word.ayahNumber)) ?? []
      if (!bucket.some((item) => item.word === word.wordIndexInAyah)) bucket.push({ word: word.wordIndexInAyah, text: word.textUthmani })
      ayahWords.set(key(word.surahNumber, word.ayahNumber), bucket)
      pageByWord.set(wordKey(word.surahNumber, word.ayahNumber, word.wordIndexInAyah), word.pageNumber || page)
    }
  }
  for (const words of ayahWords.values()) words.sort((a, b) => a.word - b.word)
  return { ayahWords, pageByWord }
}

export function correctedBookRecord(record: SourceBookRecord, anchor: ReanchorResult): SourceBookRecord | undefined {
  if (anchor.surah === undefined || anchor.ayah === undefined || anchor.w0 === undefined || anchor.w1 === undefined) return undefined
  return { ...record, surah: anchor.surah, ayah: anchor.ayah, w0: anchor.w0, w1: anchor.w1,
    positions: Array.from({ length: anchor.w1 - anchor.w0 + 1 }, (_, index) => `${anchor.surah}:${anchor.ayah}:${anchor.w0! + index}`),
    ...(anchor.page ? { page: String(anchor.page).padStart(3, '0') } : {}) }
}

export function reanchorAndRematch(rows: readonly Phase1BookRow[], index: EntriesIndex, mushaf: MushafIndex): ReanchoredBookRow[] {
  return rows.filter((row) => row.class !== 'MATCHED').map((row) => {
    const reanchor = reanchorRecord(row.record, mushaf)
    const failure = reanchor.method === 'ambiguous' ? 'AMBIGUOUS' : reanchor.method === 'not-found' ? 'NOT_FOUND' :
      reanchor.method === 'no-hafs' ? 'NO_HAFS' : null
    if (failure) return { ...row, reanchor, rematchClass: failure }
    const correctedRecord = correctedBookRecord(row.record, reanchor)!
    // A corrected copy is the position override; the Phase 1 matcher stays untouched.
    const rematch = classifyBookRecord(correctedRecord, matchBookRecordToEntries(correctedRecord, index))
    return { ...row, reanchor, correctedRecord, rematch,
      rematchClass: rematch.class === 'MATCHED' ? 'MATCHED_AFTER_REANCHOR' : rematch.class as RematchClass }
  })
}

export interface LiveAnchorMismatch { id: string; ref: string; baseText: string; mushafText: string }
export function findLiveAnchorMismatches(entries: readonly LiveEntry[], mushaf: MushafIndex): LiveAnchorMismatch[] {
  const output: LiveAnchorMismatch[] = []
  for (const entry of entries) {
    const endAyah = (entry as LiveEntry & { end_ayah?: number | null }).end_ayah ?? entry.ayah
    const end = entry.end_word ?? entry.word
    const words: AyahWord[] = []
    for (let ayah = entry.ayah; ayah <= endAyah; ayah += 1) {
      words.push(...(mushaf.ayahWords.get(key(entry.surah, ayah)) ?? []).filter((word) =>
        (ayah > entry.ayah || word.word >= entry.word) && (ayah < endAyah || word.word <= end)))
    }
    const mushafText = words.map((word) => word.text).join(' ')
    if (anchorSkeleton(entry.base_text) !== anchorSkeleton(mushafText)) output.push({ id: entry.id,
      ref: `${entry.surah}:${entry.ayah}:${entry.word}-${endAyah}:${end}`, baseText: entry.base_text, mushafText })
  }
  return output
}

function counts<T extends string>(values: readonly T[]): Record<string, number> {
  return Object.fromEntries([...new Set(values)].sort().map((value) => [value, values.filter((item) => item === value).length]))
}
function md(value: unknown): string { return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ') }
function renderSummary(rows: readonly ReanchoredBookRow[], mismatches: readonly LiveAnchorMismatch[]): string {
  const methods = counts(rows.map((row) => row.reanchor.method))
  const classes = counts(rows.map((row) => row.rematchClass))
  const sources = [...new Set(rows.map((row) => row.record.src))].sort()
  const narrators = [...new Set(rows.flatMap((row) => row.record.n))].sort()
  const classNames = [...new Set(rows.map((row) => row.rematchClass))].sort()
  const lines = ['# Phase 4b book re-anchor and re-match', '', `- Rows processed: ${rows.length}`,
    `- MISSING after re-match: ${classes.MISSING ?? 0}`, `- Live anchor mismatches (report only): ${mismatches.length}`, '',
    '## Re-anchor methods', '', '| Method | Count |', '|---|---:|', ...Object.entries(methods).map(([name, count]) => `| ${name} | ${count} |`), '',
    '## Re-match classes', '', '| Class | Count |', '|---|---:|', ...Object.entries(classes).map(([name, count]) => `| ${name} | ${count} |`), '',
    '## Per book', '', '| Book | aligned | same-ayah | neighbour | ambiguous | not-found | no-hafs |', '|---|---:|---:|---:|---:|---:|---:|',
    ...sources.map((source) => `| ${md(source)} | ${['aligned', 'same-ayah', 'neighbour', 'ambiguous', 'not-found', 'no-hafs'].map((method) => rows.filter((row) => row.record.src === source && row.reanchor.method === method).length).join(' | ')} |`), '',
    '## Re-match class by book', '', `| Book | ${classNames.join(' | ')} |`, `|---|${classNames.map(() => '---:').join('|')}|`,
    ...sources.map((source) => `| ${md(source)} | ${classNames.map((className) => rows.filter((row) => row.record.src === source && row.rematchClass === className).length).join(' | ')} |`), '',
    '## Re-match class by narrator', '', `| Narrator | ${classNames.join(' | ')} |`, `|---|${classNames.map(() => '---:').join('|')}|`,
    ...narrators.map((narrator) => `| ${narrator} | ${classNames.map((className) => rows.filter((row) => row.record.n.includes(narrator) && row.rematchClass === className).length).join(' | ')} |`), '']
  for (const method of ['aligned', 'same-ayah', 'neighbour', 'ambiguous', 'not-found', 'no-hafs'] as ReanchorMethod[]) {
    lines.push(`## 20 ${method} samples`, '', '| Book row | Original | Corrected | Partial phrase |', '|---|---|---|---|')
    for (const row of rows.filter((item) => item.reanchor.method === method).slice(0, 20)) lines.push(
      `| ${md(row.record.src)}:${row.record.row} | ${row.record.surah}:${row.record.ayah}:${row.record.w0 ?? '?'} | ${row.reanchor.surah ? `${row.reanchor.surah}:${row.reanchor.ayah}:${row.reanchor.w0}-${row.reanchor.w1}` : '—'} | ${row.reanchor.partialPhrase ? 'yes' : 'no'} |`)
    lines.push('')
  }
  return `${lines.join('\n')}\n`
}

const inputPath = (value: string) => isAbsolute(value) ? value : resolve(ROOT, value)
export function main(argv = process.argv.slice(2)): void {
  const [liveArg, recordsArg, gapsArg, outArg] = argv
  if (!liveArg || !recordsArg || !gapsArg || !outArg) {
    console.error('Usage: npx tsx scripts/qiraat/reanchor.ts <live.json> <records.json> <gaps-books.json> <outPrefix>')
    process.exitCode = 1; return
  }
  const livePath = inputPath(liveArg)
  const entries = JSON.parse(readFileSync(livePath, 'utf8')) as LiveEntry[]
  const allRecords = JSON.parse(readFileSync(inputPath(recordsArg), 'utf8')) as SourceBookRecord[]
  const gaps = JSON.parse(readFileSync(inputPath(gapsArg), 'utf8')) as { records: Phase1BookRow[] }
  const bySourceRow = new Map(allRecords.map((record) => [`${record.src}\u0000${record.row}`, record]))
  const rows = gaps.records.map((row) => ({ ...row, record: bySourceRow.get(`${row.record.src}\u0000${row.record.row}`) ?? row.record }))
  const wordsDir = join(ROOT, 'packages/quran-data/mushaf1441/fixtures/page-words')
  const index = loadEntriesIndex(livePath, wordsDir)
  const mushaf = loadMushafIndex(wordsDir)
  const records = reanchorAndRematch(rows, index, mushaf)
  const liveAnchorMismatches = findLiveAnchorMismatches(entries, mushaf)
  const summary = renderSummary(records, liveAnchorMismatches)
  const prefix = inputPath(outArg)
  writeFileSync(`${prefix}.json`, `${JSON.stringify({ records, liveAnchorMismatches }, null, 2)}\n`)
  writeFileSync(`${prefix}-summary.md`, summary)
  process.stdout.write(summary.split('## 20 aligned samples')[0])
}

if (process.argv[1]?.includes('reanchor.ts')) main()
