// Phase 3: propose safer farsh sub-categories from JSON snapshots only.
// Usage: npx tsx scripts/qiraat/subcategory.ts <live-all.json> <gaps-books.json> <outPrefix>

import { readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { farshSubCategory } from './auto-review-live'
import type { BookRecord, LiveEntry } from './match-sources'

const ROOT = join(__dirname, '..', '..')

export const BOOK_TYPE_TO_VARIANT_TYPE: Readonly<Record<string, string>> = {
  HARAKAH: 'vowel', LETTER: 'consonant', ADDITION: 'addition', OMISSION: 'omission',
  HAMZ: 'hamza', IMALAH: 'imalah', IDGHAM: 'idgham', WAQF: 'other',
  ORTHOGRAPHY: 'orthography', SAKT: 'sakt', HA_SAKT: 'sakt', NAQL: 'naql', MADD: 'madd',
  OTHER: 'other',
}

const SPECIAL_VOWEL_COMPATIBLE = new Set(['hamza', 'imalah', 'idgham', 'madd', 'sakt', 'naql'])

export interface Phase1BookResult {
  record: BookRecord
  class: 'MATCHED' | 'NARRATORS_MISSING' | 'TEXT_CONFLICT' | 'MISSING' | 'UNMATCHABLE'
  matchedEntryIds: string[]
  missingNarrators: string[]
  ambiguous: boolean
}

export interface SubcategoryProposal {
  entryId: string
  ref: string
  from: 'other'
  to: string
  derived: string
  evidence: { src: string; row: number; type: string }[]
}

export interface SubcategoryQueueItem {
  entryId: string
  ref: string
  reason: string
}

export function isHumanApproved(entry: LiveEntry): boolean {
  return entry.status === 'reviewed' && entry.review_source == null && !(entry.device_id ?? '').startsWith('bulk-')
}

export function bookTypeSupportsDerivation(bookType: string, derived: string): string | null {
  const mapped = BOOK_TYPE_TO_VARIANT_TYPE[bookType.toUpperCase()]
  if (!mapped || mapped === 'other') return null
  if (mapped === derived) return mapped
  if (derived === 'vowel' && SPECIAL_VOWEL_COMPATIBLE.has(mapped)) return mapped
  return null
}

export function proposeSubcategory(entry: LiveEntry, phase1Rows: readonly Phase1BookResult[]):
  { proposal?: SubcategoryProposal; queue?: SubcategoryQueueItem } {
  const ref = `${entry.surah}:${entry.ayah}:${entry.word}`
  if (entry.kind !== 'variant' || entry.variant_type !== 'other') {
    return { queue: { entryId: entry.id, ref, reason: 'not a live farsh entry with variant_type other' } }
  }
  if (isHumanApproved(entry)) return { queue: { entryId: entry.id, ref, reason: 'human-approved entry' } }

  const derived = farshSubCategory(entry.base_text, entry.reading_text ?? entry.base_text)
  if (derived === 'other') return { queue: { entryId: entry.id, ref, reason: 'letter derivation remained other' } }

  const usable = phase1Rows.filter((item) =>
    (item.class === 'MATCHED' || item.class === 'NARRATORS_MISSING') &&
    !item.ambiguous && item.record.kind === 'farsh' && item.matchedEntryIds.includes(entry.id))
  const supported = usable.map((item) => ({ item, mapped: bookTypeSupportsDerivation(item.record.type, derived) }))
    .filter((value): value is { item: Phase1BookResult; mapped: string } => Boolean(value.mapped))
  const types = [...new Set(supported.map((item) => item.mapped))]
  if (types.length === 0) return { queue: { entryId: entry.id, ref, reason: 'no unambiguous matched book type agrees with derivation' } }
  if (types.length > 1) return { queue: { entryId: entry.id, ref, reason: `matched books disagree on type: ${types.join(',')}` } }

  return { proposal: {
    entryId: entry.id, ref, from: 'other', to: types[0], derived,
    evidence: supported.filter((item) => item.mapped === types[0]).map(({ item }) => ({
      src: item.record.src, row: item.record.row, type: item.record.type,
    })),
  } }
}

const sqlEscape = (value: string) => value.replace(/'/g, "''")

export function generateSubcategorySql(proposals: readonly SubcategoryProposal[]): string {
  return [
    '-- Qiraat Phase 3 farsh sub-category refinement. JSON-source generated; human approvals excluded.',
    'BEGIN;',
    "SELECT set_config('app.device_id', 'auto-review', true);",
    '',
    ...[...proposals].sort((a, b) => a.entryId.localeCompare(b.entryId)).map((item) =>
      `UPDATE qiraat_variant_details SET variant_type = '${sqlEscape(item.to)}' WHERE entry_id = '${sqlEscape(item.entryId)}' AND variant_type = 'other';`),
    '',
    'COMMIT;',
    '',
  ].join('\n')
}

function renderSummary(proposals: readonly SubcategoryProposal[], queue: readonly SubcategoryQueueItem[]): string {
  const types = [...new Set(proposals.map((item) => item.to))].sort()
  const reasons = [...new Set(queue.map((item) => item.reason))].sort()
  return `${[
    '# Qiraat Phase 3 sub-category refinement', '',
    `- Proposed updates: ${proposals.length}`,
    `- Left as other: ${queue.length}`, '',
    '## Proposed by new type', '', '| Type | Count |', '|---|---:|',
    ...types.map((type) => `| ${type} | ${proposals.filter((item) => item.to === type).length} |`), '',
    '## Left as other by reason', '', '| Reason | Count |', '|---|---:|',
    ...reasons.map((reason) => `| ${reason} | ${queue.filter((item) => item.reason === reason).length} |`), '',
    '## Entries left as other', '', '| Entry | Reference | Reason |', '|---|---|---|',
    ...queue.map((item) => `| ${item.entryId.replace(/\|/g, '\\|')} | ${item.ref} | ${item.reason.replace(/\|/g, '\\|')} |`), '',
  ].join('\n')}\n`
}

const inputPath = (value: string) => isAbsolute(value) ? value : resolve(ROOT, value)

export function main(argv = process.argv.slice(2)): void {
  const [liveArg, gapsArg, outArg] = argv
  if (!liveArg || !gapsArg || !outArg) {
    console.error('Usage: npx tsx scripts/qiraat/subcategory.ts <live-all.json> <gaps-books.json> <outPrefix>')
    process.exitCode = 1
    return
  }
  const entries = JSON.parse(readFileSync(inputPath(liveArg), 'utf8')) as LiveEntry[]
  const phase1 = JSON.parse(readFileSync(inputPath(gapsArg), 'utf8')) as { records: Phase1BookResult[] }
  const rowsByEntry = new Map<string, Phase1BookResult[]>()
  for (const row of phase1.records) for (const id of row.matchedEntryIds) {
    const bucket = rowsByEntry.get(id) ?? []
    bucket.push(row)
    rowsByEntry.set(id, bucket)
  }
  const proposals: SubcategoryProposal[] = []
  const queue: SubcategoryQueueItem[] = []
  for (const entry of entries.filter((item) => item.kind === 'variant' && item.variant_type === 'other')) {
    const result = proposeSubcategory(entry, rowsByEntry.get(entry.id) ?? [])
    if (result.proposal) proposals.push(result.proposal)
    if (result.queue) queue.push(result.queue)
  }
  proposals.sort((a, b) => a.entryId.localeCompare(b.entryId))
  queue.sort((a, b) => a.entryId.localeCompare(b.entryId))
  const prefix = inputPath(outArg)
  writeFileSync(`${prefix}.json`, `${JSON.stringify({ proposals, queue }, null, 2)}\n`)
  writeFileSync(`${prefix}.sql`, generateSubcategorySql(proposals))
  const summary = renderSummary(proposals, queue)
  writeFileSync(`${prefix}-summary.md`, summary)
  process.stdout.write(summary.split('## Entries left as other')[0])
}

if (process.argv[1]?.includes('subcategory.ts')) main()
