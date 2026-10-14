// Read-only Phase 2 explanation composer.
// Usage: npx tsx scripts/qiraat/explanations.ts <live-all.json> <records.json> <outPrefix>

import { readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import type { NquranAyahEntry } from '../../src/app/mushaf-1441/review/_lib/nquranReference'
import { FAMILIES, sameFamily, skeleton } from './auto-review-live'
import {
  classifyNquranGroup,
  loadEntriesIndex,
  locateNquranDifference,
  matchBookRecordToEntries,
  type BookRecord,
  type EntriesIndex,
  type LiveEntry,
} from './match-sources'

const ROOT = join(__dirname, '..', '..')
const MAX_TEXT_LENGTH = 600

export type ExplanationField = 'ruling_text' | 'description_ar'
export type ExplanationConfidence = 'both' | 'book' | 'nquran'
export interface ExplanationEvidence { source: 'book' | 'nquran'; ref: string }
export interface ExplanationOutput {
  field: ExplanationField
  text: string
  confidence: ExplanationConfidence
  evidence: ExplanationEvidence[]
  partial?: true
  truncated?: true
}
export interface QueueItem {
  entryId: string
  page?: number
  ref: string
  family: string
  reason: string
  evidence?: ExplanationEvidence[]
}

export type SourceBookRecord = BookRecord & { srcPage?: string | number; page?: string | number }
export interface BookCandidate {
  sentence: string
  record: SourceBookRecord
  narrators: string[]
}
export interface NquranCandidate {
  sentence: string
  label: string
  sourceUrl: string
  ref: string
  narrators: string[]
  families: string[]
}
export interface ComposeCandidate {
  sentence: string
  label: string
  narrators: string[]
  source: 'book' | 'nquran'
  ref: string
  provenance?: string
}

/**
 * Recognised nquran topic vocabulary. Every keyword is deliberately listed here so additions are
 * reviewable. Matching uses `skeleton`, so harakat, tatweel and alef variants do not matter.
 */
export const READING_TOPIC_KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  imalah: ['الإمالة', 'امالة', 'التقليل', 'قلل', 'أمال', 'يميل'],
  mim_jam: ['ميم الجمع', 'صلة الميم', 'ضم الميم'],
  silah: ['هاء الضمير', 'هاء الكناية', 'صلة الهاء', 'صلة هاء', 'صلة'],
  sakt: ['السكت', 'سكتة', 'بالسكت', 'ترك السكت'],
  naql: ['النقل', 'نقل حركة', 'بنقل'],
  hamz: ['الهمزة', 'الهمز', 'تسهيل', 'تحقيق', 'إبدال الهمزة', 'ابدال الهمزة', 'حذف الهمزة', 'وقف بالهمز', 'وقفًا بالهمز', 'وقفا بالهمز'],
  idgham: ['الإدغام', 'الادغام', 'إدغام', 'ادغام', 'الإخفاء', 'الاخفاء', 'الغنة', 'الغنه'],
  madd: ['المد', 'القصر', 'التوسط', 'الإشباع', 'الاشباع', 'فويق'],
  tarqiq: ['الترقيق', 'ترقيق', 'التغليظ', 'تغليظ'],
  yaat: ['ياء الإضافة', 'ياء الاضافة', 'ياءات الإضافة', 'ياءات الاضافة', 'ياء الزوائد', 'ياءات الزوائد'],
  waqf: ['وقفًا', 'وقفا', 'الوقف', 'الرسم', 'المرسوم'],
}

const TOPIC_TO_CODES: Readonly<Record<string, readonly string[]>> = {
  imalah: FAMILIES[0],
  mim_jam: FAMILIES[1],
  silah: FAMILIES[2],
  sakt: ['USUL_SAKT', 'TARK_SAKT', 'SAKT'],
  naql: ['NAQL', 'USUL_NAQL'],
  hamz: FAMILIES[4],
  idgham: FAMILIES[5],
  madd: FAMILIES[6],
  yaat: FAMILIES[7],
  waqf: FAMILIES[8],
  tarqiq: FAMILIES[9],
}

