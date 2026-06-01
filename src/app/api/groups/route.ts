import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// GET /api/groups
//   ?surah=النمل       — filter by surah name
//   ?status=draft       — draft | published | locked
//   ?favorite=true      — only favorites
//   ?page=1&limit=20    — pagination
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
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
    .order('updated_at', { ascending: false })
    .range(from, to)

  if (status)   query = query.eq('status', status)
  if (favorite) query = query.eq('favorite', favorite === 'true')

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Surah filter is a post-query filter (verses are nested)
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
//   body: { title, color?, note?, unote?, verses?: [{ surah, ayah, label?, parts: [{ type, text }] }] }
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body || !body.title?.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  // Create group
  const { data: group, error: gErr } = await supabase
    .from('groups')
    .insert({
      user_id: user.id,
      title:   body.title.trim(),
      color:   body.color || '#55b94f',
      note:    body.note  ?? null,
      unote:   body.unote ?? null,
      status:  body.status || 'draft',
    })
    .select('*').single()
  if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 })

  // Insert verses + parts if provided
  if (Array.isArray(body.verses) && body.verses.length) {
    for (let vi = 0; vi < body.verses.length; vi++) {
      const v = body.verses[vi]
      const { data: verse, error: vErr } = await supabase
        .from('verses')
        .insert({
          group_id:   group.id,
          surah:      String(v.surah ?? ''),
          ayah:       parseInt(v.ayah ?? 1, 10) || 1,
          label:      v.label ?? null,
          sort_order: vi,
        })
        .select('id').single()
      if (vErr) continue

      if (Array.isArray(v.parts) && v.parts.length) {
        await supabase.from('parts').insert(
          v.parts.map((p: { type: string; text: string }, pi: number) => ({
            verse_id:   verse.id,
            type:       p.type || 'normal',
            text:       p.text || '',
            sort_order: pi,
          }))
        )
      }
    }
  }

  return NextResponse.json({ group }, { status: 201 })
}
