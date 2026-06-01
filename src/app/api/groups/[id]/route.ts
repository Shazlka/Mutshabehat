import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { stripTashkeel } from '@/lib/arabic'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/groups/[id]  → group with nested verses + parts
export async function GET(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('groups')
    .select(`
      *,
      verses (
        id, surah, ayah, label, sort_order,
        parts ( id, type, text, sort_order )
      )
    `)
    .eq('id', id)
    .single()

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500
    return NextResponse.json({ error: error.message }, { status })
  }

  // Sort verses + parts client-friendly. The shape comes from a nested select.
  type VerseRow = { sort_order?: number | null; parts?: { sort_order?: number | null }[] }
  const g = data as { verses?: VerseRow[] } | null
  if (g?.verses) {
    g.verses.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    g.verses.forEach((v) => v.parts?.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)))
  }

  return NextResponse.json({ group: data })
}

// PATCH /api/groups/[id]
//   body: partial group fields + optional full verses[] replacement
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 })

  // Update group scalar fields
  const updates: Record<string, unknown> = {}
  for (const k of ['title','color','note','unote','status','favorite','completed']) {
    if (k in body) {
      updates[k] = k === 'title' ? stripTashkeel(String(body[k]).trim()) : body[k]
    }
  }
  if (Object.keys(updates).length) {
    const { error } = await supabase.from('groups').update(updates).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // If verses[] is provided, replace all verses + parts atomically
  if (Array.isArray(body.verses)) {
    // Delete existing verses (cascades to parts)
    const { error: dErr } = await supabase.from('verses').delete().eq('group_id', id)
    if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 })

    for (let vi = 0; vi < body.verses.length; vi++) {
      const v = body.verses[vi]
      const { data: verse, error: vErr } = await supabase
        .from('verses')
        .insert({
          group_id:   id,
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

  return NextResponse.json({ success: true })
}

// DELETE /api/groups/[id]  (cascades to verses + parts via FK)
export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { error } = await supabase.from('groups').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
