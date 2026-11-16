import { MUSHAF_PAGE_COUNT, type AyahKey, makeAyahKey } from './types'
import type { QuranIndex } from './quranIndex'
import type { MemorizationSelection } from './selection'

/**
 * Where typed text such as «البقرة 255» or «صفحة 42» leads.
 * Matches iOS `SelectionTarget`.
 */
export type SelectionTarget =
  | { readonly type: 'selection'; readonly selection: MemorizationSelection }
  | { readonly type: 'surahDetail'; readonly surah: number }
  | { readonly type: 'page'; readonly page: number }
  | { readonly type: 'ayah'; readonly key: AyahKey }
  | { readonly type: 'juz'; readonly juz: number }

/**
 * Converts a target into the MemorizationSelection that should be preselected.
 */
export function targetToSelection(target: SelectionTarget): MemorizationSelection {
  switch (target.type) {
    case 'selection':
      return target.selection
    case 'surahDetail':
      return { type: 'surah', surah: target.surah }
    case 'page':
      return { type: 'pageRange', startPage: target.page, endPage: target.page }
    case 'ayah':
      return {
        type: 'ayahRange',
        surah: target.key.surah,
        from: target.key.ayah,
        to: target.key.ayah,
      }
    case 'juz':
      return { type: 'juz', juz: target.juz }
  }
}

/**
 * Search-only Arabic text normalization matching iOS QuranSearchNormalizer.
 */
export function normalizeArabicDigits(text: string): string {
  let result = ''
  for (const char of text) {
    const code = char.charCodeAt(0)
    if (code >= 0x0660 && code <= 0x0669) {
      result += String.fromCharCode(code - 0x0660 + 0x30)
    } else if (code >= 0x06f0 && code <= 0x06f9) {
      result += String.fromCharCode(code - 0x06f0 + 0x30)
    } else {
      result += char
    }
  }
  return result
}

export function cleanupArabicText(text: string): string {
  const nfc = text.normalize('NFC')
  let cleaned = ''
  for (const char of nfc) {
    const code = char.codePointAt(0) ?? 0
    if (
      code === 0x0640 || // tatweel
      (code >= 0x06d6 && code <= 0x06ed) || // Quranic annotation signs
      code === 0x200b || // ZWSP
      code === 0x200c || // ZWNJ
      code === 0x200d || // ZWJ
      code === 0xfeff || // BOM
      /\p{M}/u.test(char) || // Diacritical marks
      /\p{C}/u.test(char) // Control characters
    ) {
      continue
    }
    cleaned += char
  }
  return cleaned.trim().split(/\s+/).filter(Boolean).join(' ')
}

export function canonicalArabic(text: string): string {
  const cleaned = cleanupArabicText(text)
  let result = ''
  for (const char of cleaned) {
    const code = char.codePointAt(0) ?? 0
    switch (code) {
      case 0x0621: // hamza
      case 0x0622: // alef with madda
      case 0x0623: // alef with hamza above
      case 0x0625: // alef with hamza below
      case 0x0671: // wasla
        result += 'ا'
        break
      case 0x0649: // alef maqsura
        result += 'ي'
        break
      case 0x0629: // ta marbuta
        result += 'ه'
        break
      case 0x0624: // waw with hamza
        result += 'و'
        break
      case 0x0626: // yeh with hamza
        result += 'ي'
        break
      default:
        result += char
    }
  }
  return result
}

const PAGE_KEYWORDS = new Set<string>([
  canonicalArabic('صفحة'),
  canonicalArabic('صفحه'),
  canonicalArabic('ص'),
])

const JUZ_KEYWORDS = new Set<string>([
  canonicalArabic('الجزء'),
  canonicalArabic('جزء'),
  canonicalArabic('ج'),
])

const SURAH_KEYWORD = canonicalArabic('سورة')

function matchSurah(query: string, names: Record<number, string>): number | null {
  if (!query) return null
  const article = canonicalArabic('ال')
  const prefixMatches: number[] = []

  const sortedSurahs = Object.entries(names)
    .map(([numStr, name]) => ({ number: Number(numStr), name }))
    .sort((a, b) => a.number - b.number)

  for (const { number, name } of sortedSurahs) {
    const full = canonicalArabic(name)
    const bare = full.startsWith(article) && full.length > article.length ? full.slice(article.length) : full
    if (full === query || bare === query) {
      return number
    }
    if (query.length >= 2 && (full.startsWith(query) || bare.startsWith(query))) {
      prefixMatches.push(number)
    }
  }

  return prefixMatches.length === 1 ? prefixMatches[0] : null
}

/**
 * Understands «يس», «سورة يس», «البقرة 255», «صفحة 42», «ص 42», «الجزء 30» with Latin, Arabic-Indic and
 * Eastern Arabic digits; harakat, alef and ta marbuta variants are ignored. Null for anything else.
 */
export function parseSelectionTarget(
  text: string,
  surahNames: Record<number, string>,
  index: QuranIndex,
): SelectionTarget | null {
  const normalizedDigits = normalizeArabicDigits(text)
  const tokens = normalizedDigits.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return null

  if (tokens.length === 2 && /^\d+$/.test(tokens[1])) {
    const num = Number.parseInt(tokens[1], 10)
    const keyword = canonicalArabic(tokens[0])
    if (PAGE_KEYWORDS.has(keyword)) {
      return num >= 1 && num <= MUSHAF_PAGE_COUNT ? { type: 'page', page: num } : null
    }
    if (JUZ_KEYWORDS.has(keyword)) {
      return num >= 1 && num <= 30 ? { type: 'juz', juz: num } : null
    }
  }

  const nameTokens = [...tokens]
  let ayah: number | null = null
  if (nameTokens.length > 1 && /^\d+$/.test(nameTokens[nameTokens.length - 1])) {
    ayah = Number.parseInt(nameTokens[nameTokens.length - 1], 10)
    nameTokens.pop()
  }

  if (nameTokens.length > 1 && canonicalArabic(nameTokens[0]) === SURAH_KEYWORD) {
    nameTokens.shift()
  }

  const surah = matchSurah(canonicalArabic(nameTokens.join(' ')), surahNames)
  if (!surah) return null
  if (ayah === null) return { type: 'surahDetail', surah }
  if (ayah < 1 || ayah > index.ayahCount(surah)) return null

  return { type: 'ayah', key: makeAyahKey(surah, ayah) }
}
