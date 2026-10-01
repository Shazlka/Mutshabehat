import { norm, fold, skeleton } from './normalize'

export interface AyahWordToken {
  word_position: number
  text_uthmani: string
  ayah_number?: number
  normalized?: string
  folded?: string
  skeletal?: string
}

export interface ReanchorMatch {
  startWord: number
  endWord: number
  endAyah?: number
  sourceTokenRaw?: string | number
  isSplitOccurrence?: boolean
  occurrenceIndex?: number
  totalOccurrences?: number
  confidence: 'exact' | 'nearest' | 'split_all' | 'unmatched'
  note?: string
}

const DUAL_OCCURRENCE_REGEX = /مع[ااً]|كلاهما|الموضعين|في الموضعين/
const ISOLATED_PUNCTUATION_REGEX = /[ۖۗۘۙۚۛ۞۩،؛؟,\.\-—]/g

function checkWordMatch(tokenText: string, targetWord: string, fn: (s: string) => string): boolean {
  const t = fn(tokenText)
  const w = fn(targetWord)
  if (!t || !w) return false
  if (t === w) return true

  // Strip conjunctions and prepositions: و, ف, ب, ل
  if ((t.startsWith('و') || t.startsWith('ف') || t.startsWith('ب') || t.startsWith('ل')) && t.slice(1) === w) {
    return true
  }
  if ((w.startsWith('و') || w.startsWith('ف') || w.startsWith('ب') || w.startsWith('ل')) && w.slice(1) === t) {
    return true
  }

  // Strip definite article ال
  if (t.startsWith('ال') && t.slice(2) === w) return true
  if (w.startsWith('ال') && w.slice(2) === t) return true
  if (t.startsWith('وال') && t.slice(1) === w) return true
  if (w.startsWith('وال') && w.slice(1) === t) return true

  return false
}

/**
 * Re-anchors source text against canonical quran_words tokens of the specified ayah (or span).
 */
export function reanchorWord(
  targetText: string,
  ayahTokens: readonly AyahWordToken[],
  sourceTokenRaw?: string | number,
  notesOrDesc?: string
): ReanchorMatch[] {
  if (!targetText || !ayahTokens || ayahTokens.length === 0) {
    return [{
      startWord: -1,
      endWord: -1,
      confidence: 'unmatched',
      sourceTokenRaw,
      note: 'Empty target text or ayah tokens'
    }]
  }

  // Clean isolated waqf and Quranic pause symbols before splitting into words
  const cleanTargetText = targetText.replace(ISOLATED_PUNCTUATION_REGEX, ' ')
  const rawTargetWords = cleanTargetText.trim().split(/\s+/).filter(Boolean)
  const targetLen = rawTargetWords.length

  if (targetLen === 0) {
    return [{
      startWord: -1,
      endWord: -1,
      confidence: 'unmatched',
      sourceTokenRaw,
      note: 'Target text contains only punctuation'
    }]
  }

  // Find matches across tiers: norm -> fold -> skeleton
  const tiers = [norm, fold, skeleton]
  let matches: { index: number; startWord: number; endWord: number; endAyah?: number }[] = []

  for (const tierFn of tiers) {
    matches = []
    for (let i = 0; i <= ayahTokens.length - targetLen; i++) {
      let allWordsMatch = true
      for (let j = 0; j < targetLen; j++) {
        const token = ayahTokens[i + j]
        const targetWord = rawTargetWords[j]
        if (!checkWordMatch(token.text_uthmani, targetWord, tierFn)) {
          allWordsMatch = false
          break
        }
      }

      if (allWordsMatch) {
        matches.push({
          index: i,
          startWord: ayahTokens[i].word_position,
          endWord: ayahTokens[i + targetLen - 1].word_position,
          endAyah: ayahTokens[i + targetLen - 1].ayah_number,
        })
      }
    }

    if (matches.length > 0) {
      break
    }
  }

  if (matches.length === 0) {
    return [{
      startWord: -1,
      endWord: -1,
      sourceTokenRaw,
      confidence: 'unmatched',
      note: `Target text "${targetText}" not found in ayah tokens`
    }]
  }

  // Case 1: Exact single match
  if (matches.length === 1) {
    return [{
      startWord: matches[0].startWord,
      endWord: matches[0].endWord,
      endAyah: matches[0].endAyah,
      sourceTokenRaw,
      confidence: 'exact',
    }]
  }

  // Case 2: Multiple occurrences with "معا" / "كلاهما" -> split into 1 record per occurrence
  const isDual = notesOrDesc && DUAL_OCCURRENCE_REGEX.test(notesOrDesc)
  if (isDual) {
    return matches.map((m, idx) => ({
      startWord: m.startWord,
      endWord: m.endWord,
      endAyah: m.endAyah,
      sourceTokenRaw,
      isSplitOccurrence: true,
      occurrenceIndex: idx + 1,
      totalOccurrences: matches.length,
      confidence: 'split_all',
      note: `Split occurrence ${idx + 1}/${matches.length} from معا/كلاهما`
    }))
  }

  // Case 3: Multiple matches without dual flag -> choose nearest to sourceTokenRaw
  const rawIdx = typeof sourceTokenRaw === 'number'
    ? sourceTokenRaw
    : typeof sourceTokenRaw === 'string'
      ? parseInt(sourceTokenRaw, 10)
      : NaN

  if (!isNaN(rawIdx)) {
    let bestMatch = matches[0]
    let bestDist = Math.abs(matches[0].startWord - rawIdx)

    for (let k = 1; k < matches.length; k++) {
      const dist = Math.abs(matches[k].startWord - rawIdx)
      if (dist < bestDist) {
        bestDist = dist
        bestMatch = matches[k]
      }
    }

    return [{
      startWord: bestMatch.startWord,
      endWord: bestMatch.endWord,
      endAyah: bestMatch.endAyah,
      sourceTokenRaw,
      confidence: 'nearest',
      note: `Disambiguated from ${matches.length} occurrences using nearest source index (${rawIdx})`
    }]
  }

  // Fallback: pick first match
  return [{
    startWord: matches[0].startWord,
    endWord: matches[0].endWord,
    endAyah: matches[0].endAyah,
    sourceTokenRaw,
    confidence: 'nearest',
    note: `Multiple occurrences (${matches.length}) with no raw token index; defaulted to first occurrence`
  }]
}
