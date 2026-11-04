// Port of apps/ios MushafCore QiraatWordOrder.swift: marked words in Quran reading order, and the
// numbering of a word's displayed faces. Pure; no React, no DOM.
import type { QiraatVariant } from '../types'
import type { MushafWord } from '../../quran-data/mushaf1441/types'

export interface OrderableWord {
  id: string
  surah: number
  ayah: number
  tokenInAyah: number
  page: number
  line: number
  indexInLine: number
}

function key(w: OrderableWord): number[] {
  return [w.surah, w.ayah, w.tokenInAyah, w.page, w.line, w.indexInLine]
}

/** Quran coordinates first, then page layout as a tiebreak. */
export function comesBefore(a: OrderableWord, b: OrderableWord): boolean {
  const x = key(a)
  const y = key(b)
  for (let i = 0; i < x.length; i += 1) {
    if (x[i] !== y[i]) return x[i] < y[i]
  }
  return false
}

/** Words of `pages` that satisfy `isMarked`, de-duplicated by id, in Quran order. */
export function markedWords<W extends OrderableWord>(pages: number[], words: W[], isMarked: (w: W) => boolean): W[] {
  const included = new Set(pages)
  const seen = new Set<string>()
  return words
    .filter((w) => included.has(w.page) && isMarked(w) && !seen.has(w.id) && (seen.add(w.id), true))
    .sort((a, b) => (comesBefore(a, b) ? -1 : comesBefore(b, a) ? 1 : 0))
}

/** No wraparound. */
export function nextMarked<W extends OrderableWord>(list: W[], current: W): W | null {
  const index = list.findIndex((w) => w.id === current.id)
  return index >= 0 && index + 1 < list.length ? list[index + 1] : null
}

export function previousMarked<W extends OrderableWord>(list: W[], current: W): W | null {
  const index = list.findIndex((w) => w.id === current.id)
  return index > 0 ? list[index - 1] : null
}

/** Keeps a sheet usable when a filter or live update removes its word: the same word, else the next
 * marked word in Quran order, else the last one. */
export function nearestMarked<W extends OrderableWord>(list: W[], current: W): W | null {
  const exact = list.find((w) => w.id === current.id)
  if (exact) return exact
  return list.find((w) => !comesBefore(w, current)) ?? list[list.length - 1] ?? null
}

/** Number a word's displayed faces in appearance order. A lone face needs no number ({}). */
export function variantWajhNumbers(variants: QiraatVariant[]): Record<string, number> {
  const faces = new Map<string, number>()
  const numbers: Record<string, number> = {}
  for (const v of variants) {
    const faceKey = JSON.stringify([
      v.surah, v.ayah, v.startToken, v.endToken,
      v.uthmaniText ?? v.variantText,
      v.performanceNote ?? '',
      Array.from(new Set(v.readingIds)).sort(),
    ])
    let n = faces.get(faceKey)
    if (n === undefined) {
      n = faces.size + 1
      faces.set(faceKey, n)
    }
    if (numbers[v.id] === undefined) numbers[v.id] = n
  }
  return faces.size > 1 ? numbers : {}
}

/** Adapt a reader word (page/line/word fields) to the order keys above. */
export function toOrderable(word: MushafWord): OrderableWord {
  return {
    id: word.id,
    surah: word.surahNumber,
    ayah: word.ayahNumber,
    tokenInAyah: word.wordIndexInAyah,
    page: word.pageNumber,
    line: word.lineNumber,
    indexInLine: word.wordIndexInLine,
  }
}
