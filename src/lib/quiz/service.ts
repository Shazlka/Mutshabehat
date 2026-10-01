import 'server-only'
import { randomUUID } from 'node:crypto'
import { getSurahNames } from '@/lib/quran'
import { generateQuiz } from './generator'
import { adaptiveDifficulty, weaknessScore } from './adaptive'
import { publicSession } from './presentation'
import { parseSettings, QuizInputError } from './settings'
import { quizAdmin, loadGroups, loadPerformance, recentFingerprints, weakCategories, createSession, dailySession, readSession, sessionRows, QuizStorageError } from './repository'
import type { Dashboard, CategoryStat } from './types'

export async function startQuiz(userId: string, input: unknown) {
  const settings = parseSettings(input)
  const db = quizAdmin()
  const date = new Intl.DateTimeFormat('en-CA',{timeZone:settings.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
  const dailyDate = settings.mode==='daily' && !settings.retryDaily ? date : null
  if (dailyDate) { const existing = await dailySession(db,userId,dailyDate); if(existing) return publicSession(existing) }
  const [groups,performance,recent,categories] = await Promise.all([loadGroups(db,userId),loadPerformance(db,userId),recentFingerprints(db,userId,3),weakCategories(db,userId)])
  if (settings.mode==='quick'||settings.mode==='daily') {
    settings.difficulty=adaptiveDifficulty(performance)
    if (settings.scope.type==='all' && groups.some(g=>g.studied&&g.ayahKeys.length)) settings.scope={type:'studied'}
  }
  if (settings.mode==='mutashabihat') settings.questionType='mixed'
  let reviewAyahKeys: string[] | undefined
  if (settings.reviewSessionId) {
    const review=await readSession(db,userId,settings.reviewSessionId)
    reviewAyahKeys=review.answers.filter(a=>!a.isCorrect).map(a=>review.questions.find(q=>q.id===a.questionId)!.ayahKey)
    if (!reviewAyahKeys.length) throw new QuizInputError('لا توجد أخطاء في هذا الاختبار. جرّب اختبارًا جديدًا.')
  }
  if (settings.mode==='weak'&&!reviewAyahKeys?.length&&!performance.some(p=>p.wrong>0)) throw new QuizInputError('ليس لديك أخطاء محفوظة بعد. ابدأ باختبار سريع.')
  const seed=randomUUID()
  let questions
  try { questions=generateQuiz(settings,seed,{groups,performance,recentFingerprints:recent,...categories,reviewAyahKeys}) }
  catch(error) { console.warn('[hifz generation]',error); throw new QuizInputError('لا تتوفر أسئلة موثوقة كافية لهذا النطاق. وسّع النطاق أو اختر اختبارًا مختلطًا أو عددًا أقل.') }
  return publicSession(await createSession(db,userId,randomUUID(),settings,seed,dailyDate,questions))
}
export async function quizHome(userId: string, timezone: string, offset=0) {
  try { new Intl.DateTimeFormat('en',{timeZone:timezone}) } catch { throw new QuizInputError('المنطقة الزمنية غير صحيحة.') }
  const db=quizAdmin()
  const [rows,performance,statsResult,personalResult]=await Promise.all([
    sessionRows(db,userId,offset),loadPerformance(db,userId),db.rpc('hifz_dashboard',{p_user:userId,p_timezone:timezone}),
    db.from('groups').select('id,title,completed').eq('user_id',userId).order('title').limit(1000),
  ])
  if(statsResult.error||personalResult.error) throw new QuizStorageError('تعذّر تحميل سجل الاختبارات. حاول مرة أخرى.')
  const stats=statsResult.data as {totalQuizzes:number;byType:CategoryStat[];bySurah:CategoryStat[];recentAccuracy:number;trend:Dashboard['trend']}
  const totalQuestions=performance.reduce((n,p)=>n+p.attempts,0)
  const correct=performance.reduce((n,p)=>n+p.correct,0)
  const typeAccuracy=(keys:string[])=>{
    const data=stats.byType.filter(t=>keys.includes(t.key));const n=data.reduce((n,t)=>n+t.attempts,0)
    return n?Math.round(100*data.reduce((n,t)=>n+t.correct,0)/n):null
  }
  const dashboard:Dashboard={
    sessions:rows.map(s=>({id:s.id,settings:s.settings,startedAt:s.started_at,completedAt:s.completed_at,questionCount:s.question_count,correct:s.correct_count,answered:s.correct_count+s.wrong_count,durationSeconds:s.duration_seconds})),
    totalQuizzes:stats.totalQuizzes,totalQuestions,accuracy:totalQuestions?Math.round(100*correct/totalQuestions):0,
    recentAccuracy:stats.recentAccuracy,mutashabihatAccuracy:typeAccuracy(['mutashabihat','difference']),transitionAccuracy:typeAccuracy(['transition']),
    byType:stats.byType,bySurah:stats.bySurah,trend:stats.trend,
    weakAyahs:performance.filter(p=>p.wrong>0).sort((a,b)=>weaknessScore(b)-weaknessScore(a)).slice(0,20),
  }
  return {dashboard,metadata:{surahs:Object.entries(getSurahNames()).map(([id,name])=>({id:Number(id),name})),groups:personalResult.data,hasStudied:personalResult.data?.some(g=>g.completed)},hasMore:rows.length===50}
}
