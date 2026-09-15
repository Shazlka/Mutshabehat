import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { MUSHAF_1441_SURAH_OPTIONS } from '../../../../../packages/quran-data/mushaf1441/pageMetadata'

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

const surahNameToNumber = new Map(MUSHAF_1441_SURAH_OPTIONS.map((surah) => [surah.name, surah.surahNumber]))

async function getAuthenticatedSupabase() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error) {
      // A missing/expired session is a normal "not signed in" state, not a server
      // fault — return 401 so the UI can prompt sign-in instead of showing an error.
      const sessionMissing =
        error.name === 'AuthSessionMissingError' ||
        /auth session missing/i.test(error.message)
      if (sessionMissing) {
        return {
          supabase: null,
          user: null,
          response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
        }
      }

      return {
        supabase: null,
        user: null,
        response: NextResponse.json(
          {
            error: 'Supabase authentication is unavailable for the Mushaf 1441 preview',
            detail: error.message,
          },
          { status: 503 }
        ),
      }
    }

    if (!user) {
      return {
        supabase: null,
        user: null,
        response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
      }
    }

    return { supabase, user, response: null }
  } catch (error) {
    return {
      supabase: null,
      user: null,
      response: NextResponse.json(
        {
          error: 'Supabase configuration is unavailable for the Mushaf 1441 preview',
          detail: error instanceof Error ? error.message : 'Unknown Supabase configuration error',
        },
        { status: 503 }
      ),
    }
  }
}

function toAyahKey(verse: VerseRow) {
  const ayah = Number(verse.ayah)
  if (!Number.isInteger(ayah) || ayah < 1) return null

  if (typeof verse.surah === 'number' || /^\d+$/.test(String(verse.surah ?? ''))) {
    const surahNumber = Number(verse.surah)
    return Number.isInteger(surahNumber) ? `${surahNumber}:${ayah}` : null
  }

  const surahNumber = surahNameToNumber.get(String(verse.surah ?? '').trim())
  return surahNumber ? `${surahNumber}:${ayah}` : null
}

function getTagNames(group: GroupRow) {
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

export async function GET(request: NextRequest) {
  const { supabase, user, response } = await getAuthenticatedSupabase()
  if (response) return response
  if (!supabase || !user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const ayahKeys = new Set(
    (request.nextUrl.searchParams.get('ayahKeys') ?? '')
      .split(',')
      .map((key) => key.trim())
      .filter((key) => /^\d+:\d+$/.test(key))
  )

  const { data, error } = await supabase
    .from('groups')
    .select('id, title, color, note, status, verses(surah, ayah, label), group_tags(tags(name))')
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const highlights = []
  for (const group of (data ?? []) as GroupRow[]) {
    const groupAyahKeys = new Set<string>()
    for (const verse of group.verses ?? []) {
      const ayahKey = toAyahKey(verse)
      if (ayahKey) groupAyahKeys.add(ayahKey)
    }

    for (const ayahKey of groupAyahKeys) {
      if (ayahKeys.size > 0 && !ayahKeys.has(ayahKey)) continue
      const tags = getTagNames(group)
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

  return NextResponse.json({ highlights })
}
