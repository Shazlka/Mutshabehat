// Port of apps/ios MushafCore QiraatSearch.swift: find the places of the Mushaf by reader/narrator, by word
// (diacritics and alef forms ignored) or by أصول باب. Pure; the index is built once from the loaded pages.
import { normalizeArabic } from '../../../src/lib/arabic'
import { getReadingOrNull, readingsOfReader } from '../readings'
import type { QiraatRuling, QiraatVariant } from '../types'

export type QiraatSearchQuery =
  | { kind: 'authority'; authorityId: string }
  | { kind: 'word'; text: string }
  | { kind: 'category'; code: string }

export type QiraatSearchKind = 'variant' | 'ruling'

/** One navigable place; several faces and families at the same anchor share one result. */
export interface QiraatSearchResult {
  page: number
  surah: number
  ayah: number
  token: number
  displayText: string
  kinds: QiraatSearchKind[]
  recordCount: number
}

export interface QiraatSearchCategory {
  code: string
  nameAr: string
  rulingCount: number
}

export interface QiraatSearchIndex {
  search(query: QiraatSearchQuery): QiraatSearchResult[]
  categories: QiraatSearchCategory[]
}

interface Entry {
  page: number
  surah: number
  ayah: number
  token: number
  displayText: string
  normalizedTexts: string[]
  kind: QiraatSearchKind
  wordAnchored: boolean
}

/** Reader and narrator ids an authority id stands for: a reader row covers both of its narrators. */
function authorityKeys(id: string): string[] {
  if (id.includes('-')) {
    const reading = getReadingOrNull(id)
    return reading ? [id, reading.readerId] : [id]
  }
  return [id, ...readingsOfReader(id).map((r) => r.id)]
}

export function buildSearchIndex(
  variantsByPage: Record<number, readonly QiraatVariant[]>,
  rulingsByPage: Record<number, readonly QiraatRuling[]>,
): QiraatSearchIndex {
  const entries: Entry[] = []
  const authorities = new Map<string, number[]>()
  const categoryEntries = new Map<string, number[]>()
  const names = new Map<string, string>()

  const append = (entry: Omit<Entry, 'normalizedTexts'> & { texts: string[] }, ids: string[], category?: string) => {
    const offset = entries.length
    const { texts, ...rest } = entry
    entries.push({ ...rest, normalizedTexts: texts.filter(Boolean).map((t) => normalizeArabic(t)) })
    if (category) categoryEntries.set(category, [...(categoryEntries.get(category) ?? []), offset])
    if (!entry.wordAnchored) return
    for (const key of new Set(ids.flatMap(authorityKeys))) authorities.set(key, [...(authorities.get(key) ?? []), offset])
  }

  const pages = Array.from(new Set([...Object.keys(variantsByPage), ...Object.keys(rulingsByPage)].map(Number))).sort((a, b) => a - b)
  for (const page of pages) {
    for (const v of variantsByPage[page] ?? []) {
      append({
        page, surah: v.surah, ayah: v.ayah, token: v.startToken, displayText: v.hafsText,
        texts: [v.hafsText, v.variantText], kind: 'variant', wordAnchored: true,
      }, v.readingIds)
    }
    for (const r of rulingsByPage[page] ?? []) {
      if (!names.has(r.category)) names.set(r.category, r.categoryAr)
      append({
        page, surah: r.surah, ayah: r.ayah, token: r.startToken, displayText: r.baseText,
        texts: [r.baseText], kind: 'ruling', wordAnchored: r.wordAnchored,
      }, r.readings.map((x) => x.readingId as string), r.category) // readings only, like the page's own marks
    }
  }

  // Locations in navigation order (surah, page, ayah, token), one per anchor.
  const locationOf = new Map<string, number>()
  const locations: { page: number; surah: number; ayah: number; token: number }[] = []
  entries.forEach((e) => {
    const key = `${e.page}-${e.surah}-${e.ayah}-${e.token}`
    if (!locationOf.has(key)) { locationOf.set(key, -1); locations.push({ page: e.page, surah: e.surah, ayah: e.ayah, token: e.token }) }
  })
  locations.sort((a, b) => a.surah - b.surah || a.page - b.page || a.ayah - b.ayah || a.token - b.token)
  locations.forEach((l, i) => locationOf.set(`${l.page}-${l.surah}-${l.ayah}-${l.token}`, i))

  const categories = Array.from(names.keys()).sort().map((code) => ({
    code, nameAr: names.get(code) ?? code, rulingCount: categoryEntries.get(code)?.length ?? 0,
  }))

  function search(query: QiraatSearchQuery): QiraatSearchResult[] {
    let offsets: number[]
    if (query.kind === 'authority') offsets = authorities.get(query.authorityId) ?? []
    else if (query.kind === 'category') offsets = categoryEntries.get(query.code) ?? []
    else {
      const needle = normalizeArabic(query.text.trim())
      if (!needle) return []
      offsets = entries.flatMap((e, i) => (e.wordAnchored && e.normalizedTexts.some((t) => t.includes(needle)) ? [i] : []))
    }
    const found = new Map<number, { count: number; kinds: Set<QiraatSearchKind>; text: string }>()
    for (const offset of offsets) {
      const e = entries[offset]
      const location = locationOf.get(`${e.page}-${e.surah}-${e.ayah}-${e.token}`)!
      const hit = found.get(location) ?? { count: 0, kinds: new Set<QiraatSearchKind>(), text: '' }
      hit.count += 1
      hit.kinds.add(e.kind)
      if (!hit.text && e.displayText) hit.text = e.displayText // prefer a match that carries source text
      found.set(location, hit)
    }
    return Array.from(found.keys()).sort((a, b) => a - b).map((location) => ({
      ...locations[location],
      displayText: found.get(location)!.text,
      kinds: (['variant', 'ruling'] as const).filter((k) => found.get(location)!.kinds.has(k)),
      recordCount: found.get(location)!.count,
    }))
  }

  return { search, categories }
}

export function groupResults(results: QiraatSearchResult[]): { surah: number; pages: { page: number; results: QiraatSearchResult[] }[] }[] {
  const surahs = new Map<number, Map<number, QiraatSearchResult[]>>()
  for (const r of results) {
    const pages = surahs.get(r.surah) ?? new Map<number, QiraatSearchResult[]>()
    pages.set(r.page, [...(pages.get(r.page) ?? []), r])
    surahs.set(r.surah, pages)
  }
  return Array.from(surahs.keys()).sort((a, b) => a - b).map((surah) => ({
    surah,
    pages: Array.from(surahs.get(surah)!.keys()).sort((a, b) => a - b).map((page) => ({
      page,
      results: surahs.get(surah)!.get(page)!.sort((a, b) => a.ayah - b.ayah || a.token - b.token),
    })),
  }))
}
