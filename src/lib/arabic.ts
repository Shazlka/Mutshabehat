// Arabic text utilities — server + client safe

const TASHKEEL = /[ً-ٰٟۖ-ۭ࣠-ࣾ​-‏]/g

// Strip diacritics (تشكيل) for tashkeel-insensitive search & comparison.
export function stripTashkeel(s: string): string {
  return (s || '').replace(TASHKEEL, '')
}

// Normalize ا/أ/إ/آ → ا, ى → ي, ة → ه, ؤ → و, ئ → ي. Use for fuzzy matching only.
export function normalizeArabic(s: string): string {
  return stripTashkeel(s || '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .trim()
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
