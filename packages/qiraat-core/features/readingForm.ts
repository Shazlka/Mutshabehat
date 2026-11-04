// Port of apps/ios MushafCore QiraatReadingForm.swift: how a word is written when it is read with a given
// أصول rule — صلة ميم الجمع adds the small waw after the meem, and نقل حركة الهمزة drops the hamza and moves its
// vowel to the letter before it. Pure text; nothing is guessed: a word the rule does not change returns null.

const SUKUN = new Set([0x0652, 0x06e1])
const SHORT_VOWELS = new Set([0x064b, 0x064c, 0x064d, 0x064e, 0x064f, 0x0650])
const HAMZA_LETTERS = new Set([0x0621, 0x0623, 0x0624, 0x0625, 0x0626])
const SMALL_HAMZA = new Set([0x0654, 0x0655])
const TATWEEL = 0x0640
const SMALL_WAW = 0x06e5
const DAMMA = 0x064f
const MEEM = 0x0645
const SPACE = 0x20
/** Silent-letter mark; the page font draws it as a dotted circle that cuts the word in two. */
const ROUNDED_ZERO = 0x06df

const cps = (s: string): number[] => Array.from(s).map((c) => c.codePointAt(0)!)
const str = (a: number[]): string => String.fromCodePoint(...a)

function isMark(s: number): boolean {
  return (s >= 0x064b && s <= 0x065f) || s === 0x0670 || ((s >= 0x06d6 && s <= 0x06ed) && s !== SMALL_WAW && s !== 0x06e6)
}

/** The word as the card draws it: the text without the rounded-zero mark. */
export function displayWord(text: string): string {
  return str(cps(text).filter((c) => c !== ROUNDED_ZERO))
}

function normalized(s: string): string {
  return str(cps(s).filter((c) => !(c >= 0x064b && c <= 0x065f) && c !== 0x0670 && c !== TATWEEL))
    .replaceAll('أ', 'ا').replaceAll('إ', 'ا').replaceAll('ة', 'ه')
}

export function appliesSilat(action: string): boolean {
  const n = normalized(action)
  return n.includes('صله ميم الجمع') || n.includes('ضم ميم الجمع') || n.includes('وصلها بواو')
}

/** Naql counts only when it is how the word is read while continuing (before any «ووقف …» part). */
export function appliesNaql(action: string, categoryCode: string): boolean {
  const n = normalized(action)
  const continuing = n.split('وقف')[0] ?? n
  const names = continuing.includes('النقل') || continuing.includes('نقل حركه') || (categoryCode === 'USUL_NAQL' && continuing.includes('نقل'))
  if (!names) return false
  return !continuing.includes('ترك النقل') && !continuing.includes('بلا نقل')
}

export interface ReadingFormInput {
  baseText: string
  action: string
  categoryCode: string
  /** The Mushaf words around the ruling's span: naql crosses a word boundary (مِنْ + آمَنَ → مِنَ امَنَ). */
  previousWord?: string | null
  nextWord?: string | null
}

/** The word as read for one narrator group's action, or null when the action does not change the writing. */
export function readingForm(input: ReadingFormInput): string | null {
  const clean = displayWord(input.baseText)
  let result: string | null = null
  if (appliesSilat(input.action)) {
    result = withSilat(clean)
  } else if (appliesNaql(input.action, input.categoryCode)) {
    result = withNaql(clean)
      ?? withNaqlAcross(clean, input.previousWord ? displayWord(input.previousWord) : null, input.nextWord ? displayWord(input.nextWord) : null)
  }
  return result !== null && result !== clean ? result : null
}

/** The meem ending the first word that ends in one: sukun → damma, a damma stays, no vowel → damma; then the small waw. */
export function withSilat(text: string): string | null {
  const s = cps(text)
  let i = 0
  while (i < s.length) {
    let end = i
    while (end < s.length && s[end] !== SPACE) end += 1
    let j = end - 1
    while (j >= i && (isMark(s[j]) || s[j] === 0x06da)) j -= 1
    if (j >= i && s[j] === MEEM) {
      const marks = s.slice(j + 1, end)
      if (marks.some((m) => m === 0x0650 || m === 0x064e)) { i = end + 1; continue } // kasra / fatha: not this rule
      let sukunAt = -1
      for (let k = j + 1; k < end; k += 1) if (SUKUN.has(s[k])) { sukunAt = k; break }
      if (sukunAt >= 0) {
        s[sukunAt] = DAMMA
        s.splice(sukunAt + 1, 0, SMALL_WAW)
      } else {
        let dammaAt = -1
        for (let k = j + 1; k < end; k += 1) if (s[k] === DAMMA) { dammaAt = k; break }
        if (dammaAt >= 0) s.splice(dammaAt + 1, 0, SMALL_WAW)
        else s.splice(j + 1, 0, DAMMA, SMALL_WAW)
      }
      return str(s)
    }
    i = end + 1
  }
  return null
}

