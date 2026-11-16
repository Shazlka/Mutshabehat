import { type AyahKey, ayahKeyString, makeAyahKey } from './types'
import type { QuranIndex } from './quranIndex'

/**
 * What a memorization update or review applies to.
 * Matches iOS `MemorizationSelection`.
 */
export type MemorizationSelection =
  | { readonly type: 'surah'; readonly surah: number }
  | { readonly type: 'ayahRange'; readonly surah: number; readonly from: number; readonly to: number }
  | { readonly type: 'pageRange'; readonly startPage: number; readonly endPage: number }
  | { readonly type: 'juz'; readonly juz: number }
  | { readonly type: 'ayat'; readonly keys: readonly AyahKey[] }
  | { readonly type: 'span'; readonly from: AyahKey; readonly to: AyahKey }

export function makeSurahSelection(surah: number): MemorizationSelection {
  return { type: 'surah', surah }
}

export function makeAyahRangeSelection(surah: number, from: number, to: number): MemorizationSelection {
  return { type: 'ayahRange', surah, from, to }
}

export function makePageRangeSelection(startPage: number, endPage: number): MemorizationSelection {
  return { type: 'pageRange', startPage, endPage }
}

export function makeJuzSelection(juz: number): MemorizationSelection {
  return { type: 'juz', juz }
}

export function makeAyatSelection(keys: readonly AyahKey[]): MemorizationSelection {
  return { type: 'ayat', keys }
}

export function makeSpanSelection(from: AyahKey, to: AyahKey): MemorizationSelection {
  return { type: 'span', from, to }
}

/**
 * Resolves a selection into ayah keys in Mushaf order, without duplicates.
 * Out-of-range values are clamped or dropped; a selection that matches nothing resolves to an empty list.
 */
export function resolveSelection(selection: MemorizationSelection, index: QuranIndex): AyahKey[] {
  switch (selection.type) {
    case 'surah':
      return index.ayatOfSurah(selection.surah)

    case 'ayahRange': {
      const count = index.ayahCount(selection.surah)
      const lower = Math.max(1, Math.min(selection.from, selection.to))
      const upper = Math.min(count, Math.max(selection.from, selection.to))
      if (count === 0 || lower > upper) return []
      const result: AyahKey[] = []
      for (let a = lower; a <= upper; a += 1) {
        const k = makeAyahKey(selection.surah, a)
        if (index.ordinal(k) !== undefined) {
          result.push(k)
        }
      }
      return result
    }

    case 'pageRange':
      return index.ayatInPages(selection.startPage, selection.endPage)

    case 'juz':
      return index.ayatOfJuz(selection.juz)

    case 'ayat': {
      const uniqueWithOrdinal = new Map<string, { key: AyahKey; ordinal: number }>()
      for (const key of selection.keys) {
        const ord = index.ordinal(key)
        if (ord !== undefined) {
          uniqueWithOrdinal.set(ayahKeyString(key), { key, ordinal: ord })
        }
      }
      return Array.from(uniqueWithOrdinal.values())
        .sort((a, b) => a.ordinal - b.ordinal)
        .map((x) => x.key)
    }

    case 'span':
      return index.ayatBetween(selection.from, selection.to)
  }
}

/**
 * True when the selection is exactly the ayat of one whole surah (such an update asks for confirmation).
 */
export function isWholeSurahSelection(selection: MemorizationSelection, index: QuranIndex): boolean {
  const keys = resolveSelection(selection, index)
  if (keys.length === 0) return false
  const firstSurah = keys[0].surah
  return keys.every((k) => k.surah === firstSurah) && keys.length === index.ayahCount(firstSurah)
}

/**
 * A compact JSON description stored with the batch (shown in history, kept in backups).
 * Formatted with sorted keys to match iOS `selection.scopeJSON`.
 */
export function getScopeJSON(selection: MemorizationSelection): string {
  let scopeObj: Record<string, unknown>
  switch (selection.type) {
    case 'surah':
      scopeObj = { surah: selection.surah, type: 'surah' }
      break
    case 'ayahRange':
      scopeObj = {
        from: Math.min(selection.from, selection.to),
        surah: selection.surah,
        to: Math.max(selection.from, selection.to),
        type: 'ayahRange',
      }
      break
    case 'pageRange':
      scopeObj = {
        page: [Math.min(selection.startPage, selection.endPage), Math.max(selection.startPage, selection.endPage)],
        type: 'pageRange',
      }
      break
    case 'juz':
      scopeObj = { juz: selection.juz, type: 'juz' }
      break
    case 'ayat':
      scopeObj = { count: selection.keys.length, type: 'ayat' }
      break
    case 'span':
      scopeObj = {
        fromKey: ayahKeyString(selection.from),
        toKey: ayahKeyString(selection.to),
        type: 'span',
      }
      break
  }

  // Sort keys alphabetically
  const sorted: Record<string, unknown> = {}
  for (const k of Object.keys(scopeObj).sort()) {
    sorted[k] = scopeObj[k]
  }
  return JSON.stringify(sorted)
}
