// Read-only gap analysis over JSON snapshots. No database access or mutations.
// Usage: npx tsx scripts/qiraat/import-gap-analysis.ts <live-all.json> <records.json> <outPrefix>

import { readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import type { NquranAyahEntry } from '../../src/app/mushaf-1441/review/_lib/nquranReference'
import {
  classifyBookRecord,
  classifyNquranGroup,
  loadEntriesIndex,
  locateNquranDifference,
  matchBookRecordToEntries,
  type BookRecord,
  type NquranClass,
  type SourceClass,
} from './match-sources'

const ROOT = join(__dirname, '..', '..')
const BOOK_CLASSES: SourceClass[] = ['MATCHED', 'NARRATORS_MISSING', 'TEXT_CONFLICT', 'MISSING', 'UNMATCHABLE']
const NQURAN_CLASSES: NquranClass[] = ['MATCHED', 'NARRATORS_MISSING', 'MISSING', 'UNRESOLVED_READER']
const inputPath = (value: string) => isAbsolute(value) ? value : resolve(ROOT, value)
const md = (value: unknown) => String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')

interface BookResult {
  record: BookRecord
  matchedEntryIds: string[]
  class: SourceClass
  missingNarrators: string[]
  ambiguous: boolean
}

interface NquranResult {
  record: {
    surah: number
    ayah: number
    sourceUrl: string
    location: string
    wordNumbers: number[]
    group: { readers: string[]; reading: string }
    narratorIds: string[]
  }
  matchedEntryIds: string[]
  class: NquranClass
  missingNarrators: string[]
  unresolvedLabels: string[]
  ambiguous: boolean
}

function countClasses<T extends string>(values: readonly T[], classes: readonly T[]): Record<T, number> {
  return Object.fromEntries(classes.map((name) => [name, values.filter((value) => value === name).length])) as Record<T, number>
}

function matrixTable<Row extends string, Class extends string>(
  title: string,
  rows: readonly Row[],
  classes: readonly Class[],
  count: (row: Row, className: Class) => number,
): string[] {
  return [
    `## ${title}`,
    '',
    `| Value | ${classes.join(' | ')} | Total |`,
    `|---|${classes.map(() => '---:').join('|')}|---:|`,
    ...rows.map((row) => {
      const counts = classes.map((className) => count(row, className))
      return `| ${md(row)} | ${counts.join(' | ')} | ${counts.reduce((sum, value) => sum + value, 0)} |`
    }),
    '',
  ]
}

function renderSummary(books: readonly BookResult[], nquran: readonly NquranResult[], elapsedMs: number): string {
  const lines: string[] = [
    '# Qiraat source gap analysis',
    '',
    `Generated from JSON snapshots only. Runtime: ${(elapsedMs / 1000).toFixed(2)} seconds.`,
    '',
    '## Overall',
    '',
    `- Book records: ${books.length}`,
    ...BOOK_CLASSES.map((name) => `  - ${name}: ${books.filter((item) => item.class === name).length}`),
    `- nquran groups (Hafs-baseline groups skipped): ${nquran.length}`,
    ...NQURAN_CLASSES.map((name) => `  - ${name}: ${nquran.filter((item) => item.class === name).length}`),
    `- Ambiguous book rows: ${books.filter((item) => item.ambiguous).length}`,
    `- Ambiguous nquran groups: ${nquran.filter((item) => item.ambiguous).length}`,
    '',
  ]

  const sources = [...new Set(books.map((item) => item.record.src))].sort()
  lines.push(...matrixTable('Book records by CSV', sources, BOOK_CLASSES,
    (source, className) => books.filter((item) => item.record.src === source && item.class === className).length))

  const narrators = [...new Set(books.flatMap((item) => item.record.n))].sort()
  lines.push(...matrixTable('Book records by narrator', narrators, BOOK_CLASSES,
    (narrator, className) => books.filter((item) => item.record.n.includes(narrator) && item.class === className).length))

  const kinds = ['farsh', 'usul'] as const
  lines.push(...matrixTable('Book records by kind', kinds, BOOK_CLASSES,
    (kind, className) => books.filter((item) => item.record.kind === kind && item.class === className).length))

  const nqNarrators = [...new Set(nquran.flatMap((item) => item.record.narratorIds))].sort()
  lines.push(...matrixTable('nquran groups by narrator', nqNarrators, NQURAN_CLASSES,
    (narrator, className) => nquran.filter((item) => item.record.narratorIds.includes(narrator) && item.class === className).length))

  lines.push('## Book samples (up to 15 per class)', '')
  for (const className of BOOK_CLASSES) {
    lines.push(`### ${className}`, '', '| CSV row | Reference | Narrators | Matched entry ids | Missing narrators | Ambiguous |', '|---|---|---|---|---|---|')
    const samples = books.filter((item) => item.class === className).slice(0, 15)
    if (samples.length === 0) lines.push('| — | — | — | — | — | — |')
    for (const item of samples) {
      lines.push(`| ${md(item.record.src)}:${item.record.row} | ${item.record.surah}:${item.record.ayah}:${item.record.w0 ?? '?'}-${item.record.w1 ?? '?'} | ${md(item.record.n.join(','))} | ${md(item.matchedEntryIds.join(','))} | ${md(item.missingNarrators.join(','))} | ${item.ambiguous ? 'yes' : 'no'} |`)
    }
    lines.push('')
  }

  lines.push('## nquran samples (up to 15 per class)', '')
  for (const className of NQURAN_CLASSES) {
    lines.push(`### ${className}`, '', '| Reference | Location | Readers | Narrators | Matched entry ids | Missing / unresolved | Ambiguous |', '|---|---|---|---|---|---|---|')
    const samples = nquran.filter((item) => item.class === className).slice(0, 15)
    if (samples.length === 0) lines.push('| — | — | — | — | — | — | — |')
    for (const item of samples) {
      const missing = [...item.missingNarrators, ...item.unresolvedLabels]
      lines.push(`| ${item.record.surah}:${item.record.ayah}:${item.record.wordNumbers.join(',') || '?'} | ${md(item.record.location)} | ${md(item.record.group.readers.join(','))} | ${md(item.record.narratorIds.join(','))} | ${md(item.matchedEntryIds.join(','))} | ${md(missing.join(','))} | ${item.ambiguous ? 'yes' : 'no'} |`)
    }
    lines.push('')
  }
  return `${lines.join('\n')}\n`
}

export function main(argv = process.argv.slice(2)): void {
  const [liveArg, recordsArg, outArg] = argv
  if (!liveArg || !recordsArg || !outArg) {
    console.error('Usage: npx tsx scripts/qiraat/import-gap-analysis.ts <live-all.json> <records.json> <outPrefix>')
    process.exitCode = 1
    return
  }

  const started = performance.now()
  const livePath = inputPath(liveArg)
  const recordsPath = inputPath(recordsArg)
  const outPrefix = inputPath(outArg)
  const entriesIndex = loadEntriesIndex(livePath, join(ROOT, 'packages/quran-data/mushaf1441/fixtures/page-words'))
  const records = JSON.parse(readFileSync(recordsPath, 'utf8')) as BookRecord[]

  const books: BookResult[] = records.map((record) => {
    const matches = matchBookRecordToEntries(record, entriesIndex)
    return { record, ...classifyBookRecord(record, matches) }
  })

  const nquran: NquranResult[] = []
  for (let surah = 1; surah <= 114; surah += 1) {
    const file = join(ROOT, 'src/app/mushaf-1441/review/_lib/reference/nquran', `surah-${String(surah).padStart(3, '0')}.json`)
    const ayahs = JSON.parse(readFileSync(file, 'utf8')) as NquranAyahEntry[]
    for (const ayah of ayahs) {
      for (const difference of ayah.differences) {
        const located = locateNquranDifference(difference, surah, ayah.ayah, entriesIndex)
        for (const group of difference.groups) {
          const classification = classifyNquranGroup(located, group, entriesIndex)
          if (!classification) continue
          nquran.push({
            record: {
              surah,
              ayah: ayah.ayah,
              sourceUrl: ayah.sourceUrl,
              location: difference.location,
              wordNumbers: located.wordNumbers,
              group,
              narratorIds: classification.narratorIds,
            },
            matchedEntryIds: classification.matchedEntryIds,
            class: classification.class,
            missingNarrators: classification.missingNarrators,
            unresolvedLabels: classification.unresolvedLabels,
            ambiguous: classification.ambiguous,
          })
        }
      }
    }
  }

  const elapsedMs = performance.now() - started
  const summary = renderSummary(books, nquran, elapsedMs)
  writeFileSync(`${outPrefix}-books.json`, `${JSON.stringify({ summary: countClasses(books.map((item) => item.class), BOOK_CLASSES), records: books }, null, 2)}\n`)
  writeFileSync(`${outPrefix}-nquran.json`, `${JSON.stringify({ summary: countClasses(nquran.map((item) => item.class), NQURAN_CLASSES), groups: nquran }, null, 2)}\n`)
  writeFileSync(`${outPrefix}-summary.md`, summary)
  process.stdout.write(summary)
}

if (process.argv[1]?.includes('import-gap-analysis')) main()
