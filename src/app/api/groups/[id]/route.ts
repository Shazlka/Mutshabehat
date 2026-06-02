import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { stripTashkeel } from '@/lib/arabic'
import { sanitizeNote } from '@/lib/sanitize'

type Ctx = { params: Promise<{ id: string }> }

async function getAuthorizedGroup(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, id: string, userId: string) {
  const { data } = await supabase
    .from('groups')
    .select('id, user_id')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  return data
}

// GET /api/groups/[id]
export async function GET(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const owned = await getAuthorizedGroup(supabase, id, user.id)
  if (!owned) return NextResponse.json({ error: 'not found' }, { status: 404 })

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

  type VerseRow = { sort_order?: number | null; parts?: { sort_order?: number | null }[] }
  const g = data as { verses?: VerseRow[] } | null
  if (g?.verses) {
    g.verses.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    g.verses.forEach((v) => v.parts?.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)))
  }

  return NextResponse.json({ group: data })
}

// PATCH /api/groups/[id]
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const owned = await getAuthorizedGroup(supabase, id, user.id)
  if (!owned) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  for (const k of ['title', 'color', 'note', 'unote', 'status', 'favorite', 'completed']) {
    if (k in body) {
      if (k === 'title') updates[k] = stripTashkeel(String(body[k]).trim())
      else if (k === 'note' || k === 'unote') updates[k] = sanitizeNote(body[k])
      else updates[k] = body[k]
    }
  }
  if (Object.keys(updates).length) {
    const { error } = await supabase.from('groups').update(updates).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (Array.isArray(body.verses)) {
    // Delete existing verses (cascades to parts)
    const { error: dErr } = await supabase.from('verses').delete().eq('group_id', id)
    if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 })

    if (body.verses.length > 0) {
      // Batch insert all verses
      const { data: insertedVerses, error: vErr } = await supabase
        .from('verses')
        .insert(
          body.verses.map((v: { surah?: string; ayah?: string | number; label?: string | null }, vi: number) => ({
            group_id:   id,
            surah:      String(v.surah ?? ''),
            ayah:       parseInt(String(v.ayah ?? 1), 10) || 1,
            label:      v.label ?? null,
            sort_order: vi,
          }))
        )
        .select('id')

      if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 })

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
          if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
        }
      }
    }
  }

  return NextResponse.json({ success: true })
}

// DELETE /api/groups/[id]
export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const owned = await getAuthorizedGroup(supabase, id, user.id)
  if (!owned) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { error } = await supabase.from('groups').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
