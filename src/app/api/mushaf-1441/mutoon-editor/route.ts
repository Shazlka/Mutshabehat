import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resilientFetch } from '@/lib/resilient-fetch'
import { validateDocuments, validateMark, verseFor, type EditorData } from '@/app/mushaf-1441/mutoon-editor/data'

export const runtime = 'nodejs'
const NO_STORE = { 'Cache-Control': 'no-store' }
const MAX_BYTES = 8_000_000
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
  const { data, error } = await supabase.auth.getUser()
  return !error && !!data.user
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
  if (!await allowed()) return json({ error: 'يلزم تسجيل الدخول' }, 401)
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
  const candidate = body as { revision?: unknown; document?: unknown } | null
  if (!candidate || !Number.isSafeInteger(candidate.revision) || Number(candidate.revision) < 0) return json({ error: 'رقم النسخة غير صالح' }, 400)
  let document: EditorData
  try { document = checkedDocument(candidate.document) } catch (error) { return json({ error: error instanceof Error ? error.message : 'بيانات غير صالحة' }, 400) }
  try {
    const db = admin()
    const revision = Number(candidate.revision)
    if (revision === 0) {
      const { data, error } = await db.from('qiraat_mutoon_documents').insert({ id: ROW_ID, revision: 1, document }).select('revision,updated_at').single()
      if (error) return json({ error: error.code === '23505' ? 'توجد نسخة أحدث؛ أعد تحميل المحرر' : 'تعذر حفظ المتون' }, error.code === '23505' ? 409 : 503)
      return json({ revision: data.revision, updatedAt: data.updated_at })
    }
    const { data, error } = await db.from('qiraat_mutoon_documents').update({ revision: revision + 1, document, updated_at: new Date().toISOString() }).eq('id', ROW_ID).eq('revision', revision).select('revision,updated_at').maybeSingle()
    if (error) return json({ error: 'تعذر حفظ المتون' }, 503)
    if (!data) return json({ error: 'توجد نسخة أحدث؛ نزّل مسودتك ثم أعد تحميل المحرر' }, 409)
    return json({ revision: data.revision, updatedAt: data.updated_at })
  } catch { return json({ error: 'تعذر حفظ المتون' }, 503) }
}
