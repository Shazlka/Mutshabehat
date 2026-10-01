import type { Difficulty, QuestionType } from './types'

/** All pedagogical tuning lives here; probabilities are proportions, times milliseconds. */
export const QUIZ_CONFIG = {
  choices: 4,
  questionCounts: [10, 20, 30, 50, 100],
  quickCount: 10,
  dailyCount: 20,
  recentSessionCount: 3,
  minimumAttempts: 5,
  adaptive: { weak: 0.4, mutashabihat: 0.3, general: 0.2, strong: 0.1 },
  daily: { weak: 8, mutashabihat: 5, transition: 4, general: 3 },
  weakness: { error: 0.4, recency: 0.2, slow: 0.15, repeatedConfusion: 0.15, mastery: 0.1 },
  slowResponseMs: 20000,
  staleDays: 30,
} as const

export const DIFFICULTY_CONFIG: Record<Difficulty, { contextWords: number; answerWords: number; similarWeight: number }> = {
  1: { contextWords: 14, answerWords: 5, similarWeight: 0.2 },
  2: { contextWords: 10, answerWords: 4, similarWeight: 0.4 },
  3: { contextWords: 7, answerWords: 3, similarWeight: 0.65 },
  4: { contextWords: 5, answerWords: 2, similarWeight: 0.9 },
  5: { contextWords: 3, answerWords: 1, similarWeight: 1 },
}

export const QUESTION_LABELS: Record<QuestionType, string> = {
  complete_ayah: 'إكمال الآية', missing_word: 'الكلمة الناقصة', next_word: 'الكلمة التالية',
  ayah_ending: 'خاتمة الآية', ayah_beginning: 'بداية الآية', next_ayah: 'الآية التالية',
  previous_ayah: 'الآية السابقة', transition: 'الربط بين الآيات', surah: 'اسم السورة',
  ayah_number: 'رقم الآية', location: 'موضع الآية', mutashabihat: 'المتشابهات', difference: 'تمييز الفروق',
}
