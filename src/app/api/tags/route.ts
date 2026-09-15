import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getSessionUser } from '@/lib/session-user'

// GET /api/tags  → all tags for the user
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const user = await getSessionUser(supabase)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tags: data || [] })
}

// POST /api/tags  → create  { name, color? }
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const user = await getSessionUser(supabase)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body?.name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const name = body.name.trim()

  // Reject duplicates (case-insensitive)
  const { data: existing } = await supabase
    .from('tags')
    .select('id')
    .ilike('name', name)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ error: 'وسم بهذا الاسم موجود مسبقاً' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('tags')
    .insert({ user_id: user.id, name, color: body.color ?? null })
    .select('*').single()

  if (error) {
    // Postgres unique-constraint violation (code 23505) means duplicate tag
    if (error.code === '23505') {
      return NextResponse.json({ error: 'وسم بهذا الاسم موجود مسبقاً' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ tag: data }, { status: 201 })
}
