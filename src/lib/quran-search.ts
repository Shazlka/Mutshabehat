/**
 * Quran Search Engine — iOS parity
 * Pure search logic: Smart / Exact / Broad modes, Arabic normalisation,
 * Uthmani orthography folding, ayah reference parsing, ranking, and highlighting.
 *
 * References:
 * - iOS: apps/ios/Sources/Reader/AyahSearchView.swift:24–37, 249–297
 * - iOS: apps/ios/MushafCore/Sources/MushafCore/QuranSearch.swift:3–114
 * - iOS: apps/ios/MushafCore/Sources/MushafCore/MushafDatabase.swift:114–196
 */

import { matchRanges, normalizeArabic, rasmSkeleton } from '@/lib/arabic'
import {
  getMushaf1441PageForAyahKey,
  getMushaf1441SurahOption,
  MUSHAF_1441_SURAH_OPTIONS,
} from '../../packages/quran-data/mushaf1441/pageMetadata'

export type QuranSearchMode = 'smart' | 'exact' | 'broad'

export const MAX_SEARCH_RESULTS = 200

export interface QuranSearchResult {
  surah: number
  ayah: number
  page: number
  text: string
  surahName: string
  score: number
  matchType: 'reference' | 'exact' | 'smart' | 'broad'
}

export interface AyahReference {
  surah: number
  ayah: number
  surahName: string
  page: number
}

export interface IndexedAyah {
  surah: number
  ayah: number
  page: number
  text: string
  surahName: string
  norm: string
  skel: string
}

// ── Arabic / Uthmani Normalization ──────────────────────────────────────────

const AR_INDIC_DIGITS: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
}

export function toLatinDigits(str: string): string {
  return (str || '').replace(/[٠-٩]/g, (d) => AR_INDIC_DIGITS[d] ?? d)
}

/**
 * Normalizes Arabic text for Quran searching, handling common Uthmani rasm variations
 * such as waw with dagger alef (الصلوة/الصلاة, الزكوة/الزكاة, الحيوة/الحياة, الربوا/الربا)
 * and alef/hamza forms. Mirrors iOS QuranSearchNormalizer.
 */
export function canonicalizeForSearch(text: string): string {
  if (!text) return ''
  // 1. Base normalization (tashkeel stripping, alef/hamza/ya/ta-marbuta folding, dagger-alef -> alef)
  let norm = normalizeArabic(text)

  // 2. Normalize "يا أيها" / "يا ايها" forms to match Uthmani "يأيها" / "ياايها"
  norm = norm
    .replace(/يا\s+ايها/g, 'يايها')
    .replace(/ياايها/g, 'يايها')

  // 3. Fold common Uthmani orthography spellings (mirrors QuranSearch.swift orthographyRules)
  norm = norm
    .replace(/صلوا?ه/g, 'صلاه')
    .replace(/زكوا?ه/g, 'زكاه')
    .replace(/حيوا?ه/g, 'حياه')
    .replace(/ربوا/g, 'ربا')
    .replace(/الربو(?!\w)/g, 'الربا')
    .replace(/مشكوا?ه/g, 'مشكاه')
    .replace(/نجوا?ه/g, 'نجاه')
    .replace(/غدوا?ه/g, 'غداه')
    .replace(/منوا?ه/g, 'مناه')
    // Fold dagger-alef forms where standard Arabic spelling omits the alef
    .replace(/الاه/g, 'اله')
    .replace(/رحمان/g, 'رحمن')
    .replace(/(^|\s)هاذا(?=\s|$)/g, '$1هذا')
    .replace(/(^|\s)هاذه(?=\s|$)/g, '$1هذه')
    .replace(/(^|\s)هاذان(?=\s|$)/g, '$1هذان')
    .replace(/(^|\s)هاولاء(?=\s|$)/g, '$1هولاء')
    .replace(/ذالك/g, 'ذلك')
    .replace(/لاكن/g, 'لكن')
    .replace(/اولايك/g, 'اوليك')
    .replace(/العلمين/g, 'العالمين')
    .replace(/الانهر/g, 'الانهار')
    .replace(/رجعون/g, 'راجعون')
    .replace(/سموات/g, 'سماوات')
    .replace(/ايمن/g, 'ايمان')
    .replace(/اسراييل/g, 'اسرايل')
    .replace(/قراان/g, 'قران')

  return norm.replace(/\s+/g, ' ').trim()
}

