import test from 'node:test'
import assert from 'node:assert/strict'
import { adaptiveDifficulty, weaknessScore } from '../../src/lib/quiz/adaptive'
import { summarizeSession } from '../../src/lib/quiz/analytics'
import { getAyah, getCorpus, HIZB_START_KEYS, scopeAyahs, sourceText } from '../../src/lib/quiz/corpus'
import { seededRandom } from '../../src/lib/quiz/distractors'
import { adaptiveSchedule, generateQuiz, InsufficientQuizMaterialError } from '../../src/lib/quiz/generator'
import { validateQuestion } from '../../src/lib/quiz/validation'
import { normalizeArabic } from '../../src/lib/arabic'
import { JUZ_STARTS } from '../../src/lib/juz'
import { QUESTION_TYPES } from '../../src/lib/quiz/types'
import type { Difficulty, GenerationContext, Performance, QuizSettings, Scope, Session } from '../../src/lib/quiz/types'

const now = Date.parse('2026-09-17T12:00:00Z')
const empty: GenerationContext = { groups: [], performance: [], recentFingerprints: [], now }
const settings: QuizSettings = { mode: 'custom', difficulty: 4, count: 10, scope: { type: 'surahs', surahIds: [10] }, questionType: 'mixed', timer: 'none', timezone: 'Asia/Dubai' }
const run = (overrides: Partial<QuizSettings> = {}, seed = 'engine-test', context = empty) => generateQuiz({ ...settings, ...overrides }, seed, context)

test('authoritative corpus is complete, exact juz/hizb boundaries match and intra-page transitions are preserved', () => {
  assert.equal(getCorpus().length, 6236)
  assert.equal(HIZB_START_KEYS.length, 60)
  for (const [index, key] of HIZB_START_KEYS.entries()) {
    const ayah = getAyah(key)!
    assert.equal(ayah.hizb, index + 1)
    if (index) assert.equal(getCorpus()[ayah.ordinal - 1].hizb, index)
    if (index % 2 === 0) assert.equal(key, `${JUZ_STARTS[index / 2].surah}:${JUZ_STARTS[index / 2].ayah}`)
  }
  const internal = HIZB_START_KEYS.map(getAyah).find(a => a && a.ordinal > 0 && getCorpus()[a.ordinal - 1].page === a.page)!
  assert.ok(internal)
  assert.notEqual(getCorpus()[internal.ordinal - 1].hizb, internal.hizb)
  assert.equal(getAyah('10:25')?.hizb, 21)
  assert.equal(getAyah('10:26')?.hizb, 22)
})

for (const type of QUESTION_TYPES) for (const difficulty of [1, 2, 3, 4, 5] as Difficulty[]) {
  test(`Yunus: ${type}, level ${difficulty}, authentic and unique four-choice questions`, () => {
    const questions = run({ questionType: type, difficulty })
    assert.equal(questions.length, 10)
    assert.equal(new Set(questions.map(q => q.fingerprint)).size, questions.length)
    for (const q of questions) {
      assert.equal(q.type, type)
      assert.equal(q.difficulty, difficulty)
      assert.equal(q.surahId, 10)
      assert.ok(validateQuestion(q))
      assert.match(q.id, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/)
      assert.equal(new Set(q.choices.map(c => normalizeArabic(c.text))).size, 4)
      assert.equal(q.choices.filter(c => c.id === q.correctChoiceId).length, 1)
      for (const c of q.choices) if (c.source) assert.equal(c.text, sourceText(c.source))
      for (const span of q.contextSpans) assert.ok(getAyah(span.ayahKey)!.text.includes(sourceText(span)))
    }
  })
}

test('same seed reproduces complete questions and different seeds spread the answer across all four positions', () => {
  assert.deepEqual(run(), run())
  const positions = new Set<number>()
  for (let i = 0; i < 20; i++) for (const q of run({}, `shuffle-${i}`)) positions.add(q.choices.findIndex(c => c.id === q.correctChoiceId))
  assert.deepEqual([...positions].sort(), [0, 1, 2, 3])
})

test('all supported session sizes are filled, including one hundred questions without duplicate loci', () => {
  for (const count of [10, 20, 30, 50, 100]) {
    const questions = run({ count })
    assert.equal(questions.length, count)
    assert.equal(new Set(questions.map(q => q.fingerprint)).size, count)
  }
})

