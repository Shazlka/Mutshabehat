// Server-only quiz HTTP helpers
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { QuizInputError } from './settings'
import { QuizStorageError } from './repository'
export async function authenticatedQuizUser(request: Request) {
  if (request.method!=='GET') {
    const origin=request.headers.get('origin')
    if (origin) {
      try {
        const originUrl=new URL(origin)
        const reqUrl=new URL(request.url)
        const hostHeader=request.headers.get('host')
        const isLocal=(originUrl.hostname==='localhost'||originUrl.hostname==='127.0.0.1') &&
                      (reqUrl.hostname==='localhost'||reqUrl.hostname==='127.0.0.1')
        const hostMatches=hostHeader?originUrl.host===hostHeader:false
        const originMatches=originUrl.origin===reqUrl.origin
        if (!isLocal && !hostMatches && !originMatches) {
          throw new QuizStorageError('الطلب غير مسموح.',403)
        }
      } catch (e) {
        if (e instanceof QuizStorageError) throw e
        throw new QuizStorageError('الطلب غير مسموح.',403)
      }
    }
  }
  const db=await createServerSupabaseClient()
  // A service-role repository must never trust the locally decoded session cookie.
  const {data:{user},error}=await db.auth.getUser()
  if(error||!user) throw new QuizStorageError('تعذّر التحقق من الجلسة. أعد تحميل الصفحة.',401)
  return user.id
}
export function quizJson(value:unknown,status=200) { return Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}}) }
export function quizError(error:unknown) {
  if(error instanceof QuizInputError||error instanceof QuizStorageError) return quizJson({error:error.message},error.status)
  console.error('[hifz API]',error)
  return quizJson({error:'حدث خطأ أثناء تحميل الاختبار. حاول مرة أخرى.'},500)
}
export async function quizBody(request:Request) {
  if(Number(request.headers.get('content-length')??0)>16_384) throw new QuizInputError('الطلب أكبر من المسموح.')
  const text=await request.text()
  if(text.length>16_384) throw new QuizInputError('الطلب أكبر من المسموح.')
  try{return JSON.parse(text)}catch{throw new QuizInputError('الطلب غير صحيح.')}
}
