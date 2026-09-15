import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

type Ctx = { params: Promise<{ id: string }> }

async function verifyOwnership(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  groupId: string,
  userId: string
) {
  const { data } = await supabase
    .from('groups')
    .select('id')
    .eq('id', groupId)
    .eq('user_id', userId)
    .single()
  return !!data
}

// GET /api/groups/[id]/tags
export async function GET(_request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  if (!(await verifyOwnership(supabase, id, user.id))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('group_tags')
    .select('tag_id, tags(id, name, color)')
    .eq('group_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tags: (data || []).map((r) => r.tags) })
}

// POST /api/groups/[id]/tags  body: { tag_id }
export async function POST(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  if (!(await verifyOwnership(supabase, id, user.id))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body?.tag_id) return NextResponse.json({ error: 'tag_id required' }, { status: 400 })

  const { error } = await supabase
    .from('group_tags')
    .insert({ group_id: id, tag_id: body.tag_id })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true }, { status: 201 })
}

// DELETE /api/groups/[id]/tags?tag_id=
export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  if (!(await verifyOwnership(supabase, id, user.id))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const tagId = searchParams.get('tag_id')
  if (!tagId) return NextResponse.json({ error: 'tag_id required' }, { status: 400 })

  const { error } = await supabase
    .from('group_tags')
    .delete()
    .eq('group_id', id)
    .eq('tag_id', tagId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
