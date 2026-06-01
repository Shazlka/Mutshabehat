import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { normalizeArabic } from '@/lib/arabic'

// GET /api/search?q=<arabic>&limit=20
//   Searches groups by title AND parts by text (tashkeel-insensitive).
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q     = searchParams.get('q')?.trim() || ''
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))

  if (!q) return NextResponse.json({ groups: [], parts: [] })

  const qNorm = normalizeArabic(q)

  // 1) Search group titles using ILIKE (case + tashkeel-tolerant via normalized client check)
  const { data: titleHits, error: tErr } = await supabase
    .from('groups')
    .select('id, title, color, status, favorite, completed, updated_at')
    .ilike('title', `%${q}%`)
    .limit(limit)
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 })

  // 2) Search part text
  const { data: partHits, error: pErr } = await supabase
    .from('parts')
    .select(`
      id, text, type,
      verses ( id, surah, ayah, label,
        groups ( id, title, color )
      )
    `)
    .ilike('text', `%${q}%`)
    .limit(limit)
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

  // 3) Also search normalized form (strip tashkeel from query, then ilike again if different)
  let extraTitleHits: typeof titleHits = []
  let extraPartHits:  typeof partHits  = []
  if (qNorm && qNorm !== q) {
    const { data: t2 } = await supabase
      .from('groups')
      .select('id, title, color, status, favorite, completed, updated_at')
      .ilike('title', `%${qNorm}%`)
      .limit(limit)
    extraTitleHits = t2 || []

    const { data: p2 } = await supabase
      .from('parts')
      .select(`
        id, text, type,
        verses ( id, surah, ayah, label,
          groups ( id, title, color )
        )
      `)
      .ilike('text', `%${qNorm}%`)
      .limit(limit)
    extraPartHits = p2 || []
  }

  // Dedupe by id
  const groupsMap = new Map<string, typeof titleHits[number]>()
  ;[...(titleHits || []), ...(extraTitleHits || [])].forEach((g) => groupsMap.set(g.id, g))

  const partsMap = new Map<string, typeof partHits[number]>()
  ;[...(partHits || []), ...(extraPartHits || [])].forEach((p) => partsMap.set(p.id, p))

  return NextResponse.json({
    query: q,
    normalized: qNorm,
    groups: Array.from(groupsMap.values()),
    parts:  Array.from(partsMap.values()),
  })
}
