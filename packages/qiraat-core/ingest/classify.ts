import { usulRuleForRawValue, type UsulRuleDefinition } from '../usulRegistry'

export const DB_CATEGORY_CODES = new Set([
  'AYAH_COUNT',
  'SILAT_HA',
  'TARQIQ_RA',
  'TAGHLIZ_LAM',
  'MADD_BADAL',
  'MADD_LIN',
  'IMALAH_TAQLIL',
  'IDGHAM_SAGHIR',
  'IDGHAM_KABIR',
  'TAGHYIR_HAMZ',
  'HAMZATAN_KALIMA',
  'HAMZATAN_KALIMATAYN',
  'TARK_GHUNNA',
  'IKHFA',
  'WAQF_HAMZA',
  'WAQF_RASM',
  'YAAT_IDAFA',
  'YAAT_ZAWAID',
  'BAYN_SURATAYN',
  'MADD_QABL_IDGHAM',
  'USUL_MADD',
  'USUL_MIM_JAM',
  'USUL_NAQL',
  'USUL_SAKT',
])

const CATEGORY_ALIASES: Record<string, string> = {
  'SAKT': 'USUL_SAKT',
  'MEEM_JAM': 'USUL_MIM_JAM',
  'MIM_JAM': 'USUL_MIM_JAM',
  'NAQL': 'USUL_NAQL',
  'HA_KINAYA_SILAH': 'SILAT_HA',
  'MIM_JAM_SILAH': 'USUL_MIM_JAM',
  'RA_TARQIQ': 'TARQIQ_RA',
  'LAM_TAGHLIZ': 'TAGHLIZ_LAM',
  'HAMZ_CHANGE': 'TAGHYIR_HAMZ',
  'HAMZATAN_ONE_WORD': 'HAMZATAN_KALIMA',
  'HAMZATAN_TWO_WORDS': 'HAMZATAN_KALIMATAYN',
}

export interface ClassifiedRuling {
  canonicalCategory: string
  ruleDefinition?: UsulRuleDefinition
  isAmbiguous: boolean
  originalCategory?: string
  originalLabel?: string
}

/**
 * Classifies an incoming rule category or label against the 24 controlled DB categories in qiraat_categories.
 */
export function classifyRuling(categoryOrLabel: string): ClassifiedRuling {
  if (!categoryOrLabel) {
    return {
      canonicalCategory: 'OTHER',
      isAmbiguous: true,
      originalCategory: categoryOrLabel,
    }
  }

  // 1. Direct match on DB category code
  if (DB_CATEGORY_CODES.has(categoryOrLabel)) {
    return {
      canonicalCategory: categoryOrLabel,
      isAmbiguous: false,
      originalCategory: categoryOrLabel,
    }
  }

  // 2. Direct alias mapping
  if (CATEGORY_ALIASES[categoryOrLabel]) {
    return {
      canonicalCategory: CATEGORY_ALIASES[categoryOrLabel],
      isAmbiguous: false,
      originalCategory: categoryOrLabel,
    }
  }

  // 3. Match via USUL_RULE_REGISTRY
  const def = usulRuleForRawValue(categoryOrLabel)
  if (def) {
    const rawCat = def.rawCategories[0]
    const resolvedCat = CATEGORY_ALIASES[rawCat] || (DB_CATEGORY_CODES.has(rawCat) ? rawCat : null)
    if (resolvedCat) {
      return {
        canonicalCategory: resolvedCat,
        ruleDefinition: def,
        isAmbiguous: false,
        originalCategory: categoryOrLabel,
      }
    }
  }

  return {
    canonicalCategory: categoryOrLabel,
    isAmbiguous: true,
    originalCategory: categoryOrLabel,
  }
}

export interface SplitRuleSpan {
  startWord: number
  endWord: number
  wordIndex: number
  totalWords: number
}

/**
 * Decomposes a multi-word span into individual 1-word spans (Decision Q2: Option 1).
 */
export function splitMultiWordRuleSpan(startWord: number, endWord: number): SplitRuleSpan[] {
  if (startWord < 0 || endWord < 0 || endWord < startWord) {
    return []
  }

  if (startWord === endWord) {
    return [{
      startWord,
      endWord,
      wordIndex: 1,
      totalWords: 1,
    }]
  }

  const count = endWord - startWord + 1
  const spans: SplitRuleSpan[] = []
  for (let w = startWord; w <= endWord; w++) {
    spans.push({
      startWord: w,
      endWord: w,
      wordIndex: w - startWord + 1,
      totalWords: count,
    })
  }
  return spans
}
