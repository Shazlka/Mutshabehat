// Server-only quiz repository
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { resilientFetch } from '@/lib/resilient-fetch'
import { getSurahNumberByName, getAyah } from '@/lib/quran'
import type { Answer, Performance, PrivateQuestion, QuizSettings, SimilarGroup, StoredSession } from './types'

export class QuizStorageError extends Error {
  constructor(message: string, public status = 503) { super(message) }
}
function check(error: { message: string; code?: string } | null) {
  if (!error) return
  console.error('[hifz repository]', error.code, error.message)
  if (error.code === 'P0002') throw new QuizStorageError('لم نجد هذا الاختبار.', 404)
  if (error.code === '22023') throw new QuizStorageError('حُفظت الإجابة بالفعل أو تغيّر ترتيب الأسئلة. أعد تحميل الاختبار.', 409)
  throw new QuizStorageError('تعذّر حفظ الاختبار أو تحميله. حاول مرة أخرى؛ الإجابات المحفوظة لن تضيع.')
}
export function quizAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new QuizStorageError('خدمة الاختبار غير مهيّأة بعد.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: resilientFetch } })
}
type GroupRow = { id: string; title: string; completed?: boolean; verses: { surah: string; ayah: number | string }[] }
function mapGroup(row: GroupRow): SimilarGroup {
  const keys = row.verses.flatMap(v => {
    const s = getSurahNumberByName(v.surah) ?? Number(v.surah)
    const a = Number(String(v.ayah).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))))
    return Number.isInteger(a) && getAyah(s, a) ? [`${s}:${a}`] : []
  })
  return { id: row.id, title: row.title, studied: !!row.completed, ayahKeys: [...new Set(keys)] }
}
let automaticCache: { at: number; groups: SimilarGroup[] } | undefined
let automaticLoading: Promise<SimilarGroup[]> | undefined
async function automaticGroups(db: SupabaseClient) {
  if (automaticCache && Date.now() - automaticCache.at < 600_000) return automaticCache.groups
  automaticLoading ??= (async () => {
    const { data, error } = await db.rpc('hifz_automated_references')
    check(error)
    const groups = (data as GroupRow[]).map(mapGroup).filter(g => g.ayahKeys.length > 1)
    automaticCache = { at: Date.now(), groups }
    return groups
  })().finally(() => { automaticLoading = undefined })
  return automaticLoading
}
export async function loadGroups(db: SupabaseClient, userId: string): Promise<SimilarGroup[]> {
  const personal: GroupRow[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from('groups').select('id,title,completed,verses(surah,ayah)').eq('user_id', userId).order('id').range(offset, offset + 999)
    check(error)
    personal.push(...data as unknown as GroupRow[])
    if (data!.length < 1000) break
  }
  return [...personal.map(mapGroup), ...await automaticGroups(db)]
}
export async function loadPerformance(db: SupabaseClient, userId: string): Promise<Performance[]> {
  const result: Performance[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from('user_ayah_performance').select('*').eq('user_id', userId).order('ayah_key').range(offset, offset + 999)
    check(error)
    result.push(...data!.map(r => ({ ayahKey: r.ayah_key, attempts: r.attempts, correct: r.correct_count, wrong: r.wrong_count, averageResponseMs: r.average_response_ms, lastSeen: r.last_seen, lastWrong: r.last_wrong, streak: r.streak })))
    if (data!.length < 1000) break
  }
  return result
}
export async function readSession(db: SupabaseClient, userId: string, id: string): Promise<StoredSession> {
  const { data: s, error } = await db.from('quiz_sessions').select('*').eq('user_id', userId).eq('id', id).maybeSingle()
  check(error)
  if (!s) throw new QuizStorageError('لم نجد هذا الاختبار.', 404)
  const { data: rows, error: qError } = await db.from('quiz_questions').select('*').eq('session_id', id).order('position')
  check(qError)
  const answers: Answer[] = rows!.filter(q => q.answered_at).map(q => ({ questionId: q.id, selectedChoiceId: q.selected_choice_id, correctChoiceId: q.correct_choice_id, isCorrect: q.is_correct, responseTimeMs: q.response_time_ms, answeredAt: q.answered_at, explanation: q.payload.explanation, comparisons: q.payload.comparisons, errorCategory: q.is_correct ? null : q.question_type }))
  return { id, userId, settings: s.settings, seed: s.random_seed, startedAt: s.started_at, completedAt: s.completed_at, dailyDate: s.daily_date, questions: rows!.map(q => q.payload as PrivateQuestion), answers }
}
export async function createSession(db: SupabaseClient, userId: string, id: string, settings: QuizSettings, seed: string, dailyDate: string | null, questions: PrivateQuestion[]) {
  const { data, error } = await db.rpc('hifz_create_session', { p_user: userId, p_session: { id, settings, seed, dailyDate, questionCount: questions.length }, p_questions: questions })
  check(error)
  return readSession(db, userId, data)
}
export async function saveAnswer(db: SupabaseClient, userId: string, id: string, questionId: string, choiceId: string, elapsed: number) {
  const { error } = await db.rpc('hifz_answer', { p_user: userId, p_session: id, p_question: questionId, p_choice: choiceId, p_elapsed: elapsed })
  check(error)
  return readSession(db, userId, id)
}
export async function sessionRows(db: SupabaseClient, userId: string, offset = 0, limit = 50) {
  const { data, error } = await db.from('quiz_sessions').select('*').eq('user_id', userId).order('started_at', { ascending: false }).range(offset, offset + limit - 1)
  check(error)
  return data!
}
export async function recentFingerprints(db: SupabaseClient, userId: string, count: number) {
  const rows = await sessionRows(db, userId, 0, count)
  if (!rows.length) return []
  const { data, error } = await db.from('quiz_questions').select('fingerprint').in('session_id', rows.map(s => s.id))
  check(error)
  return data!.map(q => q.fingerprint as string)
}
export async function weakCategories(db: SupabaseClient, userId: string) {
  const [types, groups] = await Promise.all([
    db.from('user_question_type_performance').select('*').eq('user_id', userId),
    db.from('user_mutashabihat_performance').select('group_id,wrong_count').eq('user_id', userId).gt('wrong_count', 1),
  ])
  check(types.error); check(groups.error)
  return { weakTypes: Object.fromEntries(types.data!.map(t => [t.question_type, t.wrong_count / Math.max(1, t.attempts)])), weakGroupIds: groups.data!.map(g => g.group_id as string) }
}
export async function dailySession(db: SupabaseClient, userId: string, date: string) {
  const { data, error } = await db.from('quiz_sessions').select('id').eq('user_id', userId).eq('daily_date', date).maybeSingle()
  check(error)
  return data ? readSession(db, userId, data.id) : null
}
