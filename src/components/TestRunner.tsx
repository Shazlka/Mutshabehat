'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ArabicDiff, { type Part } from './ArabicDiff'
import { ayahToArabic } from '@/lib/arabic'
import { cn } from '@/lib/cn'
import { locationKey, sameWording, verseText, type TestQuestion, type TestVerse } from '@/lib/test-questions'

type Answer = { questionId: string; correct: boolean }

interface Props {
  questions: TestQuestion[]
  settingsHref: string
}

const BLANK_TEXT = '٭ ٭ ٭'

// Plain parts (no colour coding) so the prompt doesn't give the answer away.
function plainParts(verse: TestVerse): Part[] {
  return verse.parts.map((part) => ({ type: 'normal', text: part.text })) as Part[]
}

// The words prompt: plain text with the hidden part replaced (or revealed in the answer colour).
function blankedParts(question: TestQuestion, revealed: boolean): Part[] {
  return question.verse.parts.map((part, index) =>
    index === question.blankIndex
      ? { type: revealed ? 'diff' : 'blank', text: revealed ? part.text : BLANK_TEXT }
      : { type: 'normal', text: part.text },
  ) as Part[]
}

function Location({ verse, surahOnly, className }: { verse: { surah: string; ayah: number }; surahOnly?: boolean; className?: string }) {
  return (
    <span className={className}>
      سورة {verse.surah}
      {surahOnly ? null : <> · آية <span className="tabular-nums">{ayahToArabic(verse.ayah)}</span></>}
    </span>
  )
}

// Fire-and-forget: the statistics tab counts every answered question.
function saveAnswer(question: TestQuestion, correct: boolean) {
  void fetch('/api/test/answers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({
      source: question.source,
      kind: question.kind,
      correct,
      surah: question.verse.surah,
      ayah: question.verse.ayah,
      groupId: question.groupId,
    }),
  }).catch(() => {})
}

function choiceClass(answered: boolean, isAnswer: boolean, isChosen: boolean) {
  return cn(
    'min-h-[52px] px-4 py-3 rounded-xl border text-[14px] font-bold text-right tap-shrink transition-colors',
    !answered && 'bg-[var(--color-paper)] border-[var(--color-border)] text-[var(--color-ink)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]',
    answered && isAnswer && 'bg-[var(--color-success-bg)] border-[var(--color-success)] text-[var(--color-success)]',
    answered && isChosen && !isAnswer && 'bg-[var(--color-danger-bg)] border-[var(--color-danger)] text-[var(--color-danger)]',
    answered && !isAnswer && !isChosen && 'bg-[var(--color-paper)] border-[var(--color-border-soft)] text-[var(--color-ink-muted)]',
  )
}

