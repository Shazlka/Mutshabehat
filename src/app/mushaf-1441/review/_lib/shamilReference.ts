// «الشامل في قراءات الأئمة العشر» as an external reference source for the review editor. Like
// nquran.com it is display-only -- never authoritative, never auto-applied: a reviewer reads it while
// filling in the face and presses «حفظ» themselves.
//
// Data: one lazily-loaded JSON file per surah under `reference/shamil/` plus `index.json`, both built
// by scripts/qiraat/build_shamil_reference.py. Coverage comes from index.json (not "1..114"): a
// dynamic import of a missing file would fail at runtime.

import { nquranGroupsForDifference, type NquranDifference } from './nquranReference'
import { normalizeArabic } from '@/lib/arabic'
import { CANONICAL_READERS } from '../_components/ReaderNarratorSelector'
import { describeNarratorGroupText } from '../_components/narratorDisplay'
import type { ReferenceCondition, ReferenceGroup, ReferenceSuggestion } from './referenceGroup'
import shamilIndex from './reference/shamil/index.json'

export interface ShamilWajh {
  id: string
  wajh: number
  description: string
  readingText: string | null
  condition: ReferenceCondition
  conditionBasis: string
  /** الشامل narrator ids, see SHAMIL_NARRATOR_TO_ID. */
  narrators: string[]
  type: 'usul' | 'farsh'
  category: string
}

export interface ShamilEntry {
  entryId: string
  page: number
  ayahs: number[]
  words: string[]
  type?: 'usul' | 'farsh'
  category?: string
  sourceDifference?: NquranDifference
  sourceUrl?: string
  scope: 'this_word' | 'all_quran'
  sourceText: string
  flags: string[]
  wajhs: ShamilWajh[]
}

export const SHAMIL_NARRATOR_TO_ID: Readonly<Record<string, string>> = {
  qalun: 'Q01-R01',
  warsh: 'Q01-R02',
  bazzi: 'Q02-R01',
  qunbul: 'Q02-R02',
  duri_abuamr: 'Q03-R01',
  susi: 'Q03-R02',
  hisham: 'Q04-R01',
  ibn_dhakwan: 'Q04-R02',
  shubah: 'Q05-R01',
  hafs: 'Q05-R02',
  khalaf_hamzah: 'Q06-R01',
  khallad: 'Q06-R02',
  abulharith: 'Q07-R01',
  duri_kisai: 'Q07-R02',
  ibn_wardan: 'Q08-R01',
  ibn_jammaz: 'Q08-R02',
  ruways: 'Q09-R01',
  rawh: 'Q09-R02',
  ishaq: 'Q10-R01',
  idris: 'Q10-R02',
}

/**
 * Key two spellings of a word are compared by. `normalizeArabic` plus dropping the hamza letter:
 * الشامل writes «ءَاخِرَة» where the Mushaf writes «ـَٔاخِرَة», which `normalizeArabic` alone leaves
 * apart. The file's own `normalized` field is deliberately not used.
 */
export function matchKey(text: string): string {
  return normalizeArabic(text).replace(/ء/g, '')
}

/** Surahs that have الشامل data -- from the generated index, not 1..114. */
export function hasShamilReferenceForSurah(surah: number): boolean {
  return Number.isInteger(surah) && String(surah) in shamilIndex.surahs
}

const surahPromises = new Map<number, Promise<ShamilEntry[]>>()

/** Lazily loads one surah's file as its own chunk; resolves `[]` for a surah with no data. */
export function loadShamilReference(surah: number): Promise<ShamilEntry[]> {
  if (!hasShamilReferenceForSurah(surah)) return Promise.resolve([])
  let promise = surahPromises.get(surah)
  if (!promise) {
    const file = String(surah).padStart(3, '0')
    promise = import(`./reference/shamil/surah-${file}.json`)
      .then((mod) => (mod.default ?? mod) as unknown as ShamilEntry[])
      .catch((error) => {
        surahPromises.delete(surah) // let «إعادة المحاولة» try again
        throw error
      })
    surahPromises.set(surah, promise)
  }
  return promise
}

