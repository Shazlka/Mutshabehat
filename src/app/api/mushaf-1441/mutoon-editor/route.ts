import { NextRequest, NextResponse } from 'next/server'
import { mutoonConfigured, mutoonRpc } from '@/lib/mutoon-db'
import { validateOps } from '@/app/mushaf-1441/mutoon-editor/ops'
import { WORK_IDS, type WorkId } from '@/app/mushaf-1441/mutoon-editor/data'

export const runtime = 'nodejs'
const NO_STORE = { 'Cache-Control': 'no-store' }
const MAX_BYTES = 400_000

function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: NO_STORE }) }

// Who may edit: by the owner's decision the site signs every visitor in as the owner (src/proxy.ts), so there is no
// separate editor login. The write path is still closed to other origins (CSRF) and every operation is validated and
// version-checked in the database.
function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  return !origin || origin === request.nextUrl.origin
}

/**
 * GET ?work=W            a poem's chapters and verses with per-verse counts (no marks or assignments)
 * GET ?work=W&verse=N    one verse with its marks and assignments
 * GET ?since=S           the verses that changed after sequence S, each with its rows
 * GET                    the current sequence number
 */
export async function GET(request: NextRequest) {
  if (!mutoonConfigured()) return json({ error: 'محرر المتون غير مهيأ على الخادم' }, 503)
  const params = request.nextUrl.searchParams
  const work = params.get('work')
  if (work !== null && !WORK_IDS.includes(work as WorkId)) return json({ error: 'متن غير معروف' }, 400)

  if (params.has('since')) {
    const since = Number(params.get('since'))
    if (!Number.isSafeInteger(since) || since < 0) return json({ error: 'رقم التسلسل غير صالح' }, 400)
    const result = await mutoonRpc('qiraat_mutoon_changes_json', { p_since: since })
    return result.error ? json({ error: result.error.message }, result.error.status) : json(result.data)
  }
  if (work && params.has('verse')) {
    const verse = Number(params.get('verse'))
    if (!Number.isSafeInteger(verse) || verse < 1) return json({ error: 'رقم البيت غير صالح' }, 400)
    const result = await mutoonRpc('qiraat_mutoon_verse_json', { p_work: work, p_verse: verse })
    if (result.error) return json({ error: result.error.message }, result.error.status)
    return result.data ? json(result.data) : json({ error: 'البيت غير موجود' }, 404)
  }
  if (work) {
    const result = await mutoonRpc('qiraat_mutoon_work_json', { p_work: work })
    if (result.error) return json({ error: result.error.message }, result.error.status)
    return result.data ? json(result.data) : json({ error: 'المتن غير موجود' }, 404)
  }
  const result = await mutoonRpc<number>('qiraat_mutoon_seq_now')
  return result.error ? json({ error: result.error.message }, result.error.status) : json({ seq: result.data })
}

/** POST { ops, lines, client }: applies row operations atomically. A stale row or verse answers 409 with nothing changed. */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return json({ error: 'طلب من مصدر غير مسموح' }, 403)
  if (!mutoonConfigured()) return json({ error: 'محرر المتون غير مهيأ على الخادم' }, 503)
  let body: { ops?: unknown; lines?: Record<string, unknown>; client?: unknown }
  try {
    const text = await request.text()
    if (text.length > MAX_BYTES) return json({ error: 'الطلب كبير جدًا' }, 413)
    body = JSON.parse(text)
  } catch { return json({ error: 'طلب غير صالح' }, 400) }
  if (!body || typeof body !== 'object') return json({ error: 'طلب غير صالح' }, 400)
  const problem = validateOps(body.ops, body.lines ?? {})
  if (problem) return json({ error: problem }, 400)
  const client = typeof body.client === 'string' ? body.client.slice(0, 40) : null
  const result = await mutoonRpc('qiraat_mutoon_apply', { p_ops: body.ops, p_client: client })
  if (result.error) return json({ error: result.error.message, ...(result.error.status === 409 ? { conflict: true } : {}) }, result.error.status)
  return json(result.data)
}

/** The old editor re-sent the whole 3 MB document with PUT. Cached copies of that page must reload. */
export async function PUT() {
  return json({ error: 'نسخة قديمة من المحرر؛ أعد تحميل الصفحة' }, 410)
}