export function classifyReadingSentence(sentence: string): string[] {
  const normalized = skeleton(sentence)
  const families = Object.entries(READING_TOPIC_KEYWORDS)
    .filter(([, keywords]) => keywords.some((keyword) => normalized.includes(skeleton(keyword))))
    .map(([family]) => family)
  // Bare «صلة» normally means هاء الكناية, except when the sentence explicitly says ميم الجمع.
  if (families.includes('mim_jam') && families.includes('silah') &&
      !['هاء الضمير', 'هاء الكناية', 'صلة الهاء', 'صلة هاء'].some((keyword) => normalized.includes(skeleton(keyword)))) {
    return families.filter((family) => family !== 'silah')
  }
  return families
}

export function entryFamily(categoryCode: string | null | undefined): string {
  const code = (categoryCode ?? '').toUpperCase()
  if (!code) return 'farsh'
  if (['USUL_SAKT', 'TARK_SAKT', 'SAKT'].includes(code)) return 'sakt'
  if (['NAQL', 'USUL_NAQL'].includes(code)) return 'naql'
  if (code.startsWith('MADD')) return 'madd'
  if (code.startsWith('YAAT_') || code.startsWith('USUL_YAAT_')) return 'yaat'
  if (code.startsWith('IDGHAM') || ['IKHFA', 'TARK_GHUNNA'].includes(code)) return 'idgham'
  if (['TARQIQ_RA', 'TAGHLIZ_LAM', 'TAGHLIDH_LAM'].includes(code)) return 'tarqiq'
  if (['WAQF_RASM', 'WAQF_MARSOOM'].includes(code)) return 'waqf'
  if (code.includes('HAMZ') || ['USUL_TAHQIQ', 'USUL_TASHIL', 'USUL_IBDAL'].includes(code)) return 'hamz'
  return Object.entries(TOPIC_TO_CODES).find(([, codes]) => codes.some((candidate) => sameFamily(candidate, code)))?.[0] ?? code.toLowerCase()
}

const punctuationSkeleton = (value: string) => skeleton(value).replace(/[\p{P}\p{S}]/gu, '')
const nonEmpty = (value: unknown) => typeof value === 'string' && value.trim().length > 0
const narratorIds = (entry: LiveEntry) => [...new Set(entry.authorities.map((authority) => authority.id).filter(Boolean))]
const overlapsNarrators = (entry: LiveEntry, ids: readonly string[]) => narratorIds(entry).some((id) => ids.includes(id))
const RULE_NAMES = new Set([
  'اماله', 'تقليل', 'سكت', 'نقل', 'همز', 'ادغام', 'مد', 'ترقيق', 'تغليظ', 'صله',
  'ميمالجمع', 'هاءالضمير', 'هاءالكنايه', 'ياءالاضافه', 'ياءالزوائد', 'وقف',
].map(punctuationSkeleton))

export function usableBookExplanation(record: SourceBookRecord): boolean {
  const explain = record.explain?.trim() ?? ''
  if ([...explain].length < 6) return false
  return !RULE_NAMES.has(punctuationSkeleton(explain))
}

function alignedHafs(record: SourceBookRecord, entry: LiveEntry): boolean {
  const base = entry.base_text.split(/\s+/).map(skeleton).filter(Boolean)
  const hafs = (record.hafsWords.length > 0 ? record.hafsWords : record.hafs.split(/\s+/)).map(skeleton).filter(Boolean)
  return hafs.length > 0 && hafs.every((word) => base.includes(word))
}

function farshSpellingAgrees(record: SourceBookRecord, entry: LiveEntry): boolean {
  if (entry.kind !== 'variant') return true
  const reading = skeleton(entry.reading_text ?? '')
  const base = skeleton(entry.base_text)
  const source = skeleton(record.text ?? '')
  return Boolean(source) && Boolean(reading) && (source === reading || source === base || reading === base)
}

