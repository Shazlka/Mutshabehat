import { authenticatedQuizUser, quizBody, quizError, quizJson } from '@/lib/quiz/http'
import { quizHome, startQuiz } from '@/lib/quiz/service'
export const runtime='nodejs'
export async function GET(request:Request) {
  try {
    const user=await authenticatedQuizUser(request);const url=new URL(request.url)
    const offset=Math.max(0,Math.min(100000,Number(url.searchParams.get('offset'))||0))
    return quizJson(await quizHome(user,url.searchParams.get('timezone')||'UTC',Math.floor(offset)))
  }catch(error){return quizError(error)}
}
export async function POST(request:Request) {
  try {return quizJson(await startQuiz(await authenticatedQuizUser(request),await quizBody(request)))}catch(error){return quizError(error)}
}
