import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getSessionUser } from '@/lib/session-user'
import { stripTashkeel } from '@/lib/arabic'
import { sanitizeNote } from '@/lib/sanitize'

type Ctx = { params: Promise<{ id: string }> }

// Ownership is enforced by RLS (auth.uid() = user_id) on every query below,
// so there is no separate "is this my group?" round-trip.

// GET /api/groups/[id]
export async function GET(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const supabase = await createServerSupabaseClient()
  const user = await getSessionUser(supabase)
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

  type VerseRow = { sort_order?: number | null; parts?: { sort_order?: number | null }[] }
  const g = data as { verses?: VerseRow[] } | null
  if (g?.verses) {
    g.verses.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    g.verses.forEach((v) => v.parts?.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)))
  }

  return NextResponse.json({ group: data })
}

type VerseInput = { surah?: string; ayah?: string | number; label?: string | null; parts?: { type?: string; text?: string }[] }

// PATCH /api/groups/[id] — one database round-trip via the save_group() RPC.
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const supabase = await createServerSupabaseClient()
  const user = await getSessionUser(supabase)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 })

  const fields: Record<string, unknown> = {}
  for (const k of ['title', 'color', 'note', 'unote', 'status', 'favorite', 'completed']) {
    if (k in body) {
      if (k === 'title') fields[k] = stripTashkeel(String(body[k]).trim())
      else if (k === 'note' || k === 'unote') fields[k] = sanitizeNote(body[k])
      else fields[k] = body[k]
    }
  }

  const verses = Array.isArray(body.verses)
    ? (body.verses as VerseInput[]).map((v) => ({
        surah: String(v.surah ?? ''),
        ayah:  parseInt(String(v.ayah ?? 1), 10) || 1,
        label: v.label ?? null,
        parts: Array.isArray(v.parts)
          ? v.parts.map((p) => ({ type: p.type || 'normal', text: p.text || '' }))
          : [],
      }))
    : null

  const { error } = await supabase.rpc('save_group', {
    p_group_id: id,
    p_fields:   fields,
    p_verses:   verses,
  })
  if (error) {
    const status = error.code === '42501' ? 403 : 500
    return NextResponse.json({ error: error.message }, { status })
  }

  return NextResponse.json({ success: true })
}

// DELETE /api/groups/[id]
export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const supabase = await createServerSupabaseClient()
  const user = await getSessionUser(supabase)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data, error } = await supabase.from('groups').delete().eq('id', id).select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  return NextResponse.json({ success: true })
}
