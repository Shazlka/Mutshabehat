import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  findNquranDifferencesForWord,
  resolveDifferenceGroups,
  type NquranDifference,
  type NquranReaderGroup,
} from '../../src/app/mushaf-1441/review/_lib/nquranReference'
import { sameFamily, skeleton } from './auto-review-live'

export interface LiveAuthority {
  id: string
  action?: string | null
  condition?: string | null
  wajh?: number | string | null
  wajh_note?: string | null
}

export interface LiveEntry {
  id: string
  kind: 'variant' | 'ruling'
  status?: string
  review_source?: string | null
  device_id?: string | null
  page?: number
  surah: number
  ayah: number
  word: number
  end_word?: number | null
  base_text: string
  reading_text?: string | null
  uthmani_text?: string | null
  description_ar?: string | null
  performance_note?: string | null
  variant_type?: string | null
  category_code?: string | null
  ruling_text?: string | null
  authorities: LiveAuthority[]
}

export interface BookRecord {
  n: string[]
  kind: 'farsh' | 'usul'
  type: string
  text: string
  explain?: string
  note?: string
  wajh?: string | number | null
  src: string
  row: number
  surah: number
  ayah: number
  w0: number | null
  w1: number | null
  hafs: string
  positions: string[]
  hafsWords: string[]
}

export interface AyahWord {
  word: number
  text: string
}

export interface EntriesIndex {
  byAyah: Map<string, LiveEntry[]>
  ayahWords: Map<string, AyahWord[]>
}

export type SourceClass = 'MATCHED' | 'NARRATORS_MISSING' | 'TEXT_CONFLICT' | 'MISSING' | 'UNMATCHABLE'
export type NquranClass = 'MATCHED' | 'NARRATORS_MISSING' | 'MISSING' | 'UNRESOLVED_READER'

export interface EntryMatches {
  matches: LiveEntry[]
  ambiguous: boolean
  usableAnchor: boolean
}

export interface BookClassification {
  class: SourceClass
  missingNarrators: string[]
  matchedEntryIds: string[]
  ambiguous: boolean
}

export interface LocatedNquranDifference extends NquranDifference {
  surah: number
  ayah: number
  wordNumbers: number[]
}

export interface NquranClassification {
  class: NquranClass
  missingNarrators: string[]
  matchedEntryIds: string[]
  ambiguous: boolean
  narratorIds: string[]
  unresolvedLabels: string[]
}

const ayahKey = (surah: number, ayah: number) => `${surah}:${ayah}`
const narratorIds = (entry: LiveEntry) => [...new Set(entry.authorities.map((a) => a.id).filter(Boolean))]
const overlapCount = (wanted: readonly string[], entry: LiveEntry) => narratorIds(entry).filter((id) => wanted.includes(id)).length

export function buildEntriesIndex(entries: readonly LiveEntry[], ayahWords = new Map<string, AyahWord[]>()): EntriesIndex {
  const byAyah = new Map<string, LiveEntry[]>()
  for (const entry of entries) {
    const key = ayahKey(entry.surah, entry.ayah)
    const bucket = byAyah.get(key)
    if (bucket) bucket.push(entry)
    else byAyah.set(key, [entry])
  }
  return { byAyah, ayahWords }
}

interface WordsPage {
  lines: { words: { surahNumber: number; ayahNumber: number; wordIndexInAyah: number; textUthmani: string; charTypeName: string }[] }[]
}

/** The module's one filesystem loader. Matching and classification remain pure. */
export function loadEntriesIndex(entriesPath: string, pageWordsDir: string): EntriesIndex {
  const entries = JSON.parse(readFileSync(entriesPath, 'utf8')) as LiveEntry[]
  const words = new Map<string, AyahWord[]>()
  for (let page = 1; page <= 604; page += 1) {
    const file = join(pageWordsDir, `page-${String(page).padStart(3, '0')}.json`)
    const data = JSON.parse(readFileSync(file, 'utf8')) as WordsPage
    for (const line of data.lines) {
      for (const word of line.words) {
        if (word.charTypeName !== 'word') continue
        const key = ayahKey(word.surahNumber, word.ayahNumber)
        const bucket = words.get(key)
        const value = { word: word.wordIndexInAyah, text: word.textUthmani }
        if (bucket) {
          if (!bucket.some((item) => item.word === value.word)) bucket.push(value)
        } else words.set(key, [value])
      }
    }
  }
  for (const bucket of words.values()) bucket.sort((a, b) => a.word - b.word)
  return buildEntriesIndex(entries, words)
}

function positionedRange(record: BookRecord): [number, number] | null {
  if (record.positions.length === 0) return null
  const positions = record.positions
    .map((value) => value.split(':').map(Number))
    .filter(([surah, ayah, word]) => surah === record.surah && ayah === record.ayah && Number.isInteger(word))
    .map(([, , word]) => word)
  if (positions.length > 0) return [Math.min(...positions), Math.max(...positions)]
  if (record.w0 !== null && record.w1 !== null) return [record.w0, record.w1]
  return null
}

function entryOverlaps(entry: LiveEntry, first: number, last: number): boolean {
  const end = entry.end_word ?? entry.word
  return entry.word <= last && end >= first
}

function hafsWordsMatch(record: BookRecord, entry: LiveEntry): boolean {
  const wanted = record.hafsWords.map(skeleton).filter(Boolean)
  if (wanted.length === 0) return false
  const available = entry.base_text.split(/\s+/).map(skeleton).filter(Boolean)
  return wanted.every((word) => available.includes(word))
}

