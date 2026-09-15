import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getSessionUser } from '@/lib/session-user'
import { stripTashkeel } from '@/lib/arabic'
import { sanitizeNote } from '@/lib/sanitize'

// GET /api/groups
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const user = await getSessionUser(supabase)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const surah    = searchParams.get('surah')
  const status   = searchParams.get('status')
  const favorite = searchParams.get('favorite')
  const page     = Math.max(1, parseInt(searchParams.get('page')  || '1',  10))
  const limit    = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
  const from = (page - 1) * limit
  const to   = from + limit - 1

  let query = supabase
    .from('groups')
    .select('*, verses(surah)', { count: 'exact' })
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .range(from, to)

  if (status)   query = query.eq('status', status)
  if (favorite) query = query.eq('favorite', favorite === 'true')

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const filtered = surah
    ? (data || []).filter((g) =>
        (g.verses as { surah: string }[] | null)?.some((v) => v.surah === surah)
      )
    : data || []

  return NextResponse.json({
    groups: filtered,
    pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
  })
}

// POST /api/groups
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const user = await getSessionUser(supabase)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body || !body.title?.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const { data: group, error: gErr } = await supabase
    .from('groups')
    .insert({
      user_id: user.id,
      title:   stripTashkeel(body.title.trim()),
      color:   body.color || '#55b94f',
      note:    sanitizeNote(body.note),
      unote:   sanitizeNote(body.unote),
      status:  body.status || 'draft',
    })
    .select('*').single()
  if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })

  if (Array.isArray(body.verses) && body.verses.length) {
    // Batch insert all verses
    const { data: insertedVerses, error: vErr } = await supabase
      .from('verses')
      .insert(
        body.verses.map((v: { surah?: string; ayah?: string | number; label?: string | null }, vi: number) => ({
          group_id:   group.id,
          surah:      String(v.surah ?? ''),
          ayah:       parseInt(String(v.ayah ?? 1), 10) || 1,
          label:      v.label ?? null,
          sort_order: vi,
        }))
      )
      .select('id')

    if (vErr) {
      // Roll back the group to avoid orphaned record
      await supabase.from('groups').delete().eq('id', group.id)
      return NextResponse.json({ error: vErr.message }, { status: 500 })
    }

    if (insertedVerses) {
      // Batch insert all parts
      const allParts = insertedVerses.flatMap((row, vi) => {
        const v = body.verses[vi]
        return Array.isArray(v.parts)
          ? v.parts.map((p: { type?: string; text?: string }, pi: number) => ({
              verse_id:   row.id,
              type:       p.type || 'normal',
              text:       p.text || '',
              sort_order: pi,
            }))
          : []
      })
      if (allParts.length) {
        const { error: pErr } = await supabase.from('parts').insert(allParts)
        if (pErr) {
          await supabase.from('groups').delete().eq('id', group.id)
          return NextResponse.json({ error: pErr.message }, { status: 500 })
        }
      }
    }
  }

  return NextResponse.json({ group }, { status: 201 })
}