test('number distractors are nearby, and repeated identical text cannot get an arbitrary location', () => {
  for (const q of run({ questionType: 'ayah_number' })) {
    for (const c of q.choices) assert.ok(Math.abs(Number(c.text) - q.ayahNumber) <= 3)
  }
  // This exact verse recurs many times within Ar-Rahman.
  assert.throws(() => run({ count: 1, questionType: 'ayah_number', scope: { type: 'ayah_range', surahIds: [55], from: 13, to: 13 } }), InsufficientQuizMaterialError)
  assert.throws(() => run({ count: 1, questionType: 'location', scope: { type: 'ayah_range', surahIds: [55], from: 13, to: 13 } }), InsufficientQuizMaterialError)
})

test('validation rejects forged Quran text, wrong key, duplicate choices and exposed missing answer', () => {
  const question = run({ questionType: 'missing_word' })[0]
  const forged = structuredClone(question)
  forged.choices[0].text += 'ا'
  assert.equal(validateQuestion(forged), false)
  const wrongKey = structuredClone(question)
  wrongKey.correctChoiceId = wrongKey.choices.find(c => c.id !== question.correctChoiceId)!.id
  assert.equal(validateQuestion(wrongKey), false)
  const duplicated = structuredClone(question)
  duplicated.choices[1].text = duplicated.choices[0].text
  assert.equal(validateQuestion(duplicated), false)
  const exposed = structuredClone(question)
  exposed.blank!.before = getAyah(question.ayahKey)!.text
  assert.equal(validateQuestion(exposed), false)
})

test('next/previous never cross a surah or the requested target scope', () => {
  for (const questionType of ['next_ayah', 'previous_ayah', 'transition'] as const) {
    const questions = run({ questionType, scope: { type: 'ayah_range', surahIds: [10], from: 20, to: 40 } })
    for (const q of questions) {
      const answer = q.choices.find(c => c.id === q.correctChoiceId)!
      const target = getAyah(answer.source!.ayahKey)!
      assert.equal(target.surahId, 10)
      assert.ok(target.ayahNumber >= 20 && target.ayahNumber <= 40)
      assert.equal(target.ayahNumber - q.ayahNumber, questionType === 'previous_ayah' ? -1 : 1)
    }
  }
  assert.throws(() => run({ count: 1, questionType: 'next_ayah', scope: { type: 'ayah_range', surahIds: [10], from: 109, to: 109 } }), InsufficientQuizMaterialError)
  assert.throws(() => run({ count: 1, questionType: 'previous_ayah', scope: { type: 'ayah_range', surahIds: [10], from: 1, to: 1 } }), InsufficientQuizMaterialError)
})

test('all supported scopes use exact metadata and studied membership', () => {
  const context: GenerationContext = { ...empty, groups: [{ id: 'studied', title: '', ayahKeys: ['10:5', '10:6', '10:7'], studied: true }, { id: 'unread', title: '', ayahKeys: ['10:20'], studied: false }] }
  const cases: Array<[Scope, (key: string) => boolean]> = [
    [{ type: 'all' }, () => true],
    [{ type: 'surahs', surahIds: [10] }, k => k.startsWith('10:')],
    [{ type: 'juz', from: 11, to: 11 }, k => getAyah(k)!.juz === 11],
    [{ type: 'hizb', from: 22, to: 22 }, k => getAyah(k)!.hizb === 22],
    [{ type: 'pages', from: 208, to: 210 }, k => getAyah(k)!.page >= 208 && getAyah(k)!.page <= 210],
    [{ type: 'ayah_range', surahIds: [10], from: 5, to: 7 }, k => ['10:5', '10:6', '10:7'].includes(k)],
    [{ type: 'studied' }, k => ['10:5', '10:6', '10:7'].includes(k)],
    [{ type: 'studied_mutashabihat' }, k => ['10:5', '10:6', '10:7'].includes(k)],
    [{ type: 'group', groupId: 'unread' }, k => k === '10:20'],
  ]
  for (const [scope, check] of cases) {
    const selected = scopeAyahs(scope, context)
    assert.ok(selected.length)
    assert.ok(selected.every(a => check(a.key)))
  }
  assert.equal(scopeAyahs({ type: 'studied' }, empty).length, 0)
  assert.throws(() => run({ scope: { type: 'studied' } }), InsufficientQuizMaterialError)
})

