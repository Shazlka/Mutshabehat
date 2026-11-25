import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getSessionUser } from '@/lib/session-user'

const MAX_IMPORT_BYTES = 512 * 1024
const MAX_TAGS = 500
const MAX_LINKS = 5_000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COLOR_RE = /^#[0-9a-fA-F]{3,8}$/

// POST /api/tags/import
//   body: { tags: [{ name, color }], group_tags: [{ group_id, tag_id }] }
//   tag IDs in the import are remapped by name → existing-or-created tag.
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const user = await getSessionUser(supabase)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const declaredLen = Number(request.headers.get('content-length') ?? 0)
  if (declaredLen > MAX_IMPORT_BYTES) {
    return NextResponse.json({ error: 'payload too large' }, { status: 413 })
  }
  const raw = await request.text().catch(() => '')
  if (raw.length > MAX_IMPORT_BYTES) {
    return NextResponse.json({ error: 'payload too large' }, { status: 413 })
  }

  let body: { tags?: { id?: string; name: string; color?: string|null }[]; group_tags?: { group_id: string; tag_id: string }[] } | null = null
  try {
    body = JSON.parse(raw)
  } catch {
    body = null
  }
  if (!body || !Array.isArray(body.tags) || body.tags.length > MAX_TAGS || (Array.isArray(body.group_tags) && body.group_tags.length > MAX_LINKS)) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }

  const { data: existing } = await supabase.from('tags').select('id, name').eq('user_id', user.id)
  const existingByName = new Map((existing || []).map((t: { id: string; name: string }) => [t.name, t.id]))

  // Map incoming tag.id → final tag.id (existing or newly created)
  const idMap = new Map<string, string>()
  let created = 0
  let tagsFailed = 0
  for (const inc of body.tags) {
    const cleanName = typeof inc?.name === 'string' ? inc.name.trim().slice(0, 80) : ''
    if (!cleanName) continue
    const cleanColor = typeof inc?.color === 'string' && COLOR_RE.test(inc.color.trim()) ? inc.color.trim() : null
    let finalId = existingByName.get(cleanName)
    if (!finalId) {
      const { data: newTag, error } = await supabase
        .from('tags').insert({ user_id: user.id, name: cleanName, color: cleanColor })
        .select('id').single()
      if (error) { tagsFailed++; continue }
      finalId = newTag.id
      created++
    }
    if (typeof inc.id === 'string' && inc.id) idMap.set(inc.id, finalId!)
  }

  // Apply group_tags — only for groups the user owns (RLS enforces it anyway)
  let attached = 0
  let linksFailed = 0
  if (Array.isArray(body.group_tags)) {
    for (const gt of body.group_tags) {
      if (typeof gt?.group_id !== 'string' || !UUID_RE.test(gt.group_id)) {
        linksFailed++
        continue
      }
      const rawTagId = typeof gt.tag_id === 'string' ? gt.tag_id : ''
      const final = idMap.get(rawTagId) || (UUID_RE.test(rawTagId) ? rawTagId : null)
      if (!final) {
        linksFailed++
        continue
      }
      const { error } = await supabase
        .from('group_tags').insert({ group_id: gt.group_id, tag_id: final })
      if (!error) attached++
      else linksFailed++
    }
  }

  return NextResponse.json({
    success: true,
    tagsCreated: created,
    linksCreated: attached,
    ...(tagsFailed  > 0 && { tagsFailed }),
    ...(linksFailed > 0 && { linksFailed }),
  })
}
