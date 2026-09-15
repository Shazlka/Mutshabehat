import type { MushafPage, MutshabehatHighlight } from '../quran-data/mushaf1441/types'

export const MUSHAF_MUTSHABEHAT_LINK_FEATURE_FLAG = 'NEXT_PUBLIC_ENABLE_MUSHAF_MUTSHABEHAT_LINK'
// Enabled by default so mutshabehat connections are visible in the mushaf reader.
// Real connections come from the signed-in user's groups; logged-out viewers fall
// back to the sample link source.
export const MUSHAF_MUTSHABEHAT_LINK_DEFAULT = true

export type MutshabehatAyahLink = MutshabehatHighlight & {
  title?: string
  color?: string
  notes?: string[]
}

export type MutshabehatLinkSource = {
  highlights: MutshabehatAyahLink[]
}

const EMPTY_SOURCE: MutshabehatLinkSource = {
  highlights: [],
}

export function isMushafMutshabehatLinkEnabled() {
  return process.env.NEXT_PUBLIC_ENABLE_MUSHAF_MUTSHABEHAT_LINK === 'true' || MUSHAF_MUTSHABEHAT_LINK_DEFAULT
}

export function normalizeAyahKey(ayahKey: string) {
  const trimmed = ayahKey.trim()
  return /^\d+:\d+$/.test(trimmed) ? trimmed : null
}

export function getMutshabehatByAyahKey(
  ayahKey: string,
  source: MutshabehatLinkSource = EMPTY_SOURCE,
): MutshabehatAyahLink[] {
  if (!isMushafMutshabehatLinkEnabled()) return []
  const normalizedAyahKey = normalizeAyahKey(ayahKey)
  if (!normalizedAyahKey) return []
  return source.highlights.filter((highlight) => highlight.ayahKey === normalizedAyahKey)
}

export function getHighlightsForPage(
  pageNumber: number,
  page?: MushafPage | null,
  source: MutshabehatLinkSource = EMPTY_SOURCE,
): MutshabehatHighlight[] {
  if (!isMushafMutshabehatLinkEnabled() || !page || page.pageNumber !== pageNumber) return []

  const ayahKeysOnPage = new Set<string>()
  for (const line of page.lines) {
    for (const word of line.words) {
      ayahKeysOnPage.add(word.ayahKey)
    }
  }

  return source.highlights
    .filter((highlight) => ayahKeysOnPage.has(highlight.ayahKey))
    .map(({ ayahKey, groupId, category, tags, similarAyat }) => ({
      ayahKey,
      groupId,
      category,
      tags,
      similarAyat,
    }))
}

export function navigateToAyah(ayahKey: string) {
  const normalizedAyahKey = normalizeAyahKey(ayahKey)
  if (!normalizedAyahKey) return '#'
  return `#ayah-${normalizedAyahKey.replace(':', '-')}`
}
