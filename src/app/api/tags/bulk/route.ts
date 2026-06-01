import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// POST /api/tags/bulk
//   body: { group_ids: string[], tag_ids: string[], mode: 'add'|'replace'|'remove' }
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null) as
    | { group_ids?: string[]; tag_ids?: string[]; mode?: 'add'|'replace'|'remove' }
    | null
  if (!body || !Array.isArray(body.group_ids) || !Array.isArray(body.tag_ids)) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }
  const mode = body.mode ?? 'add'

  if (mode === 'replace') {
    await supabase.from('group_tags').delete().in('group_id', body.group_ids)
  }
  if (mode === 'remove') {
    if (body.tag_ids.length) {
      await supabase.from('group_tags').delete()
        .in('group_id', body.group_ids).in('tag_id', body.tag_ids)
    }
  } else {
    // add or replace → insert all pairs
    const rows: { group_id: string; tag_id: string }[] = []
    for (const gid of body.group_ids) for (const tid of body.tag_ids) rows.push({ group_id: gid, tag_id: tid })
    if (rows.length) {
      // .upsert with onConflict prevents duplicate-pk errors on add-mode
      await supabase.from('group_tags').upsert(rows, { onConflict: 'group_id,tag_id', ignoreDuplicates: true })
    }
  }

  return NextResponse.json({ success: true })
}
