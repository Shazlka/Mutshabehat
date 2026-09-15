// Arabic text utilities — server + client safe

const TASHKEEL = /[ً-ٰٟۖ-ۭ࣠-ࣾ​-‏]/g

// Strip diacritics (تشكيل) for tashkeel-insensitive search & comparison.
export function stripTashkeel(s: string): string {
  return (s || '').replace(TASHKEEL, '')
}

// Normalize ا/أ/إ/آ/ٱ → ا, ى → ي, ة → ه, ؤ → و, ئ → ي, strip tatweel. Fuzzy match only.
// Note: ٱ (alef wasla, U+0671) is common in the Uthmani mushaf script used in
// ayahs.json — without folding it to ا, words like "الرجفة" never match.
//
// Dagger alef (ٰ U+0670) is the Uthmani marker for an *omitted* long alef
// (e.g. عَٰلَمِينَ = عالمين, ٱلرَّحۡمَٰنِ = الرحمن). We restore it to a real ا
// BEFORE stripping tashkeel, so the mushaf spelling matches what users type.
export function normalizeArabic(s: string): string {
  return stripTashkeel((s || '').replace(/ٰ/g, 'ا'))
    .replace(/[إأآاٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ـ/g, '')
    .trim()
}

// "Rasm skeleton" — an aggressive, fuzzy key that drops the long alef entirely
// so plene vs. defective Uthmani spellings collapse to the same string:
//   السماوات → لسموت   ←→   السموات → لسموت
//   عاكفين   → عكفين   ←→   عكفين   → عكفين
// Only ا is removed (the overwhelmingly common variation); و/ي are kept to avoid
// over-merging unrelated words (e.g. قال vs قل). Used as a fallback search tier.
export function rasmSkeleton(s: string): string {
  return normalizeArabic(s).replace(/ا/g, '')
}

// ── Match highlighting ────────────────────────────────────────────────────────
// Search matches against normalized text, but we render the original Uthmani
// text. To highlight, we normalize char-by-char and remember, for each output
// char, which ORIGINAL index it came from. Dropped chars (tashkeel, tatweel) map
// to nothing. This mirrors normalizeArabic() exactly, minus the trim.
const TASHKEEL_ONE = /[ً-ٰٟۖ-ۭ࣠-ࣾ​-‏]/

export function normalizeArabicWithMap(s: string): { norm: string; map: number[] } {
  const src = s || ''
  let norm = ''
  const map: number[] = []
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    let out: string
    if (c === 'ٰ') out = 'ا'              // dagger alef → ا (checked before tashkeel)
    else if (TASHKEEL_ONE.test(c)) out = ''
    else if (c === 'إ' || c === 'أ' || c === 'آ' || c === 'ا' || c === 'ٱ') out = 'ا'
    else if (c === 'ى') out = 'ي'
    else if (c === 'ة') out = 'ه'
    else if (c === 'ؤ') out = 'و'
    else if (c === 'ئ') out = 'ي'
    else if (c === 'ـ') out = ''          // tatweel
    else out = c
    if (out) { norm += out; map.push(i) }
  }
  return { norm, map }
}

// Return original-text [start, end) ranges to highlight for `query` within `text`.
// Tries exact (normalized) matches first; if none, falls back to rasm-skeleton
// (long-alef-insensitive) matches. Ranges are non-overlapping, left to right.
export function matchRanges(text: string, query: string): Array<[number, number]> {
  const { norm, map } = normalizeArabicWithMap(text)
  if (!norm) return []

  // Map a [normStart, normEnd) span (indices into `norm`) → original [start, end).
  const toOrig = (ns: number, ne: number): [number, number] => {
    const start = map[ns]
    const end = ne < map.length ? map[ne] : text.length
    return [start, end]
  }

  // Tier 1 — exact normalized substring(s).
  const qn = normalizeArabic(query)
  const ranges: Array<[number, number]> = []
  if (qn) {
    let from = 0
    for (let idx = norm.indexOf(qn, from); idx >= 0; idx = norm.indexOf(qn, from)) {
      ranges.push(toOrig(idx, idx + qn.length))
      from = idx + qn.length
    }
    if (ranges.length) return ranges
  }

  // Tier 2 — rasm skeleton (drop ا). Build skeleton over `norm`, remembering the
  // norm index of each skeleton char, so we can map matched spans back through map.
  const qs = rasmSkeleton(query)
  if (qs.length < 3) return []
  let skel = ''
  const skelToNorm: number[] = []
  for (let j = 0; j < norm.length; j++) {
    if (norm[j] !== 'ا') { skel += norm[j]; skelToNorm.push(j) }
  }
  let from = 0
  for (let idx = skel.indexOf(qs, from); idx >= 0; idx = skel.indexOf(qs, from)) {
    let normStart = skelToNorm[idx]
    // Skeleton drops ا, so a leading ا of the same word (e.g. the ال in السموات)
    // sits just before the first matched char — pull it into the highlight.
    while (normStart > 0 && norm[normStart - 1] === 'ا') normStart--
    const normEnd = idx + qs.length < skelToNorm.length ? skelToNorm[idx + qs.length] : norm.length
    ranges.push(toOrig(normStart, normEnd))
    from = idx + qs.length
  }
  return ranges
}

// Convert Arabic-Indic numerals to Western for parsing ayah numbers.
const AR_DIGITS: Record<string, string> = {
  '٠':'0','١':'1','٢':'2','٣':'3','٤':'4',
  '٥':'5','٦':'6','٧':'7','٨':'8','٩':'9',
}
export function ayahToInt(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v !== 'string') return 1
  const western = v.split('').map((c) => AR_DIGITS[c] ?? c).join('')
  const n = parseInt(western, 10)
  return Number.isFinite(n) ? n : 1
}

// Convert int → Arabic-Indic string for display.
export function ayahToArabic(n: number): string {
  return String(n).split('').map((d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d, 10)] ?? d).join('')
}
