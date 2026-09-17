import { normalizeArabic } from '../arabic'
import { weaknessScore } from './adaptive'
import { DIFFICULTY_CONFIG, QUIZ_CONFIG } from './config'
import { fullSpan, getAyah, getIdenticalAyahs, getSurahAyahs, scopeAyahs, sourceText, spanForTokens } from './corpus'
import type { CorpusAyah } from './corpus'
import { candidateAyahs, chooseTextChoices, phraseContinuations, seededRandom, shuffled, stableHash, stableUuid } from './distractors'
import { validateQuestion } from './validation'
import { QUESTION_TYPES } from './types'
import type { Choice, GenerationContext, PrivateQuestion, QuestionType, QuizSettings, SourceSpan } from './types'

export class InsufficientQuizMaterialError extends Error {
  readonly code = 'INSUFFICIENT_VALID_MATERIAL'
  constructor(public requested: number, public available: number) {
    super(`لا توجد مادة كافية لتكوين ${requested} سؤالًا صحيحًا ومختلفًا في هذا النطاق (المتاح ${available}). وسّع النطاق أو اختر أنواعًا مختلطة.`)
    this.name = 'InsufficientQuizMaterialError'
  }
}

const similarTypes: QuestionType[] = ['mutashabihat', 'difference']
const connectingTypes: QuestionType[] = ['transition', 'next_ayah', 'previous_ayah']

