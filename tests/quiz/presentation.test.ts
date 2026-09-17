import test from 'node:test'
import assert from 'node:assert/strict'
import { publicSession } from '@/lib/quiz/presentation'
import type { StoredSession } from '@/lib/quiz/types'

test('publicSession strips correctChoiceId and choice source metadata', () => {
  const stored: StoredSession = {
    id: '11111111-1111-1111-1111-111111111111',
    userId: '22222222-2222-2222-2222-222222222222',
    settings: { mode: 'quick', difficulty: 2, count: 1, scope: { type: 'all' }, questionType: 'mixed', timer: 'none', timezone: 'UTC' },
    seed: 'secret-seed',
    startedAt: '2026-09-17T20:00:00Z',
    completedAt: null,
    dailyDate: null,
    questions: [
      {
        id: 'q1',
        fingerprint: 'fp-secret',
        type: 'complete_ayah',
        difficulty: 2,
        ayahKey: '10:1',
        surahId: 10,
        ayahNumber: 1,
        surahName: 'يونس',
        prompt: 'أكمل الآية',
        context: 'الر تِلْكَ آيَاتُ الْكِتَابِ الْحَكِيمِ',
        contextSpans: [],
        correctChoiceId: 'c1',
        explanation: 'الآية الأولى من سورة يونس',
        comparisons: [],
        choices: [
          { id: 'c1', text: 'الر تِلْكَ آيَاتُ الْكِتَابِ الْحَكِيمِ', source: { ayahKey: '10:1', start: 0, end: 10 } },
          { id: 'c2', text: 'طسم تِلْكَ آيَاتُ الْكِتَابِ الْمُبِينِ', source: { ayahKey: '26:2', start: 0, end: 10 } },
          { id: 'c3', text: 'المر تِلْكَ آيَاتُ الْكِتَابِ', source: { ayahKey: '13:1', start: 0, end: 10 } },
          { id: 'c4', text: 'حم وَالْكِتَابِ الْمُبِينِ', source: { ayahKey: '43:1', start: 0, end: 10 } },
        ],
        page: 208,
      },
    ],
    answers: [],
  }

  const pub = publicSession(stored)
  assert.equal(pub.seed, '')
  assert.equal(pub.questions[0].fingerprint, '')
  assert.equal('correctChoiceId' in pub.questions[0], false)
  assert.equal('source' in pub.questions[0].choices[0], false)
  assert.equal(pub.questions[0].ayahKey, '10:1')
  assert.equal(pub.questions[0].surahName, 'يونس')
})

test('publicSession hides surah/ayah identification before answer and reveals after answer', () => {
  const stored: StoredSession = {
    id: '11111111-1111-1111-1111-111111111111',
    userId: '22222222-2222-2222-2222-222222222222',
    settings: { mode: 'quick', difficulty: 2, count: 1, scope: { type: 'all' }, questionType: 'surah', timer: 'none', timezone: 'UTC' },
    seed: 'secret-seed',
    startedAt: '2026-09-17T20:00:00Z',
    completedAt: null,
    dailyDate: null,
    questions: [
      {
        id: 'q-surah',
        fingerprint: 'fp-surah',
        type: 'surah',
        difficulty: 2,
        ayahKey: '10:33',
        surahId: 10,
        ayahNumber: 33,
        surahName: 'يونس',
        prompt: 'في أي سورة وردت هذه الآية؟',
        context: 'كَذَلِكَ حَقَّتْ كَلِمَتُ رَبِّكَ عَلَى الَّذِينَ فَسَقُوا أَنَّهُمْ لَا يُؤْمِنُونَ',
        contextSpans: [],
        correctChoiceId: 'c-yunus',
        explanation: 'سورة يونس الآية 33',
        comparisons: [],
        choices: [
          { id: 'c-yunus', text: 'يونس' },
          { id: 'c-hud', text: 'هود' },
          { id: 'c-yusuf', text: 'يوسف' },
          { id: 'c-raaad', text: 'الرعد' },
        ],
        page: 212,
      },
    ],
    answers: [],
  }

  // Before answering: identification fields are hidden so the user cannot see the answer in props
  const beforeAnswer = publicSession(stored)
  assert.equal(beforeAnswer.questions[0].surahName, '')
  assert.equal(beforeAnswer.questions[0].surahId, 0)
  assert.equal(beforeAnswer.questions[0].ayahKey, '')
  assert.equal(beforeAnswer.questions[0].ayahNumber, 0)
  assert.equal(beforeAnswer.questions[0].page, null)

  // After answering: identification fields are revealed for review
  stored.answers.push({
    questionId: 'q-surah',
    selectedChoiceId: 'c-yunus',
    correctChoiceId: 'c-yunus',
    isCorrect: true,
    responseTimeMs: 2500,
    answeredAt: '2026-09-17T20:00:03Z',
    explanation: 'سورة يونس · الآية 33',
    comparisons: [],
    errorCategory: null,
  })

  const afterAnswer = publicSession(stored)
  assert.equal(afterAnswer.questions[0].surahName, 'يونس')
  assert.equal(afterAnswer.questions[0].surahId, 10)
  assert.equal(afterAnswer.questions[0].ayahKey, '10:33')
  assert.equal(afterAnswer.questions[0].ayahNumber, 33)
  assert.equal(afterAnswer.questions[0].page, 212)
})
