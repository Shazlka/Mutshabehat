// Port of apps/ios MushafCore UsulIndex.swift: every أصول باب with the places it applies across the Mushaf.
// Rulings with the same category and full span are one place; their per-reader rows stay on the place.
import type { QiraatRuling } from '../types'

export interface UsulPlace {
  id: string
  page: number
  surah: number
  ayah: number
  startToken: number
  endAyah: number
  endToken: number
  baseText: string
  rulings: QiraatRuling[]
}

export interface UsulCategory {
  code: string
  categoryAr: string
  color: string
  count: number
  places: UsulPlace[]
}

/**
 * `rulingsByPage` is keyed by the page each list was loaded under. `pageOfWord` may give the page that really
 * holds a place's first word (the database-derived authority); without it, or for a word it does not know, the
 * place keeps the page it was loaded under.
 */
export function buildUsulIndex(
  rulingsByPage: Record<number, readonly QiraatRuling[]>,
  pageOfWord?: (surah: number, ayah: number, token: number) => number | undefined,
): UsulCategory[] {
  interface Accumulator { categoryAr: string; color: string; loci: Map<string, { page: number; rulings: QiraatRuling[]; ids: Set<string> }> }
  const byCategory = new Map<string, Accumulator>()

  const pages = Object.keys(rulingsByPage).map(Number).sort((a, b) => a - b)
  for (const page of pages) {
    for (const ruling of rulingsByPage[page]) {
      if (!ruling.wordAnchored) continue
      const acc = byCategory.get(ruling.category) ?? { categoryAr: '', color: '', loci: new Map() }
      if (!acc.categoryAr && ruling.categoryAr) acc.categoryAr = ruling.categoryAr
      if (!acc.color && ruling.color) acc.color = ruling.color
      const endAyah = ruling.endAyah ?? ruling.ayah
      const locusKey = [ruling.surah, ruling.ayah, ruling.startToken, endAyah, ruling.endToken].join(':')
      const locus = acc.loci.get(locusKey) ?? { page, rulings: [], ids: new Set<string>() }
      if (!locus.ids.has(ruling.id)) {
        locus.ids.add(ruling.id)
        locus.rulings.push(ruling)
      }
      acc.loci.set(locusKey, locus)
      byCategory.set(ruling.category, acc)
    }
  }

  const categories: UsulCategory[] = []
  for (const [code, acc] of byCategory) {
    const places = Array.from(acc.loci.entries()).map(([key, locus]): UsulPlace => {
      const [surah, ayah, startToken, endAyah, endToken] = key.split(':').map(Number)
      const rulings = [...locus.rulings].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      return {
        id: `${code}-${key.replaceAll(':', '-')}`,
        page: pageOfWord?.(surah, ayah, startToken) ?? locus.page,
        surah, ayah, startToken, endAyah, endToken,
        baseText: rulings.map((r) => r.baseText).find((t) => t) ?? '',
        rulings,
      }
    }).sort((a, b) => a.page - b.page || a.surah - b.surah || a.ayah - b.ayah || a.startToken - b.startToken || a.endAyah - b.endAyah || a.endToken - b.endToken)
    categories.push({ code, categoryAr: acc.categoryAr, color: acc.color, count: places.length, places })
  }
  return categories.sort((a, b) => b.count - a.count || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0))
}
