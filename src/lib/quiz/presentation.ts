import type { Session, StoredSession } from './types'
/** Deliberately whitelist public fields. Source references can reveal which option belongs to the target. */
export function publicSession(stored: StoredSession): Session {
  return {
    id: stored.id, settings: stored.settings, seed: '', startedAt: stored.startedAt,
    completedAt: stored.completedAt, dailyDate: stored.dailyDate, answers: stored.answers,
    questions: stored.questions.map(q => {
      const reveal = stored.answers.some(a => a.questionId === q.id) || !['surah','ayah_number','location'].includes(q.type)
      return ({ id:q.id,fingerprint:'',type:q.type,difficulty:q.difficulty,
      ayahKey:reveal?q.ayahKey:'',surahId:reveal?q.surahId:0,ayahNumber:reveal?q.ayahNumber:0,surahName:reveal?q.surahName:'',
      prompt:q.prompt,context:q.context,contextSpans:[],choices:q.choices.map(c=>({id:c.id,text:c.text})),
      ...(q.groupId?{groupId:q.groupId}:{}),page:reveal?q.page:null,...(q.blank?{blank:q.blank}:{}),
    })}),
  }
}