/** The clicked word's place in its ayah, as the editor knows it (1-based word numbers). */
export interface ShamilAyahContext {
  wordIndex: number
  ayahWords: readonly { word: number; text: string }[]
}

/** Context is only trusted when it covers the ayah from its first word and contains the clicked word. */
function isCompleteContext(context: ShamilAyahContext): boolean {
  const words = context.ayahWords
  return (
    words.length > 0 &&
    words.every((w, i) => w.word === i + 1) &&
    context.wordIndex >= 1 &&
    context.wordIndex <= words.length
  )
}

/**
 * Does `phrase` (tokens) cover the clicked word in this ayah? Either it occurs contiguously here, or it
 * straddles an ayah boundary the entry lists («عظيم وإذ» = end of 2:49 + start of 2:50): then its head
 * must close this ayah, or its tail must open it, with the neighbouring ayah also listed.
 */
function phraseCoversWord(
  phrase: readonly string[],
  keys: readonly string[],
  wordIndex: number,
  neighbours: { previousListed: boolean; nextListed: boolean },
): boolean {
  const at = wordIndex - 1
  for (let start = 0; start + phrase.length <= keys.length; start += 1) {
    if (at < start || at >= start + phrase.length) continue
    if (phrase.every((token, offset) => keys[start + offset] === token)) return true
  }
  for (let split = 1; split < phrase.length; split += 1) {
    if (neighbours.nextListed) {
      const head = phrase.slice(0, split)
      const start = keys.length - head.length
      if (start >= 0 && at >= start && head.every((token, offset) => keys[start + offset] === token)) return true
    }
    if (neighbours.previousListed) {
      const tail = phrase.slice(split)
      if (at < tail.length && tail.every((token, offset) => keys[offset] === token)) return true
    }
  }
  return false
}

/**
 * Entries about the clicked word. The ayah must be one the entry lists, and one of the entry's words
 * (a word or a phrase, split into tokens) must match by `matchKey` -- whole tokens, never substrings.
 * With the ayah's words (`context`) a phrase must also occur contiguously in THIS ayah around the
 * clicked word: a multi-ayah entry does not say which phrase belongs to which ayah, and `matchKey`
 * makes إنّ/أن and مَن/مِن equal, so token equality alone offered entries on unrelated words. Without
 * (or with only part of) the ayah, it falls back to token equality.
 */
export function findShamilEntriesForWord(
  entries: readonly ShamilEntry[],
  ayah: number,
  wordText: string,
  context?: ShamilAyahContext,
): ShamilEntry[] {
  const wanted = matchKey(wordText)
  if (!wanted) return []
  const keys = context && isCompleteContext(context) ? context.ayahWords.map((w) => matchKey(w.text)) : null
  return entries.filter((entry) => {
    if (!entry.ayahs.includes(ayah)) return false
    return entry.words.some((word) => {
      const tokens = matchKey(word).split(/\s+/).filter(Boolean)
      if (keys && context) {
        return (
          keys[context.wordIndex - 1] === wanted &&
          phraseCoversWord(tokens, keys, context.wordIndex, {
            previousListed: entry.ayahs.includes(ayah - 1),
            nextListed: entry.ayahs.includes(ayah + 1),
          })
        )
      }
      return tokens.includes(wanted)
    })
  })
}

const n = normalizeArabic

/** The wasl/waqf condition is a flag in the data, but the saved «الأداء» text should say it too. */
export function shamilPerformanceText(description: string, condition: ReferenceCondition): string {
  if (condition === 'both') return description
  const normalized = n(description)
  if (normalized.includes('وقف') || normalized.includes('وصل')) return description
  return condition === 'waqf' ? `${description} وقفًا` : `${description} وصلاً`
}

const DIRECT_CATEGORY: Readonly<Record<string, string>> = {
  'التقليل والإمالة': 'IMALAH_TAQLIL',
  'الإبدال': 'USUL_IBDAL',
  'إدغام بلا غنة': 'TARK_GHUNNA',
  'صلة الهاء': 'SILAT_HA',
  'الترقيق': 'TARQIQ_RA',
  'التغليظ': 'TAGHLIZ_LAM',
}