function makeQuestion(ayah: CorpusAyah, type: QuestionType, settings: QuizSettings, context: GenerationContext, allowed: Set<string>, random: () => number, seed: string): PrivateQuestion | null {
  const level = settings.difficulty
  const tuning = DIFFICULTY_CONFIG[level]
  const count = ayah.tokens.length
  if (count < 3 && !['surah', 'ayah_number', 'location', 'next_ayah', 'previous_ayah', 'transition'].includes(type)) return null
  const ref = `سورة ${ayah.surahName}، الآية ${ayah.ayahNumber}`
  const relatedGroups = context.groups.filter(g => g.ayahKeys.includes(ayah.key)).sort((a, b) =>
    Number(b.id === settings.scope.groupId) - Number(a.id === settings.scope.groupId)
    || Number(context.weakGroupIds?.includes(b.id) ?? false) - Number(context.weakGroupIds?.includes(a.id) ?? false)
    || Number(b.studied) - Number(a.studied))
  const preferred = new Set(relatedGroups.flatMap(g => g.ayahKeys))
  let spans: SourceSpan[] = []
  let correct: SourceSpan | undefined
  let prompt = ''
  let blank: PrivateQuestion['blank']
  let candidates: SourceSpan[] = []
  let metadataChoices: Choice[] | undefined
  let metadataCorrect: string | undefined
  let fingerprintDetail = ''

  if (['surah', 'ayah_number', 'location'].includes(type)) {
    const identical = getIdenticalAyahs(ayah)
    // Never offer an arbitrary "correct" location for text that occurs at several locations.
    if (type === 'surah' ? identical.some(a => a.surahId !== ayah.surahId) : type === 'ayah_number' ? identical.some(a => a.surahId === ayah.surahId && a.key !== ayah.key) : identical.length > 1) return null
    spans = [fullSpan(ayah)]
    const distractors = candidateAyahs(ayah, context.groups, random)
    let options: Array<{ text: string; reference: string }> = []
    let answerText: string
    if (type === 'surah') {
      prompt = 'في أي سورة وردت هذه الآية؟'
      answerText = ayah.surahName
      options = distractors.filter(a => a.surahId !== ayah.surahId).map(a => ({ text: a.surahName, reference: String(a.surahId) }))
    } else if (type === 'ayah_number') {
      prompt = `ما رقم هذه الآية في سورة ${ayah.surahName}؟`
      answerText = String(ayah.ayahNumber)
      options = shuffled(getSurahAyahs(ayah.surahId), random).filter(a => a.key !== ayah.key)
        .sort((a, b) => Math.abs(a.ayahNumber - ayah.ayahNumber) - Math.abs(b.ayahNumber - ayah.ayahNumber))
        .map(a => ({ text: String(a.ayahNumber), reference: a.key }))
    } else {
      prompt = 'ما موضع هذه الآية؟'
      answerText = `${ayah.surahName} · ${ayah.ayahNumber}`
      options = distractors.filter(a => a.key !== ayah.key).map(a => ({ text: `${a.surahName} · ${a.ayahNumber}`, reference: a.key }))
    }
    const unique = [...new Map(options.map(o => [normalizeArabic(o.text), o])).values()].slice(0, 3)
    if (unique.length < 3) return null
    const answerReference = type === 'surah' ? String(ayah.surahId) : ayah.key
    metadataChoices = [{ text: answerText, reference: answerReference }, ...unique].map(o => ({ ...o, id: `c_${stableHash(`${seed}:${type}:${ayah.key}:${o.reference}`)}` }))
    metadataCorrect = metadataChoices[0].id
    metadataChoices = shuffled(metadataChoices, random)
  } else if (connectingTypes.includes(type)) {
    const direction = type === 'previous_ayah' ? -1 : 1
    const target = getAyah(`${ayah.surahId}:${ayah.ayahNumber + direction}`)
    if (!target || !allowed.has(target.key)) return null
    const n = Math.min(count, tuning.contextWords)
    spans = [type === 'previous_ayah' ? spanForTokens(ayah, 0, n) : spanForTokens(ayah, count - n, count)]
    const answerLength = Math.min(target.tokens.length, Math.max(3, tuning.answerWords))
    correct = spanForTokens(target, 0, answerLength)
    prompt = type === 'previous_ayah' ? `ما بداية الآية السابقة مباشرة لهذا المقطع؟ (${ref})` : type === 'transition' ? `اربط خاتمة الآية ببداية الآية التي تليها مباشرة (${ref})` : `ما بداية الآية التالية مباشرة؟ (${ref})`
    candidates = candidateAyahs(target, context.groups, random).filter(a => a.key !== target.key && a.tokens.length >= answerLength).map(a => spanForTokens(a, 0, answerLength))
    fingerprintDetail = target.key
  } else if (similarTypes.includes(type)) {
    // A genuine difference must follow an identical multiword phrase in several source ayahs.
    // Group counterparts rank first; the cached phrase index supplies authentic fallback variants.
    const cuts = shuffled(Array.from({ length: Math.max(0, count - 2) }, (_, i) => i + 2), random)
    let found = false
    for (const cut of cuts) {
      const answerLength = type === 'difference' ? 1 : Math.min(Math.max(2, tuning.answerWords), count - cut)
      for (const anchorLength of [5, 4, 3]) {
        if (cut < anchorLength) continue
        const options = phraseContinuations(ayah, cut, answerLength, anchorLength)
        if (new Set(options.map(o => normalizeArabic(sourceText(o)))).size < 4) continue
        correct = spanForTokens(ayah, cut, cut + answerLength)
        candidates = options
        const before = spanForTokens(ayah, Math.max(0, cut - tuning.contextWords), cut)
        spans = [before]
        if (type === 'difference') {
          const after = cut + 1 < count ? spanForTokens(ayah, cut + 1, Math.min(count, cut + 1 + tuning.contextWords)) : undefined
          blank = { before: sourceText(before), after: after ? sourceText(after) : '' }
          if (after) spans.push(after)
          prompt = `أي كلمة تميّز هذا الموضع من المواضع المتشابهة؟ (${ref})`
        } else prompt = `اختر تتمة هذا الموضع من التتمات المتشابهة (${ref})`
        fingerprintDetail = `${cut}:${answerLength}:${anchorLength}`
        found = true
        break
      }
      if (found) break
    }
    if (!found) return null
  } else {
    let from: number
    let to: number
    if (type === 'ayah_beginning') {
      from = 0
      to = Math.min(tuning.answerWords, count - 2)
      spans = [spanForTokens(ayah, to, Math.min(count, to + tuning.contextWords))]
      prompt = `ما بداية الآية التي يليها هذا المقطع؟ (${ref})`
    } else if (type === 'ayah_ending' || type === 'complete_ayah') {
      const n = type === 'complete_ayah' ? Math.max(tuning.answerWords, Math.ceil(count / 3)) : tuning.answerWords
      from = Math.max(2, count - n)
      to = count
      spans = [spanForTokens(ayah, Math.max(0, from - tuning.contextWords), from)]
      prompt = type === 'complete_ayah' ? `أكمل الآية إلى نهايتها (${ref})` : `اختر خاتمة الآية (${ref})`
    } else {
      from = 1 + Math.floor(random() * (count - 1))
      to = from + 1
      const before = spanForTokens(ayah, Math.max(0, from - tuning.contextWords), from)
      spans = [before]
      if (type === 'missing_word') {
        const after = to < count ? spanForTokens(ayah, to, Math.min(count, to + tuning.contextWords)) : undefined
        blank = { before: sourceText(before), after: after ? sourceText(after) : '' }
        if (after) spans.push(after)
        prompt = `ما الكلمة الناقصة في هذا الموضع؟ (${ref})`
      } else prompt = `ما الكلمة التالية مباشرة؟ (${ref})`
    }
    correct = spanForTokens(ayah, from, to)
    const n = to - from
    const phraseCandidates = [3, 2, 1].flatMap(anchor => phraseContinuations(ayah, from, n, anchor))
    const ordinary = candidateAyahs(ayah, context.groups, random).filter(a => a.tokens.length >= n).map(a => {
      const offset = type === 'ayah_beginning' ? 0 : type === 'ayah_ending' || type === 'complete_ayah' ? a.tokens.length - n : Math.floor(random() * (a.tokens.length - n + 1))
      return spanForTokens(a, offset, offset + n)
    })
    // At higher levels the candidate set is led by real alternative continuations.
    candidates = level >= 4 && new Set(phraseCandidates.map(s => normalizeArabic(sourceText(s)))).size >= 4 ? phraseCandidates : [...phraseCandidates, ...ordinary]
    fingerprintDetail = `${from}:${to}`
  }

  const fingerprint = `${type}:${ayah.key}:${fingerprintDetail}`
  const selected = metadataChoices && metadataCorrect ? { choices: metadataChoices, correctChoiceId: metadataCorrect } : correct ? chooseTextChoices(correct, candidates, level, random, `${seed}:${fingerprint}`, preferred) : null
  if (!selected) return null
  const target = correct ? getAyah(correct.ayahKey)! : ayah
  const comparisons = selected.choices.filter(c => c.source && c.id !== selected.correctChoiceId).map(c => {
    const source = getAyah(c.source!.ayahKey)!
    const start = source.tokens.findIndex(t => t.start === c.source!.start)
    const end = source.tokens.findIndex(t => t.end === c.source!.end)
    return { text: sourceText(spanForTokens(source, Math.max(0, start - 3), Math.min(source.tokens.length, end + 4))), ayahKey: source.key, surahName: source.surahName }
  })
  const question: PrivateQuestion = {
    id: stableUuid(`${seed}:${fingerprint}`), fingerprint, type, difficulty: level,
    ayahKey: ayah.key, surahId: ayah.surahId, ayahNumber: ayah.ayahNumber, surahName: ayah.surahName,
    prompt, context: blank ? '' : spans.map(sourceText).join('\n'), contextSpans: spans,
    ...selected, ...(blank ? { blank } : {}), ...(relatedGroups[0] ? { groupId: relatedGroups[0].id } : {}), page: ayah.page,
    explanation: `الصواب: «${selected.choices.find(c => c.id === selected.correctChoiceId)!.text}». سورة ${target.surahName}، الآية ${target.ayahNumber}.${similarTypes.includes(type) ? ' انتبه إلى اللفظ الذي يلي العبارة المشتركة، وقارنه بمواضع البدائل.' : ''}`, comparisons,
  }
  return validateQuestion(question) ? question : null
}

