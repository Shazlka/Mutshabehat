import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// GET /api/tags/export?format=json|csv
export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') === 'csv' ? 'csv' : 'json'

  const { data: tags } = await supabase.from('tags').select('id, name, color')
  const { data: gt }   = await supabase.from('group_tags').select('group_id, tag_id')
  const { data: groups } = await supabase.from('groups').select('id, title')

  if (format === 'csv') {
    const tagMap = new Map((tags || []).map((t: { id: string; name: string }) => [t.id, t.name]))
    const groupTags = new Map<string, string[]>()
    ;(gt || []).forEach((r: { group_id: string; tag_id: string }) => {
      if (!groupTags.has(r.group_id)) groupTags.set(r.group_id, [])
      groupTags.get(r.group_id)!.push(tagMap.get(r.tag_id) ?? r.tag_id)
    })
    const header = 'group_id,group_title,tag_names'
    const rows = (groups || []).map((g: { id: string; title: string }) => {
      const ts = (groupTags.get(g.id) || []).join('|')
      const safeTitle = `"${(g.title || '').replace(/"/g, '""')}"`
      return `${g.id},${safeTitle},"${ts}"`
    })
    const csv = [header, ...rows].join('\n')
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="tags-export.csv"',
      },
    })
  }

  // JSON format
  const payload = { tags: tags || [], group_tags: gt || [] }
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="tags-export.json"',
    },
  })
}
