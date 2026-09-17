import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { quizAdmin, createSession, readSession, saveAnswer, loadPerformance } from '@/lib/quiz/repository'
import type { PrivateQuestion, QuizSettings } from '@/lib/quiz/types'

// Test user ID for isolated tests
const TEST_USER_ID = 'ec34e9cc-7c98-4180-86ce-2b80ac34646e' // autologin user ID

test('database repository: createSession, readSession, saveAnswer, and performance tracking', async (t) => {
  let db: ReturnType<typeof quizAdmin>
  try {
    db = quizAdmin()
  } catch (err) {
    t.skip(`Skipping database test: quizAdmin not configured (${(err as Error).message})`)
    return
  }

  // Quick connectivity check
  const { error: pingError } = await db.from('quiz_sessions').select('id').limit(1)
  if (pingError) {
    t.skip(`Skipping database test: database unreachable (${pingError.message})`)
    return
  }

  const sessionId = randomUUID()
  const q1Id = randomUUID()
  const q2Id = randomUUID()

  const settings: QuizSettings = {
    mode: 'quick',
    difficulty: 2,
    count: 2,
    scope: { type: 'surahs', surahIds: [10] },
    questionType: 'complete_ayah',
    timer: 'none',
    timezone: 'UTC',
  }

  const questions: PrivateQuestion[] = [
    {
      id: q1Id,
      fingerprint: `fp-test-${sessionId}-1`,
      type: 'complete_ayah',
      difficulty: 2,
      ayahKey: '10:1',
      surahId: 10,
      ayahNumber: 1,
      surahName: 'يونس',
      prompt: 'أكمل الآية الأولى من سورة يونس',
      context: 'الر تِلْكَ آيَاتُ الْكِتَابِ الْحَكِيمِ',
      contextSpans: [],
      correctChoiceId: 'c1-1',
      explanation: 'الآية الأولى من سورة يونس',
      comparisons: [],
      choices: [
        { id: 'c1-1', text: 'الر تِلْكَ آيَاتُ الْكِتَابِ الْحَكِيمِ' },
        { id: 'c1-2', text: 'طسم تِلْكَ آيَاتُ الْكِتَابِ الْمُبِينِ' },
        { id: 'c1-3', text: 'المر تِلْكَ آيَاتُ الْكِتَابِ' },
        { id: 'c1-4', text: 'حم وَالْكِتَابِ الْمُبِينِ' },
      ],
      page: 208,
    },
    {
      id: q2Id,
      fingerprint: `fp-test-${sessionId}-2`,
      type: 'complete_ayah',
      difficulty: 2,
      ayahKey: '10:2',
      surahId: 10,
      ayahNumber: 2,
      surahName: 'يونس',
      prompt: 'أكمل الآية الثانية من سورة يونس',
      context: 'أَكَانَ لِلنَّاسِ عَجَبًا',
      contextSpans: [],
      correctChoiceId: 'c2-2',
      explanation: 'الآية الثانية من سورة يونس',
      comparisons: [],
      choices: [
        { id: 'c2-1', text: 'أَن جَاءَهُم مَّنذِرٌ مِّنْهُمْ' },
        { id: 'c2-2', text: 'أَنْ أَوْحَيْنَا إِلَىٰ رَجُلٍ مِّنْهُمْ أَنْ أَنذِرِ النَّاسَ' },
        { id: 'c2-3', text: 'إِذْ جَاءَتْهُمُ الرُّسُلُ مِن بَيْنِ أَيْدِيهِمْ' },
        { id: 'c2-4', text: 'أَنَّ اللَّهَ يَأْمُرُكُمْ أَن تَذْبَحُوا بَقَرَةً' },
      ],
      page: 208,
    },
  ]

  // 1. Create Session
  const created = await createSession(db, TEST_USER_ID, sessionId, settings, 'test-seed-123', null, questions)
  assert.equal(created.id, sessionId)
  assert.equal(created.questions.length, 2)
  assert.equal(created.answers.length, 0)
  assert.equal(created.completedAt, null)

  // 2. Read Session
  const loaded = await readSession(db, TEST_USER_ID, sessionId)
  assert.equal(loaded.id, sessionId)
  assert.equal(loaded.questions.length, 2)

  // 3. Save first answer (Correct)
  const afterQ1 = await saveAnswer(db, TEST_USER_ID, sessionId, q1Id, 'c1-1', 2000)
  assert.equal(afterQ1.answers.length, 1)
  assert.equal(afterQ1.answers[0].isCorrect, true)
  assert.equal(afterQ1.answers[0].questionId, q1Id)
  assert.equal(afterQ1.completedAt, null)

  // 4. Idempotent re-answer of same choice succeeds
  const reAnswer = await saveAnswer(db, TEST_USER_ID, sessionId, q1Id, 'c1-1', 2000)
  assert.equal(reAnswer.answers.length, 1)

  // 5. Out of order answer rejection
  await assert.rejects(
    async () => {
      // Try to answer q1 again with a different choice
      await saveAnswer(db, TEST_USER_ID, sessionId, q1Id, 'c1-2', 2000)
    },
    { message: /حُفظت الإجابة بالفعل أو تغيّر ترتيب الأسئلة/ }
  )

  // 6. Save second and final answer (Incorrect)
  const afterQ2 = await saveAnswer(db, TEST_USER_ID, sessionId, q2Id, 'c2-1', 3500)
  assert.equal(afterQ2.answers.length, 2)
  assert.equal(afterQ2.answers[1].isCorrect, false)
  assert.notEqual(afterQ2.completedAt, null) // Quiz completed!

  // 7. Verify performance tracking
  const perfs = await loadPerformance(db, TEST_USER_ID)
  const p1 = perfs.find((p) => p.ayahKey === '10:1')
  assert.ok(p1, 'Performance for 10:1 should be tracked')
  assert.ok(p1.correct >= 1)
})