function kindMatches(record: BookRecord, entry: LiveEntry): boolean {
  if (record.kind === 'usul') return entry.kind === 'ruling' && sameFamily(record.type, entry.category_code ?? '')
  if (entry.kind === 'variant') return true
  return entry.kind === 'ruling' && sameFamily(record.type, entry.category_code ?? '')
}

export function matchBookRecordToEntries(record: BookRecord, entriesIndex: EntriesIndex): EntryMatches {
  const range = positionedRange(record)
  const usableAnchor = range !== null || record.hafsWords.some((word) => Boolean(skeleton(word)))
  if (!usableAnchor) return { matches: [], ambiguous: false, usableAnchor: false }

  const candidates = (entriesIndex.byAyah.get(ayahKey(record.surah, record.ayah)) ?? [])
    .filter((entry) => kindMatches(record, entry))
    .filter((entry) => range ? entryOverlaps(entry, range[0], range[1]) : hafsWordsMatch(record, entry))
    .sort((a, b) => overlapCount(record.n, b) - overlapCount(record.n, a) || a.id.localeCompare(b.id))

  return { matches: candidates, ambiguous: candidates.length > 1, usableAnchor: true }
}

function farshReadingMatches(record: BookRecord, entry: LiveEntry): boolean {
  if (entry.kind === 'ruling') return sameFamily(record.type, entry.category_code ?? '')
  const reading = skeleton(entry.reading_text ?? '')
  const base = skeleton(entry.base_text)
  return reading.length > 0 && (reading === skeleton(record.text) || reading === base)
}

export function classifyBookRecord(record: BookRecord, result: EntryMatches): BookClassification {
  const { matches, ambiguous, usableAnchor } = result
  if (!usableAnchor) return { class: 'UNMATCHABLE', missingNarrators: [...record.n], matchedEntryIds: [], ambiguous: false }

  const agrees = (entry: LiveEntry) => record.kind === 'usul' || farshReadingMatches(record, entry)
  const coversAll = (entry: LiveEntry) => record.n.every((id) => narratorIds(entry).includes(id))
  const exact = matches.find((entry) => agrees(entry) && coversAll(entry))
  if (exact) return { class: 'MATCHED', missingNarrators: [], matchedEntryIds: matches.map((entry) => entry.id), ambiguous }

  const partial = matches.find((entry) => agrees(entry) && overlapCount(record.n, entry) > 0)
  if (partial) {
    const present = new Set(narratorIds(partial))
    return {
      class: 'NARRATORS_MISSING',
      missingNarrators: record.n.filter((id) => !present.has(id)),
      matchedEntryIds: matches.map((entry) => entry.id),
      ambiguous,
    }
  }

  const conflict = matches.find((entry) => overlapCount(record.n, entry) > 0)
  if (conflict) return { class: 'TEXT_CONFLICT', missingNarrators: [], matchedEntryIds: matches.map((entry) => entry.id), ambiguous }
  return { class: 'MISSING', missingNarrators: [...record.n], matchedEntryIds: matches.map((entry) => entry.id), ambiguous }
}

export function locateNquranDifference(
  difference: NquranDifference,
  surah: number,
  ayah: number,
  entriesIndex: EntriesIndex,
): LocatedNquranDifference {
  const words = entriesIndex.ayahWords.get(ayahKey(surah, ayah)) ?? []
  const wordNumbers = words
    .filter((word) => findNquranDifferencesForWord([difference], word.text, { wordIndex: word.word, ayahWords: words }).length > 0)
    .map((word) => word.word)
  return { ...difference, surah, ayah, wordNumbers }
}

export function classifyNquranGroup(
  difference: LocatedNquranDifference,
  group: NquranReaderGroup,
  entriesIndex: EntriesIndex,
): NquranClassification | null {
  const resolved = resolveDifferenceGroups(difference).find((candidate) => candidate.group === group)
    ?? resolveDifferenceGroups(difference).find((candidate) =>
      candidate.group.reading === group.reading && candidate.group.readers.join('\u0000') === group.readers.join('\u0000'))
  const narratorSet = resolved?.narratorIds ?? []
  const unresolvedLabels = resolved?.unresolvedLabels ?? [...group.readers]

  // Hafs is the reference spelling, not a database difference to import.
  if (narratorSet.includes('Q05-R02')) return null
  if (unresolvedLabels.length > 0 || narratorSet.length === 0) {
    return { class: 'UNRESOLVED_READER', missingNarrators: [], matchedEntryIds: [], ambiguous: false, narratorIds: narratorSet, unresolvedLabels }
  }

  const entries = (entriesIndex.byAyah.get(ayahKey(difference.surah, difference.ayah)) ?? [])
    .filter((entry) => difference.wordNumbers.some((word) => entryOverlaps(entry, word, word)))
    .sort((a, b) => overlapCount(narratorSet, b) - overlapCount(narratorSet, a) || a.id.localeCompare(b.id))
  const ids = entries.map((entry) => entry.id)
  const ambiguous = entries.length > 1
  if (entries.some((entry) => narratorSet.every((id) => narratorIds(entry).includes(id)))) {
    return { class: 'MATCHED', missingNarrators: [], matchedEntryIds: ids, ambiguous, narratorIds: narratorSet, unresolvedLabels: [] }
  }
  const partial = entries.find((entry) => overlapCount(narratorSet, entry) > 0)
  if (partial) {
    const present = new Set(narratorIds(partial))
    return {
      class: 'NARRATORS_MISSING',
      missingNarrators: narratorSet.filter((id) => !present.has(id)),
      matchedEntryIds: ids,
      ambiguous,
      narratorIds: narratorSet,
      unresolvedLabels: [],
    }
  }
  return { class: 'MISSING', missingNarrators: [...narratorSet], matchedEntryIds: ids, ambiguous, narratorIds: narratorSet, unresolvedLabels: [] }
}
