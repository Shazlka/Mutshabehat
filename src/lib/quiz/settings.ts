import { QUESTION_TYPES, type QuizSettings, type Scope } from './types'

export class QuizInputError extends Error { status = 400 }
const MODES = ['quick','custom','mutashabihat','weak','daily']
const SCOPES = ['all','surahs','juz','hizb','pages','ayah_range','studied','studied_mutashabihat','group']
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const fail = () => { throw new QuizInputError('تحقّق من نطاق الاختبار وعدد الأسئلة والإعدادات.') }
export function parseSettings(input: unknown): QuizSettings {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fail()
  const b = input as Record<string, unknown>
  if (!MODES.includes(String(b.mode))) return fail()
  const difficulty = b.difficulty ?? 2
  if (!Number.isInteger(difficulty) || Number(difficulty)<1 || Number(difficulty)>5) return fail()
  const count = b.mode==='quick' ? 10 : b.mode==='daily' ? 20 : b.count ?? 20
  if (![10,20,30,50,100].includes(Number(count)) || typeof count !== 'number') return fail()
  const qt = b.questionType ?? 'mixed'
  if (qt !== 'mixed' && !QUESTION_TYPES.includes(qt as typeof QUESTION_TYPES[number])) return fail()
  const raw = b.scope ?? {type:'all'}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail()
  const scope = raw as Scope
  if (!SCOPES.includes(scope.type)) return fail()
  const surahs = scope.surahIds
  if (surahs !== undefined && (!Array.isArray(surahs) || surahs.length>114 || surahs.some(s=>!Number.isInteger(s)||s<1||s>114))) return fail()
  if (['surahs','ayah_range'].includes(scope.type) && !surahs?.length) return fail()
  if (scope.type==='ayah_range' && surahs?.length!==1) return fail()
  if (['juz','hizb','pages','ayah_range'].includes(scope.type)) {
    const max = scope.type==='juz'?30:scope.type==='hizb'?60:scope.type==='pages'?604:286
    if (!Number.isInteger(scope.from)||!Number.isInteger(scope.to)||scope.from!<1||scope.to!<scope.from!||scope.to!>max) return fail()
  }
  if (scope.type==='group' && (typeof scope.groupId!=='string'||scope.groupId.length>100||!scope.groupId)) return fail()
  const timer = b.timer ?? 'none'
  if (!['none','question','quiz'].includes(String(timer))) return fail()
  const timerSeconds = b.timerSeconds ?? (timer==='question'?60:1200)
  if (!Number.isInteger(timerSeconds)||Number(timerSeconds)<5||Number(timerSeconds)>7200) return fail()
  const timezone = b.timezone ?? 'UTC'
  if (typeof timezone !== 'string'||timezone.length>100) return fail()
  try { new Intl.DateTimeFormat('en',{timeZone:timezone}) } catch { return fail() }
  if (b.retryDaily !== undefined && typeof b.retryDaily !== 'boolean') return fail()
  if (b.reviewSessionId !== undefined && (typeof b.reviewSessionId!=='string'||!UUID.test(b.reviewSessionId))) return fail()
  return {mode:b.mode as QuizSettings['mode'],difficulty:difficulty as QuizSettings['difficulty'],count,scope,questionType:qt as QuizSettings['questionType'],timer:timer as QuizSettings['timer'],timerSeconds:Number(timerSeconds),timezone,retryDaily:b.retryDaily as boolean|undefined,reviewSessionId:b.reviewSessionId as string|undefined}
}
