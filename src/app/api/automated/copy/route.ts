import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getSessionUser } from '@/lib/session-user'
import { sanitizeNote } from '@/lib/sanitize'

type PartInput  = { type: string; text: string }
type VerseInput = { surah?: string; ayah?: number | string; label?: string; parts?: PartInput[] }
type Payload    = { note?: string; unote?: string; verses?: VerseInput[] }
type SourceRow  = { id: number; title: string; color: string; payload: Payload }

function parseAyah(val: number | string | undefined): number {
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    const digits = val.split('').map((c) => {
      const i = '٠١٢٣٤٥٦٧٨٩'.indexOf(c)
      return i >= 0 ? String(i) : c
    }).join('')
    return parseInt(digits, 10) || 1
  }
  return 1
}

// POST /api/automated/copy   body: { automated_ids: number[] }
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const user = await getSessionUser(supabase)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null) as { automated_ids?: number[] } | null
  if (!body || !Array.isArray(body.automated_ids) || !body.automated_ids.length) {
    return NextResponse.json({ error: 'automated_ids required' }, { status: 400 })
  }

  const { data: rows } = await supabase
    .from('automated_groups')
    .select('id, title, color, payload')
    .in('id', body.automated_ids)

  if (!rows?.length) return NextResponse.json({ error: 'not found' }, { status: 404 })

  let copied = 0
  for (const row of rows as SourceRow[]) {
    const p = row.payload

    const { data: newGroup, error: gErr } = await supabase
      .from('groups')
      .insert({
        user_id: user.id,
        title:   row.title,
        color:   row.color,
        note:    sanitizeNote(p?.note),
        unote:   sanitizeNote(p?.unote),
        status:  'draft',
      })
      .select('id').single()
    if (gErr || !newGroup) continue

    const verses = Array.isArray(p?.verses) ? p.verses : []
    if (verses.length) {
      // Batch insert verses
      const { data: insertedVerses, error: vErr } = await supabase
        .from('verses')
        .insert(
          verses.map((v, vi) => ({
            group_id:   newGroup.id,
            surah:      String(v.surah ?? ''),
            ayah:       parseAyah(v.ayah),
            label:      v.label ?? null,
            sort_order: vi,
          }))
        )
        .select('id')

      if (vErr) {
        await supabase.from('groups').delete().eq('id', newGroup.id)
        continue
      }

      if (insertedVerses) {
        // Batch insert all parts
        const allParts = insertedVerses.flatMap((verseRow, vi) => {
          const parts = Array.isArray(verses[vi].parts) ? verses[vi].parts! : []
          return parts.map((pp, pi) => ({
            verse_id:   verseRow.id,
            type:       pp.type || 'normal',
            text:       pp.text || '',
            sort_order: pi,
          }))
        })
        if (allParts.length) {
          const { error: pErr } = await supabase.from('parts').insert(allParts)
          if (pErr) {
            await supabase.from('groups').delete().eq('id', newGroup.id)
            continue
          }
        }
      }
    }

    copied++
  }

  return NextResponse.json({ success: true, copied })
}