const BOOK_NAMES: Readonly<Record<string, string>> = {
  'Q01-R01': 'قالون', 'Q01-R02': 'ورش',
  'Q02-R01': 'ابن كثير', 'Q02-R02': 'ابن كثير',
  'Q03-R01': 'الدوري', 'Q03-R02': 'السوسي',
  'Q04-R01': 'ابن عامر', 'Q04-R02': 'ابن عامر',
  'Q05-R01': 'شعبة',
  'Q06-R01': 'حمزة', 'Q06-R02': 'حمزة',
  'Q07-R01': 'الكسائي', 'Q07-R02': 'الكسائي',
  'Q08-R01': 'أبو جعفر', 'Q08-R02': 'أبو جعفر',
  'Q09-R01': 'يعقوب', 'Q09-R02': 'يعقوب',
  'Q10-R01': 'خلف العاشر', 'Q10-R02': 'خلف العاشر',
}

function bookProvenance(candidates: readonly BookCandidate[]): string[] {
  const labels = candidates.flatMap((candidate) => candidate.narrators.map((id) => {
    const name = BOOK_NAMES[id] ?? id
    const page = String(candidate.record.srcPage ?? '').trim()
    return page ? `كتاب ${name} ص${page}` : `كتاب ${name}`
  }))
  return [...new Set(labels)]
}

function orderedProvenance(items: readonly ComposeCandidate[]): string[] {
  const values = [...new Set(items.map((item) => item.provenance).filter((value): value is string => Boolean(value)))]
  return values.sort((a, b) => (a === 'nquran.com' ? -1 : b === 'nquran.com' ? 1 : a.localeCompare(b, 'ar')))
}

export function composeExplanation(
  candidates: readonly ComposeCandidate[],
  maxLength = MAX_TEXT_LENGTH,
  omitSingleLabel = false,
): { text: string; used: ComposeCandidate[]; truncated: boolean } | null {
  const grouped: { label: string; sentence: string; candidates: ComposeCandidate[] }[] = []
  const byPair = new Map<string, (typeof grouped)[number]>()
  for (const candidate of candidates) {
    const label = candidate.label.trim()
    const sentence = candidate.sentence.trim()
    if (!label || !sentence) continue
    const key = `${label}\u0000${sentence}`
    const existing = byPair.get(key)
    if (existing) existing.candidates.push(candidate)
    else {
      const item = { label, sentence, candidates: [candidate] }
      grouped.push(item)
      byPair.set(key, item)
    }
  }

  const accepted: (typeof grouped)[number][] = []
  let used: ComposeCandidate[] = []
  for (const item of grouped) {
    const proposedItems = [...accepted, item]
    const proposedUsed = [...used, ...item.candidates]
    const provenance = orderedProvenance(proposedUsed)
    const lines = proposedItems.map(({ label, sentence }) =>
      omitSingleLabel && grouped.length === 1 ? sentence : `${label}: ${sentence}`)
    const proposed = `${lines.join('\n')}\n[المصدر: ${provenance.join('؛ ')}]`
    if (proposed.length > maxLength) break
    accepted.push(item)
    used = proposedUsed
  }
  if (accepted.length === 0) return null
  const provenance = orderedProvenance(used)
  const lines = accepted.map(({ label, sentence }) =>
    omitSingleLabel && grouped.length === 1 ? sentence : `${label}: ${sentence}`)
  return {
    text: `${lines.join('\n')}\n[المصدر: ${provenance.join('؛ ')}]`,
    used,
    truncated: accepted.length < grouped.length,
  }
}

function evidenceOfBook(candidate: BookCandidate): ExplanationEvidence {
  return { source: 'book', ref: `${candidate.record.src}:${candidate.record.row}${candidate.record.srcPage ? `:p${candidate.record.srcPage}` : ''}` }
}

