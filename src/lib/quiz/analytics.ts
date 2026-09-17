import type { Answer, CategoryStat, Question, QuizSummary, Session } from './types'

export function categoryStats(questions: Question[], answers: Answer[], category: 'type' | 'surahId'): CategoryStat[] {
  const byId = new Map(questions.map(q => [q.id, q]))
  const groups = new Map<string, { attempts: number; correct: number }>()
  const seen = new Set<string>()
  for (const answer of answers) {
    const question = byId.get(answer.questionId)
    if (!question || seen.has(answer.questionId)) continue
    seen.add(answer.questionId)
    const key = String(question[category])
    const stat = groups.get(key) ?? { attempts: 0, correct: 0 }
    stat.attempts++
    stat.correct += Number(answer.isCorrect)
    groups.set(key, stat)
  }
  return [...groups].map(([key, stat]) => ({ key, ...stat, accuracy: Math.round(100 * stat.correct / stat.attempts) }))
}

export function summarizeSession(session: Session): QuizSummary {
  const ids = new Set(session.questions.map(q => q.id))
  const answers = [...new Map(session.answers.filter(a => ids.has(a.questionId)).map(a => [a.questionId, a])).values()]
  const correct = answers.filter(a => a.isCorrect).length
  const total = session.questions.length
  // Active answering time, matching quiz_sessions.duration_seconds; time away is excluded.
  const duration = answers.reduce((n, a) => n + a.responseTimeMs, 0)
  return { total, correct, wrong: answers.length - correct, percentage: total ? Math.round(100 * correct / total) : 0,
    durationSeconds: Math.max(0, Math.round(duration / 1000)) || 0,
    averageResponseMs: answers.length ? Math.round(answers.reduce((n, a) => n + a.responseTimeMs, 0) / answers.length) : 0,
    byType: categoryStats(session.questions, answers, 'type'), bySurah: categoryStats(session.questions, answers, 'surahId') }
}
