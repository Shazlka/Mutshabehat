// Text normalization for reliable Quranic token re-anchoring
// Replicates the proven 3-tier normalization from scripts/qiraat/tokens.py

const TASHKEEL_REGEX = /[\u064B-\u0652\u0670\u06D6-\u06ED\u0610-\u061A\u0600-\u0605\u08D0-\u08E1\u08E3-\u08FF]/g
const TATWEEL_REGEX = /\u0640/g
const INVISIBLE_CHARS_REGEX = /[\u200B-\u200F\uFEFF\u00A0]/g

/**
 * Tier 1: Canonical normalization
 * ىٰ (alef maqsura + dagger alef) is one long aa -> folds to ا
 * ۧ / ۥ (small high yeh / waw) expand to ي / و
 * Tashkeel and tatweel stripped
 * Hamzas unified to ا
 */
export function norm(s: string): string {
  if (!s) return ''
  let text = s
    .replace(INVISIBLE_CHARS_REGEX, '')
    .replace(/ىٰ/g, 'ا')
    .replace(/ۧ/g, 'ي')
    .replace(/ۦ/g, 'ي')
    .replace(/ۥ/g, 'و')
    .replace(/ٰ/g, 'ا')
    .replace(TASHKEEL_REGEX, '')
    .replace(/[إأآاٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(TATWEEL_REGEX, '')
    .replace(/\s+/g, ' ')
    .trim()

  return text
}

/**
 * Tier 2: Fold ي to ا
 * The mushaf writes a final long aa as ىٰ (-> ا) where
 * an ordinary transcription writes ى (-> ي), so النصارى and والنصـرى compare equal.
 */
export function fold(s: string): string {
  return norm(s).replace(/ي/g, 'ا')
}

/**
 * Tier 3: Skeleton
 * Drops ا and ء so plene/defective spellings and hamza seats collapse.
 */
export function skeleton(s: string): string {
  return norm(s).replace(/[اء]/g, '')
}

export function normalizeArabic(s: string): string {
  return norm(s)
}

export function normalizeSkeletal(s: string): string {
  return fold(s)
}