/** First match wins; every pattern is checked against `normalizeArabic(description)`. */
const MIXED_BUCKET_RULES: readonly [test: (d: string) => boolean, code: string][] = [
  [(d) => d.startsWith(n('وقفًا')), 'WAQF_HAMZA'],
  [(d) => d.includes(n('ترقيق الراء')), 'TARQIQ_RA'],
  [(d) => d.includes(n('البدل')), 'MADD_BADAL'],
  [(d) => d.includes(n('ميم')), 'USUL_MIM_JAM'],
  [(d) => d.includes(n('السكت')), 'USUL_SAKT'],
  [
    (d) =>
      ['المد المتصل', 'المد المنفصل', 'بين الشين والهمزة', 'مراتبهم'].some((k) => d.includes(n(k))) ||
      ['القصر', 'التوسط', 'الإشباع', 'المد', 'فويق'].some((k) => d.startsWith(n(k))),
    'USUL_MADD',
  ],
  [(d) => d.includes(n('التنوين')), 'IKHFA'],
  [(d) => ['تسهيل الهمزة', 'حذف الهمزة', 'تحقيق الهمزة'].some((k) => d.startsWith(n(k))), 'TAGHYIR_HAMZ'],
]

/**
 * Suggested kind and باب for a wajh. `kind` is the record's own type. The code is only ever a
 * suggestion (the editor shows it as a chip) and is `null` rather than guessed when no rule applies;
 * farsh never gets one. The idgham category mixes kabir and saghir, so only the unambiguous
 * descriptions get a code.
 */
export function suggestShamilCategory(w: Pick<ShamilWajh, 'type' | 'category' | 'description'>): ReferenceSuggestion {
  if (w.type === 'farsh') return { kind: 'farsh', categoryCode: null }
  const direct = DIRECT_CATEGORY[w.category]
  if (direct) return { kind: 'usul', categoryCode: direct }
  const description = n(w.description)
  if (w.category === 'النقل والسكت') {
    if (description.includes(n('سكت'))) return { kind: 'usul', categoryCode: 'USUL_SAKT' }
    if (description.includes(n('نقل'))) return { kind: 'usul', categoryCode: 'USUL_NAQL' }
    if (description.includes(n('تحقيق'))) return { kind: 'usul', categoryCode: 'USUL_TAHQIQ' }
    return { kind: 'usul', categoryCode: null }
  }
  if (w.category === 'إدغام صغير/كبير') {
    if (description.includes(n('الكبير'))) return { kind: 'usul', categoryCode: 'IDGHAM_KABIR' }
    if (/الذال (عند|في) التاء/.test(description)) return { kind: 'usul', categoryCode: 'IDGHAM_SAGHIR' }
    return { kind: 'usul', categoryCode: null }
  }
  if (w.category === 'الأصول/فرش') {
    const rule = MIXED_BUCKET_RULES.find(([test]) => test(description))
    return { kind: 'usul', categoryCode: rule ? rule[1] : null }
  }
  return { kind: 'usul', categoryCode: null }
}

const NARRATOR_NAME_BY_ID = new Map(CANONICAL_READERS.flatMap((r) => r.narrators.map((nr) => [nr.id, nr.nameAr] as const)))

/** One group per wajh, ready for the shared reference panel. */
export function shamilGroupsForEntry(entry: ShamilEntry): ReferenceGroup[] {
  if (entry.sourceDifference) return nquranGroupsForDifference(entry.sourceDifference)
  return entry.wajhs.map((w) => {
    const narratorIds = w.narrators.map((id) => SHAMIL_NARRATOR_TO_ID[id]).filter((id): id is string => Boolean(id))
    return {
      key: w.id,
      readersLabel: describeNarratorGroupText(narratorIds.map((id) => ({ id, nameAr: NARRATOR_NAME_BY_ID.get(id) ?? id }))),
      narratorIds,
      performanceText: shamilPerformanceText(w.description, w.condition),
      readingText: w.readingText,
      condition: w.condition,
      conditionBasis: w.conditionBasis,
      suggestion: suggestShamilCategory(w),
    }
  })
}