// ── Ayah Reference Parsing ──────────────────────────────────────────────────

/**
 * Parses queries like "2:255", "2 255", "البقرة 255", "سورة البقرة 255", "البقرة:255", "٢:٢٥٥".
 * Returns verified surah/ayah and page if valid, or null.
 */
export function parseAyahReference(query: string): AyahReference | null {
  if (!query) return null
  const cleaned = toLatinDigits(query).trim()

  // Case A: numeric reference (e.g. "2:255", "2 255", "2/255", "2,255")
  const numMatch = cleaned.match(/^(\d{1,3})\s*[:\s/,\-]\s*(\d{1,3})$/)
  if (numMatch) {
    const surahNum = parseInt(numMatch[1], 10)
    const ayahNum = parseInt(numMatch[2], 10)
    if (surahNum >= 1 && surahNum <= 114) {
      const surahOption = getMushaf1441SurahOption(surahNum)
      if (surahOption && ayahNum >= 1 && ayahNum <= surahOption.ayahCount) {
        const page = getMushaf1441PageForAyahKey(`${surahNum}:${ayahNum}`) ?? surahOption.firstPage ?? 1
        return {
          surah: surahNum,
          ayah: ayahNum,
          surahName: surahOption.name,
          page,
        }
      }
    }
    return null
  }

  // Case B: surah name followed by ayah number (e.g. "البقرة 255", "سورة البقرة: 255", "البقرة آية 255")
  const nameMatch = cleaned.match(/^(?:سورة|سوره)?\s*([^\d:,\-/]+?)\s*[:\s/,\-]*\s*(?:آية|ايه)?\s*(\d{1,3})$/)
  if (nameMatch) {
    const rawName = nameMatch[1].trim()
    const ayahNum = parseInt(nameMatch[2], 10)
    const normName = normalizeArabic(rawName)
    const normNameNoAl = normName.replace(/^ال/, '')

    const surahOption = MUSHAF_1441_SURAH_OPTIONS.find((s) => {
      const sNorm = normalizeArabic(s.name)
      const sNormNoAl = sNorm.replace(/^ال/, '')
      return sNorm === normName || sNormNoAl === normNameNoAl
    })

    if (surahOption && ayahNum >= 1 && ayahNum <= surahOption.ayahCount) {
      const page = getMushaf1441PageForAyahKey(`${surahOption.surahNumber}:${ayahNum}`) ?? surahOption.firstPage ?? 1
      return {
        surah: surahOption.surahNumber,
        ayah: ayahNum,
        surahName: surahOption.name,
        page,
      }
    }
  }

  return null
}

// ── Search Index Builder ────────────────────────────────────────────────────

export function buildSearchIndex(ayahs: Record<string, Record<string, string>>): IndexedAyah[] {
  const index: IndexedAyah[] = []
  for (const surahOpt of MUSHAF_1441_SURAH_OPTIONS) {
    const s = surahOpt.surahNumber
    const sAyahs = ayahs[String(s)]
    if (!sAyahs) continue
    for (let a = 1; a <= surahOpt.ayahCount; a++) {
      const text = sAyahs[String(a)]
      if (!text) continue
      const page = getMushaf1441PageForAyahKey(`${s}:${a}`) ?? surahOpt.firstPage ?? 1
      index.push({
        surah: s,
        ayah: a,
        page,
        text,
        surahName: surahOpt.name,
        norm: canonicalizeForSearch(text),
        skel: rasmSkeleton(text),
      })
    }
  }
  return index
}

// ── Search Logic ────────────────────────────────────────────────────────────

export interface SearchQuranOptions {
  query: string
  mode?: QuranSearchMode
  limit?: number
  ayahs?: Record<string, Record<string, string>>
}

