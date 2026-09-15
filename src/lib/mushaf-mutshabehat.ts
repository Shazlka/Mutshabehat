// Builds Mushaf ayah → personal mutashabihat group links for one user.
// Used by the Mushaf page (server, so highlights are in the first render) and by
// /api/mushaf-1441/mutshabehat (client fallback).
import { MUSHAF_1441_SURAH_OPTIONS } from '../../packages/quran-data/mushaf1441/pageMetadata'
import type { MutshabehatAyahLink } from '../../packages/mutshabehat-core/mushafLinkAdapter'

type VerseRow = {
  surah: string | number | null
  ayah: number | null
  label?: string | null
}

type TagRow = {
  name?: string | null
}

type GroupTagRow = {
  tags?: TagRow | TagRow[] | null
}

type GroupRow = {
  id: string
  title: string
  color: string | null
  note?: string | null
  status?: string | null
  verses?: VerseRow[] | null
  group_tags?: GroupTagRow[] | null
}

type QueryableSupabase = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => PromiseLike<{ data: unknown; error: { message: string } | null }>
    }
  }
}

const surahNameToNumber = new Map(MUSHAF_1441_SURAH_OPTIONS.map((surah) => [surah.name, surah.surahNumber]))

export function toAyahKey(verse: VerseRow) {
  const ayah = Number(verse.ayah)
  if (!Number.isInteger(ayah) || ayah < 1) return null

  if (typeof verse.surah === 'number' || /^\d+$/.test(String(verse.surah ?? ''))) {
    const surahNumber = Number(verse.surah)
    return Number.isInteger(surahNumber) ? `${surahNumber}:${ayah}` : null
  }

  const surahNumber = surahNameToNumber.get(String(verse.surah ?? '').trim())
  return surahNumber ? `${surahNumber}:${ayah}` : null
}

export function getTagNames(group: GroupRow) {
  const names = new Set<string>()

  for (const groupTag of group.group_tags ?? []) {
    const tagRows = Array.isArray(groupTag.tags) ? groupTag.tags : [groupTag.tags]
    for (const tag of tagRows) {
      const name = tag?.name?.trim()
      if (name) names.add(name)
    }
  }

  return [...names]
}

/** All links for the user; pass `ayahKeys` to keep only those ayat. */
export async function loadMushafMutshabehatHighlights(
  supabase: unknown,
  userId: string,
  ayahKeys?: Set<string>,
): Promise<{ highlights: MutshabehatAyahLink[]; error: string | null }> {
  const { data, error } = await (supabase as QueryableSupabase)
    .from('groups')
    .select('id, title, color, note, status, verses(surah, ayah, label), group_tags(tags(name))')
    .eq('user_id', userId)

  if (error) return { highlights: [], error: error.message }

  const highlights: MutshabehatAyahLink[] = []
  for (const group of (data ?? []) as GroupRow[]) {
    const groupAyahKeys = new Set<string>()
    for (const verse of group.verses ?? []) {
      const ayahKey = toAyahKey(verse)
      if (ayahKey) groupAyahKeys.add(ayahKey)
    }

    const tags = getTagNames(group)
    for (const ayahKey of groupAyahKeys) {
      if (ayahKeys && ayahKeys.size > 0 && !ayahKeys.has(ayahKey)) continue
      highlights.push({
        ayahKey,
        groupId: group.id,
        title: group.title,
        category: group.status ?? undefined,
        color: group.color ?? '#b8871d',
        tags: tags.length > 0 ? tags : undefined,
        notes: group.note ? [group.note] : [],
        similarAyat: [...groupAyahKeys].filter((key) => key !== ayahKey),
      })
    }
  }

  return { highlights, error: null }
}