type Bucket = 'weak' | 'mutashabihat' | 'general' | 'strong' | 'transition'

/** Quotas are shuffled before delivery; rounding residual belongs to general practice. */
export function adaptiveSchedule(count: number, daily: boolean, random: () => number): Bucket[] {
  const weights: Partial<Record<Bucket, number>> = daily
    ? Object.fromEntries(Object.entries(QUIZ_CONFIG.daily).map(([key, value]) => [key, value / QUIZ_CONFIG.dailyCount]))
    : QUIZ_CONFIG.adaptive
  const slots = Object.entries(weights).flatMap(([bucket, weight]) => Array<Bucket>(Math.floor(count * weight)).fill(bucket as Bucket))
  while (slots.length < count) slots.push('general')
  return shuffled(slots, random)
}

/** Returns exactly count questions, or throws InsufficientQuizMaterialError. Recent history is
 * excluded first, then relaxed only when this scope cannot otherwise fill the requested session. */
export function generateQuiz(settings: QuizSettings, seed: string, context: GenerationContext): PrivateQuestion[] {
  if (!Number.isInteger(settings.count) || settings.count < 1 || settings.count > 100 || !DIFFICULTY_CONFIG[settings.difficulty] || ![...QUESTION_TYPES, 'mixed'].includes(settings.questionType)) throw new Error('Invalid quiz settings')
  const pool = scopeAyahs(settings.scope, context)
  if (!pool.length) throw new InsufficientQuizMaterialError(settings.count, 0)
  const allowed = new Set(pool.map(a => a.key))
  const rng = seededRandom(seed)
  const performances = new Map(context.performance.map(p => [p.ayahKey, p]))
  const now = context.now ?? Date.now()
  const weakGroups = new Set(context.groups.filter(g => context.weakGroupIds?.includes(g.id)).flatMap(g => g.ayahKeys))
  const weak = pool.filter(a => { const p = performances.get(a.key); return weakGroups.has(a.key) || (p && (p.wrong > 0 || weaknessScore(p, now) >= 0.5)) })
  const strong = pool.filter(a => { const p = performances.get(a.key); return p && p.attempts >= QUIZ_CONFIG.minimumAttempts && p.correct / p.attempts >= 0.85 })
  const groups = new Set(context.groups.flatMap(g => g.ayahKeys))
  const similar = pool.filter(a => groups.has(a.key))
  const slots = context.performance.length ? adaptiveSchedule(settings.count, settings.mode === 'daily', rng) : Array<Bucket>(settings.count).fill('general')
  const recent = new Set(context.recentFingerprints)
  const used = new Set<string>()
  const questions: PrivateQuestion[] = []
  // Each pool is shuffled once. Cycling permits multiple different loci from a small scope.
  const weakOrder = (weak.length ? weak : pool).map(ayah => {
    const performance = performances.get(ayah.key)
    const weight = (performance ? weaknessScore(performance, now) : 0.5) + (weakGroups.has(ayah.key) ? 0.5 : 0)
    return { ayah, priority: -Math.log(Math.max(Number.EPSILON, rng())) / Math.max(0.05, weight) }
  }).sort((a, b) => a.priority - b.priority).map(item => item.ayah)
  const pools = { general: shuffled(pool, rng), weak: weakOrder, strong: shuffled(strong.length ? strong : pool, rng), mutashabihat: shuffled(similar.length ? similar : pool, rng), transition: shuffled(pool, rng) }
  const cursors: Record<Bucket, number> = { general: 0, weak: 0, strong: 0, mutashabihat: 0, transition: 0 }
  const maximumAttempts = Math.max(500, Math.min(15000, pool.length * 25, settings.count * 150))
  for (const allowRecent of [false, true]) {
    for (let attempt = 0; attempt < maximumAttempts && questions.length < settings.count; attempt++) {
      let bucket = settings.mode === 'weak' ? 'weak' : settings.mode === 'mutashabihat' || settings.scope.type === 'studied_mutashabihat' ? 'mutashabihat' : slots[questions.length]
      // Sparse groups or weak history must not prevent filling valid material from the same scope.
      if (attempt > maximumAttempts / 2 && settings.mode !== 'mutashabihat' && settings.mode !== 'weak') bucket = 'general'
      const key = bucket as Bucket
      const ayah = pools[key][cursors[key]++ % pools[key].length]
      let types: readonly QuestionType[] = settings.questionType !== 'mixed' ? [settings.questionType] : key === 'mutashabihat' ? similarTypes : key === 'transition' ? connectingTypes : QUESTION_TYPES
      if (settings.mode === 'mutashabihat' || settings.scope.type === 'studied_mutashabihat') types = similarTypes
      // More frequent mistaken types get more draws without removing other question forms.
      const weightedTypes = types.flatMap(type => Array<QuestionType>(1 + Math.min(4, Math.max(0, Math.floor(context.weakTypes?.[type] ?? 0)))).fill(type))
      const type = weightedTypes[Math.floor(rng() * weightedTypes.length)]
      const question = makeQuestion(ayah, type, settings, context, allowed, rng, seed)
      if (!question || used.has(question.fingerprint) || (!allowRecent && recent.has(question.fingerprint))) continue
      questions.push(question)
      used.add(question.fingerprint)
    }
    if (questions.length === settings.count) return questions
    if (!recent.size) break
  }
  throw new InsufficientQuizMaterialError(settings.count, questions.length)
}