function candidateConflict(entry: LiveEntry, books: readonly BookCandidate[], nquran: readonly NquranCandidate[]): string | null {
  const ids = narratorIds(entry)
  for (const id of ids) {
    if (entry.kind === 'variant') {
      const readings = new Set(books.filter((item) => item.narrators.includes(id)).map((item) => skeleton(item.record.text)).filter(Boolean))
      if (readings.size > 1) return `conflicting book readings for ${id}`
      const unclassified = new Set(nquran.filter((item) => item.narrators.includes(id) && item.families.length === 0).map((item) => punctuationSkeleton(item.sentence)))
      if (unclassified.size > 1) return `conflicting nquran readings for ${id}`
    }
    const familySignatures = new Set(nquran.filter((item) => item.narrators.includes(id) && item.families.length > 0)
      .map((item) => [...item.families].sort().join('+')))
    if (familySignatures.size > 1) return `conflicting nquran families for ${id}: ${[...familySignatures].join(',')}`
  }
  return null
}

function collectBookCandidates(entries: readonly LiveEntry[], records: readonly SourceBookRecord[], index: EntriesIndex): Map<string, BookCandidate[]> {
  const byEntry = new Map<string, BookCandidate[]>()
  const entryById = new Map(entries.map((entry) => [entry.id, entry]))
  for (const record of records) {
    if (!usableBookExplanation(record)) continue
    const matched = matchBookRecordToEntries(record, index)
    for (const match of matched.matches) {
      const entry = entryById.get(match.id)
      if (!entry || !overlapsNarrators(entry, record.n) || !alignedHafs(record, entry) || !farshSpellingAgrees(record, entry)) continue
      const bucket = byEntry.get(entry.id) ?? []
      bucket.push({ sentence: record.explain!.trim(), record, narrators: record.n.filter((id) => narratorIds(entry).includes(id)) })
      byEntry.set(entry.id, bucket)
    }
  }
  for (const bucket of byEntry.values()) bucket.sort((a, b) => a.record.src.localeCompare(b.record.src) || a.record.row - b.record.row)
  return byEntry
}

function collectNquranCandidates(entries: readonly LiveEntry[], index: EntriesIndex): Map<string, NquranCandidate[]> {
  const byEntry = new Map<string, NquranCandidate[]>()
  const entryById = new Map(entries.map((entry) => [entry.id, entry]))
  for (let surah = 1; surah <= 114; surah += 1) {
    const file = join(ROOT, 'src/app/mushaf-1441/review/_lib/reference/nquran', `surah-${String(surah).padStart(3, '0')}.json`)
    const ayahs = JSON.parse(readFileSync(file, 'utf8')) as NquranAyahEntry[]
    for (const ayah of ayahs) for (const difference of ayah.differences) {
      const located = locateNquranDifference(difference, surah, ayah.ayah, index)
      for (const group of difference.groups) {
        const classification = classifyNquranGroup(located, group, index)
        if (!classification || classification.unresolvedLabels.length > 0) continue
        for (const entryId of classification.matchedEntryIds) {
          const entry = entryById.get(entryId)
          if (!entry || !overlapsNarrators(entry, classification.narratorIds)) continue
          const bucket = byEntry.get(entryId) ?? []
          bucket.push({
            sentence: group.reading.trim(), label: group.readers.join('، '), sourceUrl: ayah.sourceUrl,
            ref: `${surah}:${ayah.ayah}:${difference.location}`,
            narrators: classification.narratorIds.filter((id) => narratorIds(entry).includes(id)),
            families: classifyReadingSentence(group.reading),
          })
          byEntry.set(entryId, bucket)
        }
      }
    }
  }
  for (const bucket of byEntry.values()) bucket.sort((a, b) => a.ref.localeCompare(b.ref) || a.sentence.localeCompare(b.sentence))
  return byEntry
}

