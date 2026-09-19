import { QUIZ_CONFIG } from './config'
import type { Difficulty, Performance } from './types'

/** 0..1, deterministic at a supplied time. Low sample counts never imply mastery. */
export function weaknessScore(p: Performance, now = Date.now()): number {
  if (!p.attempts) return 0.5
  const w = QUIZ_CONFIG.weakness
  const age = Math.max(0, now - Date.parse(p.lastSeen)) / 86400000
  const error = p.wrong / p.attempts
  const slow = Math.min(1, p.averageResponseMs / QUIZ_CONFIG.slowResponseMs)
  const repeated = Math.min(1, p.wrong / QUIZ_CONFIG.minimumAttempts)
  const unmastered = 1 - Math.min(1, p.streak / QUIZ_CONFIG.minimumAttempts)
  return Math.max(0, Math.min(1, error * w.error + Math.min(1, (Number.isFinite(age) ? age : 0) / QUIZ_CONFIG.staleDays) * w.recency + slow * w.slow + repeated * w.repeatedConfusion + unmastered * w.mastery))
}

export function adaptiveDifficulty(performance: Performance[]): Difficulty {
  const eligible = performance.filter(p => p.attempts >= QUIZ_CONFIG.minimumAttempts)
  if (!eligible.length) return 2
  const attempts = eligible.reduce((n, p) => n + p.attempts, 0)
  const accuracy = eligible.reduce((n, p) => n + p.correct, 0) / attempts
  return accuracy >= 0.95 ? 5 : accuracy >= 0.85 ? 4 : accuracy >= 0.7 ? 3 : accuracy >= 0.5 ? 2 : 1
}

export function rankWeakAyahs(performance: Performance[], now = Date.now()): Performance[] {
  return [...performance].sort((a, b) => weaknessScore(b, now) - weaknessScore(a, now) || a.ayahKey.localeCompare(b.ayahKey))
}