test('recent questions are avoided, history relaxes only for insufficient material, session questions stay unique', () => {
  const first = run({ questionType: 'surah' })
  const second = run({ questionType: 'surah' }, 'fresh', { ...empty, recentFingerprints: first.map(q => q.fingerprint) })
  assert.ok(second.every(q => !first.some(p => p.fingerprint === q.fingerprint)))
  const oneScope: Partial<QuizSettings> = { count: 1, questionType: 'surah', scope: { type: 'ayah_range', surahIds: [10], from: 5, to: 5 } }
  const one = run(oneScope)
  const fallback = run(oneScope, 'fallback', { ...empty, recentFingerprints: one.map(q => q.fingerprint) })
  assert.equal(fallback[0].fingerprint, one[0].fingerprint)
  assert.throws(() => run({ ...oneScope, count: 2 }), InsufficientQuizMaterialError)
})

test('similar questions use real shared-phrase alternatives, and known group variants are preferred', () => {
  const first = run({ questionType: 'difference', count: 1 })[0]
  const partner = first.choices.find(c => c.id !== first.correctChoiceId)!.source!.ayahKey
  const context: GenerationContext = { ...empty, groups: [{ id: 'real-group', title: 'مقارنة', ayahKeys: [first.ayahKey, partner], studied: true }] }
  const similar = run({ count: 1, questionType: 'difference', scope: { type: 'group', groupId: 'real-group' } }, 'engine-test', context)
  assert.equal(similar[0].groupId, 'real-group')
  assert.ok(similar[0].comparisons.length === 3)
  for (const q of run({ questionType: 'mutashabihat' })) assert.ok(validateQuestion(q))
})

test('adaptive quotas, weakness, minimum-sample difficulty and active-time score are deterministic', () => {
  const schedule = adaptiveSchedule(100, false, seededRandom('weights'))
  for (const [bucket, expected] of Object.entries({ weak: 40, mutashabihat: 30, general: 20, strong: 10 })) assert.equal(schedule.filter(s => s === bucket).length, expected)
  const daily = adaptiveSchedule(20, true, seededRandom('daily'))
  for (const [bucket, expected] of Object.entries({ weak: 8, mutashabihat: 5, transition: 4, general: 3 })) assert.equal(daily.filter(s => s === bucket).length, expected)
  const mastered: Performance = { ayahKey: '10:5', attempts: 10, correct: 10, wrong: 0, averageResponseMs: 1000, lastSeen: new Date(now).toISOString(), lastWrong: null, streak: 10 }
  const weak: Performance = { ...mastered, correct: 2, wrong: 8, averageResponseMs: 30000, lastSeen: '2026-08-01', lastWrong: '2026-08-01', streak: 0 }
  assert.ok(weaknessScore(weak, now) > weaknessScore(mastered, now))
  assert.equal(adaptiveDifficulty([{ ...mastered, attempts: 1, correct: 1 }]), 2)
  assert.equal(adaptiveDifficulty([mastered]), 5)
  assert.equal(adaptiveDifficulty([weak]), 1)
  const questions = run()
  const session: Session = { id: 'test', settings, seed: 'test', startedAt: '2026-09-17T01:00:00Z', completedAt: '2026-09-17T05:00:00Z', dailyDate: null, questions,
    answers: questions.map((q, i) => ({ questionId: q.id, selectedChoiceId: q.choices[0].id, correctChoiceId: q.correctChoiceId, isCorrect: i < 7, responseTimeMs: 2000, answeredAt: '2026-09-17', explanation: '', comparisons: [], errorCategory: i < 7 ? null : q.type })) }
  const summary = summarizeSession(session)
  assert.equal(summary.total, 10)
  assert.equal(summary.correct, 7)
  assert.equal(summary.wrong, 3)
  assert.equal(summary.percentage, 70)
  assert.equal(summary.durationSeconds, 20)
  assert.equal(summary.averageResponseMs, 2000)
})
