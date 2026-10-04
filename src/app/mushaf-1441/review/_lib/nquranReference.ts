// External reference only -- never authoritative, never auto-applied. Mirrors this project's
// established discipline for every other external Qiraat source (see CLAUDE.md's "Qiraat" entries):
// a source like nquran.com informs a reviewer's own judgement while they fill in "٢. نص القراءة
// والبيان" and "٣. القراء والرواة والأوجه"; it is displayed, never written into any field or record.
//
// Covers all 114 surahs (6,236 ayahs), one lazily-loaded JSON file per surah under
// `reference/nquran/` (built by scripts/qiraat/build_nquran_reference.py from the nquran.com
// page-section export). A surah outside 1..114 has no reference, which callers treat as
// "no reference available" rather than an error.

import { normalizeArabic } from '@/lib/arabic'
import { CANONICAL_READERS } from '../_components/ReaderNarratorSelector'
import {
  proposeReferenceDecision,
  type ReferenceDecision,
  type ReferenceDecisionStatus,
  type ReferenceGroup,
} from './referenceGroup'

export interface NquranReaderGroup {
  readers: string[]
  reading: string
}

export interface NquranDifference {
  location: string
  groups: NquranReaderGroup[]
}

export interface NquranAyahEntry {
  surah: string
  surahNumber: number
  ayah: number
  ayahText?: string
  sourceUrl: string
  differences: NquranDifference[]
}

const surahEntriesPromises = new Map<number, Promise<NquranAyahEntry[]>>()

/** Lazily loads one surah's reference file as its own chunk, only when a reviewer is actually
 * looking at a word of that surah -- never bundled into the editor's initial load. */
export function loadNquranReference(surahNumber: number): Promise<NquranAyahEntry[]> {
  if (!hasNquranReferenceForSurah(surahNumber)) return Promise.resolve([])
  let promise = surahEntriesPromises.get(surahNumber)
  if (!promise) {
    const file = String(surahNumber).padStart(3, '0')
    promise = import(`./reference/nquran/surah-${file}.json`).then(
      (mod) => (mod.default ?? mod) as unknown as NquranAyahEntry[],
    )
    surahEntriesPromises.set(surahNumber, promise)
  }
  return promise
}

/** Surahs this reference dataset covers: all 114. */
export function hasNquranReferenceForSurah(surahNumber: number): boolean {
  return Number.isInteger(surahNumber) && surahNumber >= 1 && surahNumber <= 114
}

export function findNquranEntryForAyah(entries: NquranAyahEntry[], ayah: number): NquranAyahEntry | null {
  return entries.find((entry) => entry.ayah === ayah) ?? null
}

/**
 * Ranks an ayah's differences by relevance to the currently selected word, so the one difference
 * about that exact word surfaces first instead of a reviewer scanning the whole ayah. A location
 * "matches" the word when either text contains the other after Arabic normalization (locations are
 * often multi-word phrases, e.g. "فيه هدى", and a word can be a substring of one).
 */
export function rankDifferencesForWord(
  differences: readonly NquranDifference[],
  wordText: string,
): { difference: NquranDifference; matchesWord: boolean }[] {
  const normWord = normalizeArabic(wordText)
  return differences
    .map((difference) => {
      const normLocation = normalizeArabic(difference.location)
      const matchesWord = normWord.length > 0 && (
        normLocation.includes(normWord) || normWord.includes(normLocation)
      )
      return { difference, matchesWord }
    })
    .sort((a, b) => Number(b.matchesWord) - Number(a.matchesWord))
}

// ── Reconciliation: nquran.com reader labels → this app's narrator IDs ──────────────────────────
//
// The dataset's reader-group labels are a closed, finite set (checked across every group in the
// supplied Baqarah file: 29 distinct strings) that map 1:1 onto CANONICAL_READERS' ids -- but the
// mapping is hand-written rather than derived by string concatenation, because the dataset's
// narrator labels use the genitive Arabic form ("السوسي عن أبي عمرو", not "عن أبو عمرو") that a
// naive `${narrator} عن ${reader}` join would get wrong for exactly the "أبو"→"أبي" cases. Getting
// this wrong would silently misattribute a reading to the wrong narrator, so it is spelled out
// explicitly and normalized (alef/hamza-tolerant) on lookup rather than guessed.

export const ALL_NARRATOR_IDS: readonly string[] = CANONICAL_READERS.flatMap((r) => r.narrators.map((n) => n.id))

const READER_WHOLE_BY_LABEL: Record<string, string> = {
  'نافع': 'Q01',
  'ابن كثير': 'Q02',
  'أبو عمرو': 'Q03',
  'ابن عامر': 'Q04',
  'عاصم': 'Q05',
  'حمزة': 'Q06',
  'الكسائي': 'Q07',
  'أبو جعفر': 'Q08',
  'يعقوب': 'Q09',
  'خلف العاشر': 'Q10',
}

