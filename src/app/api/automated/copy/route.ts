import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// POST /api/automated/copy   body: { automated_ids: number[] }
//   Copies the selected automated groups into the user's personal database.
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null) as { automated_ids?: number[] } | null
  if (!body || !Array.isArray(body.automated_ids) || !body.automated_ids.length) {
    return NextResponse.json({ error: 'automated_ids required' }, { status: 400 })
  }

  // Fetch source rows
  const { data: rows } = await supabase
    .from('automated_groups')
    .select('id, title, color, payload')
    .in('id', body.automated_ids)

  if (!rows?.length) return NextResponse.json({ error: 'not found' }, { status: 404 })

  let copied = 0
  for (const row of rows) {
    const p = (row as { payload: { note?: string; unote?: string; verses?: { surah?: string; ayah?: number|string; label?: string; parts?: { type: string; text: string }[] }[] } }).payload
    const { data: newGroup, error: gErr } = await supabase
      .from('groups')
      .insert({
        user_id: user.id,
        title:   (row as { title: string }).title,
        color:   (row as { color: string }).color,
        note:    p?.note  ?? null,
        unote:   p?.unote ?? null,
        status:  'draft',
      })
      .select('id').single()
    if (gErr || !newGroup) continue

    const verses = Array.isArray(p?.verses) ? p.verses : []
    for (let vi = 0; vi < verses.length; vi++) {
      const v = verses[vi]
      let ayahNum: number = 1
      if (typeof v.ayah === 'number') ayahNum = v.ayah
      else if (typeof v.ayah === 'string') {
        const digits = v.ayah.split('').map((c: string) =>
          '٠١٢٣٤٥٦٧٨٩'.indexOf(c) >= 0 ? String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)) : c).join('')
        ayahNum = parseInt(digits, 10) || 1
      }
      const { data: verseRow, error: vErr } = await supabase
        .from('verses')
        .insert({
          group_id:   newGroup.id,
          surah:      String(v.surah ?? ''),
          ayah:       ayahNum,
          label:      v.label ?? null,
          sort_order: vi,
        }).select('id').single()
      if (vErr || !verseRow) continue

      const parts = Array.isArray(v.parts) ? v.parts : []
      if (parts.length) {
        await supabase.from('parts').insert(
          parts.map((pp, pi) => ({
            verse_id:   verseRow.id,
            type:       pp.type || 'normal',
            text:       pp.text || '',
            sort_order: pi,
          }))
        )
      }
    }
    copied++
  }

  return NextResponse.json({ success: true, copied })
}