export function explainEntry(entry: LiveEntry, books: readonly BookCandidate[], rawNquran: readonly NquranCandidate[]):
  { explanation?: ExplanationOutput; queue?: QueueItem } {
  const field: ExplanationField = entry.kind === 'ruling' ? 'ruling_text' : 'description_ar'
  const existing = entry.kind === 'ruling' ? entry.ruling_text : entry.description_ar
  const family = entry.kind === 'variant' ? 'farsh' : entryFamily(entry.category_code)
  const ref = `${entry.surah}:${entry.ayah}:${entry.word}`
  if (nonEmpty(existing)) return { queue: { entryId: entry.id, page: entry.page, ref, family, reason: 'field already has text' } }
  const conflict = candidateConflict(entry, books, rawNquran)
  if (conflict) return { queue: { entryId: entry.id, page: entry.page, ref, family, reason: conflict,
    evidence: [...books.map(evidenceOfBook), ...rawNquran.map((item) => ({ source: 'nquran' as const, ref: item.ref }))] } }
  const nquran = rawNquran.filter((item) => item.families.includes(family) ||
    (entry.kind === 'variant' && item.families.length === 0 && books.length > 0))
  const topicMismatches = rawNquran.filter((item) => !nquran.includes(item))
  const bookProvs = bookProvenance(books)
  const candidates: ComposeCandidate[] = [
    ...books.map((item) => ({ sentence: item.sentence,
      label: [...new Set(item.narrators.map((id) => BOOK_NAMES[id] ?? id))].join('، '), narrators: item.narrators,
      source: 'book' as const, ref: evidenceOfBook(item).ref,
      provenance: bookProvs.find((label) => item.narrators.some((id) => label.includes(BOOK_NAMES[id] ?? id))) ?? bookProvs[0] })),
    ...nquran.map((item) => ({ sentence: item.sentence, label: item.label, narrators: item.narrators,
      source: 'nquran' as const, ref: item.ref, provenance: 'nquran.com' })),
  ]
  const composed = composeExplanation(candidates, MAX_TEXT_LENGTH,
    narratorIds(entry).length === 1 && candidates.length === 1)
  if (!composed) return { queue: { entryId: entry.id, page: entry.page, ref, family,
    reason: topicMismatches.length > 0 ? 'nquran topic mismatch and no usable book explanation' : 'no safe source explanation',
    evidence: topicMismatches.map((item) => ({ source: 'nquran', ref: item.ref })) } }
  const usedSources = new Set(composed.used.map((item) => item.source))
  const coveredNarrators = new Set(composed.used.flatMap((item) => item.narrators))
  const partial = narratorIds(entry).some((id) => !coveredNarrators.has(id))
  return { explanation: {
    field, text: composed.text,
    confidence: usedSources.size === 2 ? 'both' : usedSources.has('book') ? 'book' : 'nquran',
    evidence: [...new Map(composed.used.map((item) => [`${item.source}:${item.ref}`, { source: item.source, ref: item.ref }])).values()],
    ...(partial ? { partial: true as const } : {}),
    ...(composed.truncated ? { truncated: true as const } : {}),
  } }
}

export function buildExplanations(entries: readonly LiveEntry[], records: readonly SourceBookRecord[], index: EntriesIndex): {
  explanations: Record<string, ExplanationOutput>
  queue: QueueItem[]
} {
  const booksByEntry = collectBookCandidates(entries, records, index)
  const nquranByEntry = collectNquranCandidates(entries, index)
  const explanations: Record<string, ExplanationOutput> = {}
  const queue: QueueItem[] = []

  for (const entry of [...entries].sort((a, b) => a.id.localeCompare(b.id))) {
    const books = booksByEntry.get(entry.id) ?? []
    const rawNquran = nquranByEntry.get(entry.id) ?? []
    const result = explainEntry(entry, books, rawNquran)
    if (result.explanation) explanations[entry.id] = result.explanation
    if (result.queue) queue.push(result.queue)
  }
  return { explanations, queue }
}