/** Hamza after a letter that carries a sukun, inside one word → the hamza goes, its vowel moves to that letter. */
export function withNaql(text: string): string | null {
  const s = cps(text)
  let i = 1
  while (i < s.length) {
    const v = s[i]
    const isLetterHamza = HAMZA_LETTERS.has(v)
    const isTatweelHamza = SMALL_HAMZA.has(v)
    if (!isLetterHamza && !isTatweelHamza) { i += 1; continue }
    let carrier = i
    if (isTatweelHamza) {
      let k = i - 1
      while (k > 0 && isMark(s[k])) k -= 1
      carrier = k
    }
    let p = carrier - 1
    let sukunAt = -1
    while (p >= 0 && isMark(s[p])) { if (SUKUN.has(s[p])) sukunAt = p; p -= 1 }
    if (p < 0 || s[p] === SPACE || sukunAt < 0) { i += 1; continue }
    let vowel: number | null = null
    let q = carrier + 1
    while (q < s.length && (isMark(s[q]) || SMALL_HAMZA.has(s[q]))) {
      if (SHORT_VOWELS.has(s[q]) && vowel === null) vowel = s[q]
      q += 1
    }
    if (vowel === null) { i += 1; continue }
    s.splice(carrier, q - carrier)
    s[sukunAt] = vowel
    return str(s)
  }
  return null
}

/** A word's first letter is a hamza carrying a short vowel; returns that vowel and the word without hamza and vowel. */
function splitInitialHamza(word: string): { vowel: number; rest: string } | null {
  const s = cps(word)
  if (s.length === 0) return null
  if (!(HAMZA_LETTERS.has(s[0]) || s[0] === 0x0622)) return null // alef wasla (0x0671) does not start a hamza word
  let vowel: number | null = null
  let q = 1
  while (q < s.length && isMark(s[q])) {
    if (SHORT_VOWELS.has(s[q]) && vowel === null && ![0x064b, 0x064c, 0x064d].includes(s[q])) vowel = s[q]
    q += 1
  }
  if (s[0] === 0x0622) return { vowel: 0x064e, rest: str([0x0627, ...s.slice(1)]) } // آ = hamza with fatha + alef
  if (vowel === null) return null
  return { vowel, rest: str(s.slice(q)) }
}

/** The word ends in a letter carrying a sukun: returns it with that sukun replaced by `vowel`. */
function giveVowel(word: string, vowel: number): string | null {
  const s = cps(word)
  let p = s.length - 1
  let sukunAt = -1
  while (p >= 0 && (isMark(s[p]) || s[p] === 0x06da)) { if (SUKUN.has(s[p])) sukunAt = p; p -= 1 }
  if (p < 0 || sukunAt < 0) return null
  s[sukunAt] = vowel
  return str(s)
}

/** Hamza word next to a word whose last letter is at rest: the hamza goes, its vowel moves to that letter. */
export function withNaqlAcross(text: string, previous: string | null, next: string | null): string | null {
  const words = text.split(' ').filter((w) => w.length > 0)
  if (words.length >= 2) {
    for (let k = 0; k < words.length - 1; k += 1) {
      const h = splitInitialHamza(words[k + 1])
      const moved = h ? giveVowel(words[k], h.vowel) : null
      if (h && moved !== null) {
        const out = [...words]
        out[k] = moved
        out[k + 1] = h.rest
        return out.join(' ')
      }
    }
  }
  const last = words[words.length - 1]
  const first = words[0]
  if (last === undefined || first === undefined) return null
  if (next) {
    const h = splitInitialHamza(next)
    const moved = h ? giveVowel(last, h.vowel) : null
    if (h && moved !== null) return [...words.slice(0, -1), moved, h.rest].join(' ')
  }
  if (previous) {
    const h = splitInitialHamza(first)
    const moved = h ? giveVowel(previous, h.vowel) : null
    if (h && moved !== null) return [moved, h.rest, ...words.slice(1)].join(' ')
  }
  return null
}