let cachedAyahs: Record<string, Record<string, string>> | null = null
let cachedIndex: IndexedAyah[] | null = null
let inFlightFetch: Promise<Record<string, Record<string, string>>> | null = null

export async function fetchAyahsData(): Promise<Record<string, Record<string, string>>> {
  if (cachedAyahs) return cachedAyahs
  if (inFlightFetch) return inFlightFetch

  inFlightFetch = (async () => {
    try {
      const res = await fetch('/quran/ayahs.json')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as Record<string, Record<string, string>>
      cachedAyahs = data
      cachedIndex = buildSearchIndex(data)
      return data
    } finally {
      inFlightFetch = null
    }
  })()

  return inFlightFetch
}

export function setCachedAyahsData(data: Record<string, Record<string, string>>) {
  cachedAyahs = data
  cachedIndex = buildSearchIndex(data)
}

export function getCachedAyahsData(): Record<string, Record<string, string>> | null {
  return cachedAyahs
}

/**
 * Searches Quran ayahs according to mode (Smart / Exact / Broad).
 * Pure function: accepts ayahs dataset directly or uses the cached index.
 */
export function searchQuran(options: SearchQuranOptions): QuranSearchResult[] {
  const { query, mode = 'smart', limit = MAX_SEARCH_RESULTS, ayahs } = options
  const trimmed = (query || '').trim()
  if (!trimmed) return []

  const maxLimit = Math.min(limit, MAX_SEARCH_RESULTS)

  // 1. Ayah reference parsing in Smart mode (or if query strictly matches reference format)
  if (mode === 'smart') {
    const ref = parseAyahReference(trimmed)
    if (ref) {
      let ayahText: string | null = null
      if (ayahs) {
        ayahText = ayahs[String(ref.surah)]?.[String(ref.ayah)] ?? null
      } else if (cachedAyahs) {
        ayahText = cachedAyahs[String(ref.surah)]?.[String(ref.ayah)] ?? null
      }
      if (ayahText) {
        return [{
          surah: ref.surah,
          ayah: ref.ayah,
          page: ref.page,
          text: ayahText,
          surahName: ref.surahName,
          score: 1000,
          matchType: 'reference',
        }]
      }
    }
  }

  // Obtain the indexed ayahs list
  let index: IndexedAyah[]
  if (ayahs && ayahs === cachedAyahs && cachedIndex) {
    index = cachedIndex
  } else if (ayahs) {
    index = buildSearchIndex(ayahs)
  } else if (cachedIndex) {
    index = cachedIndex
  } else if (cachedAyahs) {
    cachedIndex = buildSearchIndex(cachedAyahs)
    index = cachedIndex
  } else {
    return []
  }

  if (mode === 'exact') {
    return searchExact(trimmed, index, maxLimit)
  } else if (mode === 'broad') {
    return searchBroad(trimmed, index, maxLimit)
  } else {
    return searchSmart(trimmed, index, maxLimit)
  }
}

/**
 * Exact search: contiguous phrase match.
 */