export default function TestRunner({ questions, settingsHref }: Props) {
  const router = useRouter()
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [chosenKey, setChosenKey] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)

  const total = questions.length
  const question = questions[index]
  const correctCount = answers.filter((answer) => answer.correct).length
  const wrongCount = answers.length - correctCount
  const answered = answers.some((answer) => answer.questionId === question?.id)

  function record(correct: boolean) {
    if (answered) return
    setAnswers((current) => [...current, { questionId: question.id, correct }])
    saveAnswer(question, correct)
  }

  function isAcceptedLocation(option: { surah: string; ayah: number }) {
    const key = locationKey(option)
    if (question.acceptedKeys) return question.acceptedKeys.includes(key)
    if (key === locationKey(question.verse)) return true
    // Identical wording in two places counts as correct for either location.
    const chosenVerse = question.siblings.find((sibling) => locationKey(sibling) === key)
    return chosenVerse ? verseText(chosenVerse) === verseText(question.verse) : false
  }

  function chooseLocation(option: { surah: string; ayah: number }) {
    if (answered) return
    setChosenKey(locationKey(option))
    setRevealed(true)
    record(isAcceptedLocation(option))
  }

  function chooseWord(word: string) {
    if (answered) return
    setChosenKey(word)
    setRevealed(true)
    record(sameWording(word, question.answer ?? ''))
  }

  function next() {
    setIndex((i) => i + 1)
    setChosenKey(null)
    setRevealed(false)
  }

  function restart() {
    setIndex(0)
    setAnswers([])
    setChosenKey(null)
    setRevealed(false)
  }

  if (index >= total) {
    const percent = total ? Math.round((correctCount / total) * 100) : 0
    const missed = questions.filter((q) => answers.find((a) => a.questionId === q.id)?.correct === false)
    return (
      <section className="animate-fade-rise">
        <div className="p-6 md:p-8 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border-soft)] text-center">
          <p className="text-[12px] font-bold text-[var(--color-ink-muted)]">النتيجة</p>
          <p className={cn('mt-2 text-[56px] font-bold leading-none tabular-nums',
            percent >= 80 ? 'text-[var(--color-success)]' : percent >= 50 ? 'text-[var(--color-warn)]' : 'text-[var(--color-danger)]')}>
            {ayahToArabic(percent)}٪
          </p>
          <p className="mt-3 text-[14px] text-[var(--color-ink-soft)]">
            صحيح <span className="font-bold text-[var(--color-success)]">{ayahToArabic(correctCount)}</span>
            {' · '}خطأ <span className="font-bold text-[var(--color-danger)]">{ayahToArabic(wrongCount)}</span>
            {' · '}من {ayahToArabic(total)}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={restart}
              className="px-4 py-2.5 text-[13px] font-bold rounded-xl bg-[var(--color-primary)] text-[var(--color-paper)] hover:bg-[var(--color-primary-hover)] tap-shrink transition-colors">
              إعادة نفس الأسئلة
            </button>
            <button type="button" onClick={() => { restart(); router.refresh() }}
              className="px-4 py-2.5 text-[13px] font-bold rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-[var(--color-paper)] tap-shrink transition-colors">
              أسئلة جديدة
            </button>
            <Link href={settingsHref}
              className="px-4 py-2.5 text-[13px] font-bold rounded-xl text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-2)] tap-shrink transition-colors">
              تغيير الإعدادات
            </Link>
            <Link href="/stats"
              className="px-4 py-2.5 text-[13px] font-bold rounded-xl text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-2)] tap-shrink transition-colors">
              الإحصائيات
            </Link>
          </div>
        </div>

        {missed.length > 0 && (
          <div className="mt-8">
            <h2 className="text-[15px] font-bold text-[var(--color-ink)] mb-3">راجع هذه المواضع</h2>
            <ul className="space-y-2">
              {missed.map((q) => (
                <li key={q.id}>
                  <Link href={q.reviewHref}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-soft)] hover:border-[var(--color-primary)] tap-shrink transition-colors">
                    <span className="min-w-0">
                      <span className="block text-[13px] font-bold text-[var(--color-ink)] truncate">{q.groupTitle ?? 'فتح في المصحف'}</span>
                      <Location verse={q.verse} className="text-[12px] text-[var(--color-primary)] font-bold" />
                    </span>
                    <span aria-hidden="true" className="text-[var(--color-ink-muted)]">←</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    )
  }

  const progress = ((index + (answered ? 1 : 0)) / total) * 100

  return (
    <section key={question.id} className="animate-fade-rise">
      {/* Progress */}
      <div className="flex items-center justify-between mb-2 text-[12px] font-bold text-[var(--color-ink-muted)]">
        <span>سؤال {ayahToArabic(index + 1)} من {ayahToArabic(total)}</span>
        <span>
          <span className="text-[var(--color-success)]">صحيح {ayahToArabic(correctCount)}</span>
          {' · '}
          <span className="text-[var(--color-danger)]">خطأ {ayahToArabic(wrongCount)}</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden mb-6" aria-hidden="true">
        <div className="h-full bg-[var(--color-primary)] transition-[width] duration-300" style={{ width: `${progress}%` }} />
      </div>

      <div className="p-5 md:p-7 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border-soft)]">
        {question.kind === 'mcq' ? (
          <>
            <p className="text-[13px] font-bold text-[var(--color-ink-muted)] mb-3">
              {question.surahOnly ? 'في أي سورة وردت هذه الآية؟' : 'في أي موضع وردت هذه الآية؟'}
            </p>
            <ArabicDiff parts={plainParts(question.verse)} size="lg" />
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {question.options.map((option) => {
                const key = locationKey(option)
                return (
                  <button key={key} type="button" onClick={() => chooseLocation(option)} disabled={answered}
                    className={choiceClass(answered, isAcceptedLocation(option), key === chosenKey)}>
                    <Location verse={option} surahOnly={question.surahOnly} />
                  </button>
                )
              })}
            </div>
          </>
        ) : question.kind === 'words' ? (
          <>
            <p className="text-[13px] font-bold text-[var(--color-ink-muted)] mb-1">ما الكلمة الناقصة في هذا الموضع؟</p>
            <Location verse={question.verse} className="block mb-3 text-[15px] font-bold text-[var(--color-primary)]" />
            <ArabicDiff parts={blankedParts(question, answered)} size="lg" />
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(question.wordOptions ?? []).map((word) => (
                <button key={word} type="button" onClick={() => chooseWord(word)} disabled={answered}
                  className={cn(choiceClass(answered, sameWording(word, question.answer ?? ''), word === chosenKey), 'font-quran text-[20px] leading-[1.9] text-center')}>
                  {word}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="text-[13px] font-bold text-[var(--color-ink-muted)] mb-2">استحضر الآية في هذا الموضع</p>
            <Location verse={question.verse} className="block text-[22px] md:text-[26px] font-bold text-[var(--color-primary)]" />
            {question.groupTitle ? <p className="mt-2 text-[12px] text-[var(--color-ink-muted)]">من مجموعة: {question.groupTitle}</p> : null}
            {!revealed ? (
              <button type="button" onClick={() => setRevealed(true)}
                className="mt-6 w-full min-h-[52px] rounded-xl bg-[var(--color-primary)] text-[var(--color-paper)] text-[14px] font-bold hover:bg-[var(--color-primary-hover)] tap-shrink transition-colors">
                إظهار الآية
              </button>
            ) : (
              <div className="mt-5">
                <ArabicDiff parts={question.verse.parts as Part[]} size="lg" />
                {!answered && (
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => record(true)}
                      className="min-h-[52px] rounded-xl bg-[var(--color-success-bg)] text-[var(--color-success)] text-[14px] font-bold border border-[var(--color-success)] tap-shrink transition-colors">
                      عرفتها ✓
                    </button>
                    <button type="button" onClick={() => record(false)}
                      className="min-h-[52px] rounded-xl bg-[var(--color-danger-bg)] text-[var(--color-danger)] text-[14px] font-bold border border-[var(--color-danger)] tap-shrink transition-colors">
                      لم أعرفها ✗
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Review: every similar location with its colour-coded differences */}
      {answered && (
        <div className="mt-6 animate-fade-rise">
          {question.groupTitle ? (
            <>
              <h2 className="text-[13px] font-bold text-[var(--color-ink-muted)] mb-3">المواضع المتشابهة — {question.groupTitle}</h2>
              <ol className="space-y-3">
                {question.siblings.map((sibling) => {
                  const isTarget = locationKey(sibling) === locationKey(question.verse)
                  return (
                    <li key={locationKey(sibling)}
                      className={cn('p-4 rounded-xl border',
                        isTarget ? 'bg-[var(--color-primary-soft)] border-[var(--color-primary)]' : 'bg-[var(--color-surface)] border-[var(--color-border-soft)]')}>
                      <Location verse={sibling} className="block mb-1 text-[12px] font-bold text-[var(--color-primary)]" />
                      <ArabicDiff parts={sibling.parts as Part[]} size="sm" />
                    </li>
                  )
                })}
              </ol>
            </>
          ) : question.kind === 'mcq' ? (
            <p className="p-4 rounded-xl border bg-[var(--color-primary-soft)] border-[var(--color-primary)] text-[14px] font-bold text-[var(--color-primary)]">
              الجواب: <Location verse={question.verse} />
            </p>
          ) : null}
          <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
            <Link href={question.reviewHref}
              className="text-[12px] font-bold text-[var(--color-ink-muted)] hover:text-[var(--color-primary)] transition-colors">
              {question.groupId ? 'فتح المجموعة' : 'فتح في المصحف'}
            </Link>
            <button type="button" onClick={next}
              className="px-6 min-h-[48px] rounded-xl bg-[var(--color-primary)] text-[var(--color-paper)] text-[14px] font-bold hover:bg-[var(--color-primary-hover)] tap-shrink transition-colors">
              {index + 1 < total ? 'السؤال التالي ←' : 'عرض النتيجة'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
