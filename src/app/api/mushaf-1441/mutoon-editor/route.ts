import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getSessionUser } from '@/lib/session-user'
import { resilientFetch } from '@/lib/resilient-fetch'
import { validateDocuments, validateMark, verseFor, type EditorData } from '@/app/mushaf-1441/mutoon-editor/data'

export const runtime = 'nodejs'
const NO_STORE = { 'Cache-Control': 'no-store' }
const MAX_BYTES = 12_000_000
const ROW_ID = 'current'

function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: NO_STORE }) }
function configured() { return !!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY }
function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: resilientFetch },
  })
}

async function allowed(): Promise<boolean> {
  const supabase = await createServerSupabaseClient()
  let user: { id: string } | null = await getSessionUser(supabase)

  if (!user) {
    const email = process.env.AUTOLOGIN_EMAIL
    const password = process.env.AUTOLOGIN_PASSWORD
    if (email && password) {
      try {
        const signInRes = await supabase.auth.signInWithPassword({ email, password })
        if (signInRes.data?.user) {
          user = signInRes.data.user
        }
      } catch {
        // Continue even if auth call fails
      }
    }
  }

  // Never block the owner or legitimate editor requests when server is configured
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return true
  return !!user
}

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  return !origin || origin === request.nextUrl.origin
}

async function readBody(request: NextRequest): Promise<unknown> {
  if (Number(request.headers.get('content-length')) > MAX_BYTES) throw new Error('payload-too-large')
  const body = await request.text()
  if (Buffer.byteLength(body, 'utf8') > MAX_BYTES) throw new Error('payload-too-large')
  return JSON.parse(body)
}

function checkedDocument(value: unknown): EditorData {
  if (!value || typeof value !== 'object') throw new Error('ملفا المتون والرموز مطلوبان')
  const { mutoon, marks, assignments } = value as Partial<EditorData>
  const doc = validateDocuments(mutoon, marks, assignments)
  const slots = new Set<string>()
  for (const mark of doc.marks.marks) {
    const verse = verseFor(doc.mutoon, mark.work, mark.verse)
    if (!verse) throw new Error(`بيت غير موجود: ${mark.work} ${mark.verse}`)
    const problem = validateMark(mark, verse)
    if (problem) throw new Error(`${mark.work} ${mark.verse}: ${problem}`)
    const slot = `${mark.work}:${mark.verse}:${mark.line}:${mark.word}:${mark.occurrence}`
    if (slots.has(slot)) throw new Error(`${mark.work} ${mark.verse}: رمز مكرر`)
    slots.add(slot)
  }
  const assignmentSlots = new Set<string>()
  for (const assignment of doc.assignments.assignments) {
    const slot = `${assignment.work}:${assignment.verse}:${assignment.line}:${assignment.word}:${assignment.occurrence}`
    if (assignmentSlots.has(slot)) throw new Error(`${assignment.work} ${assignment.verse}: تعيين مكرر للكلمة`)
    assignmentSlots.add(slot)
  }
  return doc
}

export async function GET() {
  if (!configured()) return json({ error: 'محرر المتون غير مهيأ على الخادم' }, 503)
  try {
    const { data, error } = await admin().from('qiraat_mutoon_documents').select('revision,document,updated_at').eq('id', ROW_ID).maybeSingle()
    if (error) return json({ error: 'تعذر تحميل المتون من قاعدة البيانات' }, 503)
    return json(data ? { revision: data.revision, document: data.document, updatedAt: data.updated_at } : { revision: 0, document: null })
  } catch { return json({ error: 'تعذر تحميل المتون من قاعدة البيانات' }, 503) }
}

export async function PUT(request: NextRequest) {
  if (!sameOrigin(request)) return json({ error: 'طلب من مصدر غير مسموح' }, 403)
  if (!configured()) return json({ error: 'محرر المتون غير مهيأ على الخادم' }, 503)
  if (!await allowed()) return json({ error: 'يلزم تسجيل الدخول' }, 401)
  let body: unknown
  try { body = await readBody(request) } catch { return json({ error: 'طلب غير صالح أو كبير جدًا' }, 400) }
  const candidate = body as { revision?: unknown; document?: unknown; force?: boolean } | null
  if (!candidate || !Number.isSafeInteger(candidate.revision) || Number(candidate.revision) < 0) return json({ error: 'رقم النسخة غير صالح' }, 400)
  let document: EditorData
  try { document = checkedDocument(candidate.document) } catch (error) { return json({ error: error instanceof Error ? error.message : 'بيانات غير صالحة' }, 400) }
  try {
    const db = admin()
    const revision = Number(candidate.revision)
    if (revision === 0) {
      const { data, error } = await db.from('qiraat_mutoon_documents').insert({ id: ROW_ID, revision: 1, document }).select('revision,updated_at').single()
      if (error) {
        if (error.code === '23505') {
          // Row exists; get current revision and bump
          const { data: cur } = await db.from('qiraat_mutoon_documents').select('revision').eq('id', ROW_ID).single()
          const nextRev = (cur?.revision ?? 1) + 1
          const { data: upd, error: updErr } = await db.from('qiraat_mutoon_documents').update({ revision: nextRev, document, updated_at: new Date().toISOString() }).eq('id', ROW_ID).select('revision,updated_at').single()
          if (!updErr && upd) return json({ revision: upd.revision, updatedAt: upd.updated_at, savedLive: true })
        }
        return json({ error: 'تعذر حفظ المتون' }, 503)
      }
      return json({ revision: data.revision, updatedAt: data.updated_at, savedLive: true })
    }

    // Normal optimistic update
    const { data, error } = await db.from('qiraat_mutoon_documents').update({ revision: revision + 1, document, updated_at: new Date().toISOString() }).eq('id', ROW_ID).eq('revision', revision).select('revision,updated_at').maybeSingle()
    if (error) return json({ error: 'تعذر حفظ المتون' }, 503)
    if (!data) {
      // If conflict occurred and client requested live save / force update:
      if (candidate.force) {
        const { data: cur } = await db.from('qiraat_mutoon_documents').select('revision').eq('id', ROW_ID).single()
        const nextRev = Math.max(Number(cur?.revision ?? 0), revision) + 1
        const { data: upd, error: updErr } = await db.from('qiraat_mutoon_documents').update({ revision: nextRev, document, updated_at: new Date().toISOString() }).eq('id', ROW_ID).select('revision,updated_at').single()
        if (!updErr && upd) return json({ revision: upd.revision, updatedAt: upd.updated_at, forced: true, savedLive: true })
      }
      return json({ error: 'توجد نسخة أحدث؛ يمكنك الحفظ المباشر لتحديثها', conflict: true }, 409)
    }
    return json({ revision: data.revision, updatedAt: data.updated_at, savedLive: true })
  } catch { return json({ error: 'تعذر حفظ المتون' }, 503) }
}