function searchExact(query: string, index: IndexedAyah[], limit: number): QuranSearchResult[] {
  const cleanQ = canonicalizeForSearch(query.replace(/["”«»]/g, ''))
  if (!cleanQ) return []

  const results: QuranSearchResult[] = []

  for (const item of index) {
    if (item.norm.includes(cleanQ)) {
      // Score: exact boundary gets higher score
      const isWordBoundary = new RegExp(`(?:^|\\s)${escapeRegex(cleanQ)}(?:$|\\s)`).test(item.norm)
      const score = isWordBoundary ? 100 : 80
      results.push({
        surah: item.surah,
        ayah: item.ayah,
        page: item.page,
        text: item.text,
        surahName: item.surahName,
        score,
        matchType: 'exact',
      })
      if (results.length >= limit) break
    }
  }

  return results
}

/**
 * Smart search: AND of normalized tokens in any order + ranking.
 * Port of iOS ranking: exact phrase matches first, followed by unprefixed token matches,
 * then surah/ayah order.
 */
function searchSmart(query: string, index: IndexedAyah[], limit: number): QuranSearchResult[] {
  const cleanQuery = canonicalizeForSearch(query)
  if (!cleanQuery) return []

  const tokens = cleanQuery.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []

  const hits: QuranSearchResult[] = []

  for (const item of index) {
    // Check if ALL tokens match
    let allTokensMatch = true
    for (const t of tokens) {
      if (!item.norm.includes(t)) {
        allTokensMatch = false
        break
      }
    }

    if (allTokensMatch) {
      let score = 100
      // Bonus 1: Contiguous phrase match
      if (item.norm.includes(cleanQuery)) {
        score += 50
      }
      // Bonus 2: Unprefixed matches (iOS AyahSearchView.swift:283)
      for (const t of tokens) {
        const standaloneRegex = new RegExp(`(?:^|\\s)${escapeRegex(t)}(?:$|\\s)`)
        if (standaloneRegex.test(item.norm)) {
          score += 15
        } else if (!t.startsWith('ال') && !t.startsWith('و') && !t.startsWith('ف')) {
          score += 5
        }
      }

      hits.push({
        surah: item.surah,
        ayah: item.ayah,
        page: item.page,
        text: item.text,
        surahName: item.surahName,
        score,
        matchType: 'smart',
      })
    }
  }

  // Sort by score descending, then by surah ascending, then ayah ascending
  hits.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score
    if (a.surah !== b.surah) return a.surah - b.surah
    return a.ayah - b.ayah
  })

  return hits.slice(0, limit)
}

/**
 * Broad search: any token (OR) match, ranked by match count.
 */
function searchBroad(query: string, index: IndexedAyah[], limit: number): QuranSearchResult[] {
  const cleanQuery = canonicalizeForSearch(query)
  if (!cleanQuery) return []

  const tokens = cleanQuery.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []

  const hits: QuranSearchResult[] = []

  for (const item of index) {
    let matchCount = 0
    for (const t of tokens) {
      if (item.norm.includes(t)) {
        matchCount++
      }
    }

    if (matchCount > 0) {
      let score = matchCount * 25
      if (matchCount === tokens.length) {
        score += 40
      }
      if (item.norm.includes(cleanQuery)) {
        score += 30
      }

      hits.push({
        surah: item.surah,
        ayah: item.ayah,
        page: item.page,
        text: item.text,
        surahName: item.surahName,
        score,
        matchType: 'broad',
      })
    }
  }

  // Sort: highest score (match count) first, then surah/ayah order
  hits.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score
    if (a.surah !== b.surah) return a.surah - b.surah
    return a.ayah - b.ayah
  })

  return hits.slice(0, limit)
}

// ── Match Highlighting Ranges ───────────────────────────────────────────────

/**
 * Computes non-overlapping ranges [start, end) within the original text to highlight.
 */
export function getSearchMatchRanges(text: string, query: string, mode: QuranSearchMode = 'smart'): Array<[number, number]> {
  if (!text || !query.trim()) return []

  // If query is an ayah reference, highlight the whole text
  const ref = parseAyahReference(query)
  if (ref) {
    return [[0, text.length]]
  }

  const rawTokens = query.trim().split(/\s+/).filter(Boolean)
  const ranges: Array<[number, number]> = []

  // If exact mode or contiguous match in smart mode, try contiguous phrase first
  if (mode === 'exact' || (mode === 'smart' && rawTokens.length > 1)) {
    const phraseRanges = matchRanges(text, query.trim())
    if (phraseRanges.length > 0) {
      return phraseRanges
    }
  }

  // Check individual tokens
  for (const t of rawTokens) {
    if (t.length < 2) continue
    const tRanges = matchRanges(text, t)
    ranges.push(...tRanges)
  }

  if (ranges.length === 0) return []

  // Sort and merge overlapping or adjacent ranges
  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const merged: Array<[number, number]> = [ranges[0]]

  for (let i = 1; i < ranges.length; i++) {
    const prev = merged[merged.length - 1]
    const curr = ranges[i]
    if (curr[0] <= prev[1]) {
      prev[1] = Math.max(prev[1], curr[1])
    } else {
      merged.push(curr)
    }
  }

  return merged
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
