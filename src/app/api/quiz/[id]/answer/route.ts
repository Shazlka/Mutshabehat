import { authenticatedQuizUser, quizBody, quizError, quizJson } from '@/lib/quiz/http'
import { quizAdmin,saveAnswer } from '@/lib/quiz/repository'
import { publicSession } from '@/lib/quiz/presentation'
import { UUID,QuizInputError } from '@/lib/quiz/settings'
export async function POST(request:Request,context:{params:Promise<{id:string}>}) {
 try {
  const user=await authenticatedQuizUser(request);const {id}=await context.params;const b=await quizBody(request)
  if(!UUID.test(id)||!b||typeof b.questionId!=='string'||!UUID.test(b.questionId)||typeof b.choiceId!=='string'||b.choiceId.length>128||!Number.isInteger(b.responseTimeMs)||b.responseTimeMs<0||b.responseTimeMs>3600000) throw new QuizInputError('الإجابة غير صحيحة البنية.')
  return quizJson(publicSession(await saveAnswer(quizAdmin(),user,id,b.questionId,b.choiceId,b.responseTimeMs)))
 }catch(error){return quizError(error)}
}
