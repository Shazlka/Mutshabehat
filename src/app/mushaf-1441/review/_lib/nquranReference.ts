// External reference only -- never authoritative, never auto-applied. Mirrors this project's
// established discipline for every other external Qiraat source (see CLAUDE.md's "Qiraat" entries):
// a source like nquran.com informs a reviewer's own judgement while they fill in "٢. نص القراءة
// والبيان" and "٣. القراء والرواة والأوجه"; it is displayed, never written into any field or record.
//
// Currently covers only سورة البقرة (surahNumber 2) -- the one supplied dataset. Looking up any
// other surah returns an empty list, which callers treat as "no reference available" rather than
// an error.

import { normalizeArabic } from '@/lib/arabic'

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
  ayahText: string
  sourceUrl: string
  differences: NquranDifference[]
}

let baqarahEntriesPromise: Promise<NquranAyahEntry[]> | null = null

/** Lazily loads the ~1.6 MB Baqarah reference file as its own chunk, only when a reviewer is
 * actually looking at a Baqarah word -- never bundled into the editor's initial load. */
export function loadNquranBaqarahReference(): Promise<NquranAyahEntry[]> {
  if (!baqarahEntriesPromise) {
    baqarahEntriesPromise = import('./reference/baqarah-nquran-differences.json').then(
      (mod) => (mod.default ?? mod) as unknown as NquranAyahEntry[],
    )
  }
  return baqarahEntriesPromise
}

/** Surahs this reference dataset currently covers. */
export function hasNquranReferenceForSurah(surahNumber: number): boolean {
  return surahNumber === 2
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
