import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// POST /api/tags/import
//   body: { tags: [{ name, color }], group_tags: [{ group_id, tag_id }] }
//   tag IDs in the import are remapped by name → existing-or-created tag.
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null) as
    | { tags?: { id?: string; name: string; color?: string|null }[]; group_tags?: { group_id: string; tag_id: string }[] }
    | null
  if (!body || !Array.isArray(body.tags)) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }

  const { data: existing } = await supabase.from('tags').select('id, name')
  const existingByName = new Map((existing || []).map((t: { id: string; name: string }) => [t.name, t.id]))

  // Map incoming tag.id → final tag.id (existing or newly created)
  const idMap = new Map<string, string>()
  let created = 0
  for (const inc of body.tags) {
    if (!inc?.name?.trim()) continue
    let finalId = existingByName.get(inc.name.trim())
    if (!finalId) {
      const { data: newTag, error } = await supabase
        .from('tags').insert({ user_id: user.id, name: inc.name.trim(), color: inc.color ?? null })
        .select('id').single()
      if (error) continue
      finalId = newTag.id
      created++
    }
    if (inc.id) idMap.set(inc.id, finalId!)
  }

  // Apply group_tags — only for groups the user owns (RLS enforces it anyway)
  let attached = 0
  if (Array.isArray(body.group_tags)) {
    for (const gt of body.group_tags) {
      const final = idMap.get(gt.tag_id) || gt.tag_id
      const { error } = await supabase
        .from('group_tags').insert({ group_id: gt.group_id, tag_id: final })
      if (!error) attached++
    }
  }

  return NextResponse.json({ success: true, tagsCreated: created, linksCreated: attached })
}