const NARRATOR_ID_BY_LABEL: Record<string, string> = {
  'قالون عن نافع': 'Q01-R01',
  'ورش عن نافع': 'Q01-R02',
  'البزي عن ابن كثير': 'Q02-R01',
  'قنبل عن ابن كثير': 'Q02-R02',
  'الدوري عن أبي عمرو': 'Q03-R01',
  'السوسي عن أبي عمرو': 'Q03-R02',
  'هشام عن ابن عامر': 'Q04-R01',
  'ابن ذكوان عن ابن عامر': 'Q04-R02',
  'شعبة عن عاصم': 'Q05-R01',
  'حفص عن عاصم': 'Q05-R02',
  'خلف عن حمزة': 'Q06-R01',
  'خلاد عن حمزة': 'Q06-R02',
  'أبو الحارث عن الكسائي': 'Q07-R01',
  'الدوري عن الكسائي': 'Q07-R02',
  'ابن وردان عن أبي جعفر': 'Q08-R01',
  'ابن جماز عن أبي جعفر': 'Q08-R02',
  'رويس عن يعقوب': 'Q09-R01',
  'روح عن يعقوب': 'Q09-R02',
  'إسحاق عن خلف العاشر': 'Q10-R01',
  'إدريس عن خلف العاشر': 'Q10-R02',
}

const REMAINDER_LABELS = new Set(['باقي الرواة', 'باقي القراء'])
const ALL_READERS_LABELS = new Set(['كل الرواة', 'جميع الرواة', 'كل القراء'])

function normLabel(label: string): string {
  return normalizeArabic(label).trim()
}

const READER_WHOLE_NORM = new Map(Object.entries(READER_WHOLE_BY_LABEL).map(([k, v]) => [normLabel(k), v]))
const NARRATOR_ID_NORM = new Map(Object.entries(NARRATOR_ID_BY_LABEL).map(([k, v]) => [normLabel(k), v]))
const REMAINDER_NORM = new Set([...REMAINDER_LABELS].map(normLabel))
const ALL_READERS_NORM = new Set([...ALL_READERS_LABELS].map(normLabel))

export type ResolvedReaderLabel =
  | { kind: 'reader'; readerId: string }
  | { kind: 'narrator'; narratorId: string }
  | { kind: 'remainder' }
  | { kind: 'all' }
  | { kind: 'unresolved'; label: string }

export function resolveNquranReaderLabel(label: string): ResolvedReaderLabel {
  const key = normLabel(label)
  const narratorId = NARRATOR_ID_NORM.get(key)
  if (narratorId) return { kind: 'narrator', narratorId }
  const readerId = READER_WHOLE_NORM.get(key)
  if (readerId) return { kind: 'reader', readerId }
  if (REMAINDER_NORM.has(key)) return { kind: 'remainder' }
  if (ALL_READERS_NORM.has(key)) return { kind: 'all' }
  return { kind: 'unresolved', label }
}

function narratorIdsForReaderId(readerId: string): string[] {
  const reader = CANONICAL_READERS.find((r) => r.id === readerId)
  return reader ? reader.narrators.map((n) => n.id) : []
}

export interface ResolvedNquranGroup {
  group: NquranReaderGroup
  /** Concrete narrator ids this group covers; empty when every label in it was unresolved. */
  narratorIds: string[]
  unresolvedLabels: string[]
}

/**
 * Resolves every group in a difference to concrete narrator ids, computing "باقي الرواة" as the
 * complement of every other group's ids within the 20 canonical narrators. Order-independent: the
 * remainder group can appear anywhere in the list, not just last.
 */
export function resolveDifferenceGroups(difference: NquranDifference): ResolvedNquranGroup[] {
  const explicit: { group: NquranReaderGroup; narratorIds: string[]; unresolvedLabels: string[] }[] = []
  const remainderGroups: NquranReaderGroup[] = []
  const usedIds = new Set<string>()

  for (const group of difference.groups) {
    const narratorIds = new Set<string>()
    const unresolvedLabels: string[] = []
    let isRemainderOnly = group.readers.length > 0
    for (const label of group.readers) {
      const resolved = resolveNquranReaderLabel(label)
      if (resolved.kind === 'narrator') {
        narratorIds.add(resolved.narratorId)
        isRemainderOnly = false
      } else if (resolved.kind === 'reader') {
        for (const id of narratorIdsForReaderId(resolved.readerId)) narratorIds.add(id)
        isRemainderOnly = false
      } else if (resolved.kind === 'all') {
        for (const id of ALL_NARRATOR_IDS) narratorIds.add(id)
        isRemainderOnly = false
      } else if (resolved.kind === 'unresolved') {
        unresolvedLabels.push(resolved.label)
        isRemainderOnly = false
      }
      // 'remainder' labels fall through -- handled below once every explicit group is known.
    }
    if (isRemainderOnly) {
      remainderGroups.push(group)
      continue
    }
    for (const id of narratorIds) usedIds.add(id)
    explicit.push({ group, narratorIds: [...narratorIds], unresolvedLabels })
  }

  const remainderIds = ALL_NARRATOR_IDS.filter((id) => !usedIds.has(id))
  return [
    ...explicit,
    ...remainderGroups.map((group) => ({ group, narratorIds: remainderIds, unresolvedLabels: [] })),
  ]
}

// The reconciliation logic is source-agnostic and lives in referenceGroup.ts; these keep the
// original names so existing callers and tests are unchanged.
export const proposeNquranDecision = proposeReferenceDecision
export type NquranDecisionStatus = ReferenceDecisionStatus
export type NquranDecision = ReferenceDecision

/** One nquran difference as source-agnostic groups for the shared reference panel. */
export function nquranGroupsForDifference(difference: NquranDifference): ReferenceGroup[] {
  return resolveDifferenceGroups(difference).map((resolved, index) => ({
    key: String(index),
    readersLabel: resolved.group.readers.join('، '),
    narratorIds: resolved.narratorIds,
    performanceText: resolved.group.reading,
    unresolvedLabels: resolved.unresolvedLabels,
  }))
}
