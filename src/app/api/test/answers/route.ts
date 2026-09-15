import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getSessionUser } from '@/lib/session-user'

type AnswerInput = {
  source?: string
  kind?: string
  correct?: boolean
  surah?: string
  ayah?: number
  groupId?: string | null
}

const SOURCES = new Set(['personal', 'quran'])
const KINDS = new Set(['mcq', 'flash', 'words'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// POST /api/test/answers   body: one answered test question — feeds the statistics tab.
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const user = await getSessionUser(supabase)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null) as AnswerInput | null
  if (!body || !SOURCES.has(String(body.source)) || !KINDS.has(String(body.kind)) || typeof body.correct !== 'boolean') {
    return NextResponse.json({ error: 'invalid answer' }, { status: 400 })
  }

  const { error } = await supabase.from('test_answers').insert({
    user_id: user.id,
    source: body.source,
    kind: body.kind,
    correct: body.correct,
    surah: typeof body.surah === 'string' ? body.surah.slice(0, 40) : null,
    ayah: Number.isInteger(body.ayah) ? body.ayah : null,
    group_id: body.groupId && UUID.test(body.groupId) ? body.groupId : null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
