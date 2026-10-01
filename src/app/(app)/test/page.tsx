import QuizApp from '@/components/quiz/QuizApp'
import type { Scope } from '@/lib/quiz/types'
export default async function TestPage({searchParams}:{searchParams:Promise<{session?:string;surah?:string;page?:string;group?:string}>}) {
 const params=await searchParams
 let scope:Scope|undefined
 if(params.surah&&Number(params.surah)>=1&&Number(params.surah)<=114) scope={type:'surahs',surahIds:[Number(params.surah)]}
 else if(params.page&&Number(params.page)>=1&&Number(params.page)<=604) scope={type:'pages',from:Number(params.page),to:Number(params.page)}
 else if(params.group) scope={type:'group',groupId:params.group}
 return <QuizApp initialSessionId={params.session} initialScope={scope}/>
}