const md = (value: unknown) => String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
function seededSamples<T>(values: readonly T[], count: number): T[] {
  let state = 0x51a7e2d3
  return values.map((value) => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5
    return { value, rank: state >>> 0 }
  }).sort((a, b) => a.rank - b.rank).slice(0, count).map((item) => item.value)
}

export function renderSummary(entries: readonly LiveEntry[], explanations: Record<string, ExplanationOutput>, queue: readonly QueueItem[]): string {
  const byId = new Map(entries.map((entry) => [entry.id, entry]))
  const items = Object.entries(explanations)
  const confidences: ExplanationConfidence[] = ['both', 'book', 'nquran']
  const families = [...new Set(items.map(([id]) => {
    const entry = byId.get(id)!
    return entry.kind === 'variant' ? 'farsh' : entryFamily(entry.category_code)
  }))].sort()
  const readers = [...new Set(items.flatMap(([id]) => narratorIds(byId.get(id)!)))].sort()
  const lines = ['# Qiraat explanation composition', '', `- Entries receiving text: ${items.length}`, `- Queued/skipped entries: ${queue.length}`,
    `- Partial entries: ${items.filter(([, value]) => value.partial).length}`,
    `- Truncated entries: ${items.filter(([, value]) => value.truncated).length}`,
    ...confidences.map((confidence) => `- ${confidence}: ${items.filter(([, value]) => value.confidence === confidence).length}`), '',
    '## By family', '', '| Family | Count |', '|---|---:|',
    ...families.map((family) => `| ${family} | ${items.filter(([id]) => { const entry = byId.get(id)!; return (entry.kind === 'variant' ? 'farsh' : entryFamily(entry.category_code)) === family }).length} |`), '',
    '## By reader/narrator', '', '| Narrator | Count |', '|---|---:|',
    ...readers.map((reader) => `| ${reader} | ${items.filter(([id]) => narratorIds(byId.get(id)!).includes(reader)).length} |`), '',
    '## 30 deterministic random samples', '', '| Entry | Reference | Field | Confidence | Text | Evidence/source row |', '|---|---|---|---|---|---|']
  for (const [id, value] of seededSamples(items, 30)) {
    const entry = byId.get(id)!
    lines.push(`| ${md(id)} | ${entry.surah}:${entry.ayah}:${entry.word} | ${value.field} | ${value.confidence} | ${md(value.text)} | ${md(value.evidence.map((item) => `${item.source}:${item.ref}`).join('؛ '))} |`)
  }
  return `${lines.join('\n')}\n`
}

const inputPath = (value: string) => isAbsolute(value) ? value : resolve(ROOT, value)
export function main(argv = process.argv.slice(2)): void {
  const [liveArg, recordsArg, outArg] = argv
  if (!liveArg || !recordsArg || !outArg) {
    console.error('Usage: npx tsx scripts/qiraat/explanations.ts <live-all.json> <records.json> <outPrefix>')
    process.exitCode = 1
    return
  }
  const livePath = inputPath(liveArg)
  const entries = JSON.parse(readFileSync(livePath, 'utf8')) as LiveEntry[]
  const records = JSON.parse(readFileSync(inputPath(recordsArg), 'utf8')) as SourceBookRecord[]
  const index = loadEntriesIndex(livePath, join(ROOT, 'packages/quran-data/mushaf1441/fixtures/page-words'))
  const { explanations, queue } = buildExplanations(entries, records, index)
  const outPrefix = inputPath(outArg)
  writeFileSync(`${outPrefix}.json`, `${JSON.stringify(explanations, null, 2)}\n`)
  writeFileSync(`${outPrefix}-queue.json`, `${JSON.stringify(queue, null, 2)}\n`)
  const summary = renderSummary(entries, explanations, queue)
  writeFileSync(`${outPrefix}-summary.md`, summary)
  process.stdout.write(summary.split('## 30 deterministic random samples')[0])
}

if (process.argv[1]?.includes('explanations.ts')) main()
