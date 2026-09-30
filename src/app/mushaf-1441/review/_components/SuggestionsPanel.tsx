'use client'

// Learned suggestions for the selected word, built server-side from entries the owner has already
// APPROVED (qiraat_review_suggestions). One click on «إضافة» creates an ordinary UNREVIEWED entry
// (instantly, through the same optimistic save queue as a manual add); it still has to be approved
// by hand with «اعتماد». Nothing here is ever applied automatically.

import { useEffect, useState } from 'react'
import type { CreateEntryInput, ReviewRow, ReviewSuggestion } from '../_lib/types'
import * as reviewApi from '../_lib/api'
import { cn } from '@/lib/cn'
import { describeNarratorGroup } from './narratorDisplay'
import { NarratorBadges } from './NarratorBadges'
import type { WordMeta } from './useReviewEditorDraft'

type Props = {
  word: WordMeta | null
  /** Live entries already on this word: used to refresh after saves and to spot narrator clashes. */
  activeRows: ReviewRow[]
  onAdd(draft: CreateEntryInput): Promise<boolean>
}

export function suggestionToDraft(suggestion: ReviewSuggestion, word: WordMeta): CreateEntryInput {
  const c = suggestion.config
  return {
    surah: word.surah,
    ayah: word.ayah,
    startWord: word.word,
    kind: c.kind,
    readingText: c.readingText,
    uthmaniText: c.uthmaniText ?? null,
    description: c.description ?? null,
    performanceNote: c.performanceNote ?? null,
    variantType: c.variantType,
    categoryCode: c.categoryCode,
    rulingText: c.rulingText ?? null,
    narrators: c.narrators.map((n) => ({
      id: n.id,
      action: n.action ?? null,
      wajhOrder: n.wajhOrder,
      wajhNote: n.wajhNote ?? null,
    })),
    appliesWasl: c.appliesWasl,
    appliesWaqf: c.appliesWaqf,
    hamzahDetail: c.hamzahDetail ?? null,
  }
}

function evidenceText(s: ReviewSuggestion): string {
  const where = s.sources.length ? ` (مثل ${s.sources.join('، ')})` : ''
  if (s.tier === 'exact') return `الكلمة نفسها — اعتُمد ${s.support} ${s.support === 1 ? 'مرة' : 'مرات'}${where}`
  return `كلمات تنتهي بـ «…${s.shape ?? ''}» — ${s.support} من ${s.shapeTotal ?? s.support} موضعًا معتمدًا${where}`
}

export default function SuggestionsPanel({ word, activeRows, onAdd }: Props) {
  const wordId = word ? `${word.surah}:${word.ayah}:${word.word}` : null
  // Placeholder rows (a save still in flight) are ignored: the list is re-read once the saved row
  // replaces them, not twice.
  const rowsSignature = activeRows.filter((r) => !r.entryId.startsWith('tmp-')).map((r) => r.entryId).join('|')
  const [loaded, setLoaded] = useState<{ wordId: string; list: ReviewSuggestion[] } | null>(null)
  const [added, setAdded] = useState<{ wordId: string; keys: string[] }>({ wordId: '', keys: [] })
  const [open, setOpen] = useState(true)

  useEffect(() => {
    if (!word || !wordId) return
    let cancelled = false
    // Short debounce: clicking through words quickly should only query the word you stop on.
    const timer = setTimeout(() => {
      void reviewApi.getSuggestions({ surah: word.surah, ayah: word.ayah, word: word.word }).then((result) => {
        if (!cancelled) setLoaded({ wordId, list: result.ok ? result.data : [] })
      })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // `word` is derived from wordId; rowsSignature re-reads after a save changes what is on the word.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordId, rowsSignature])

  if (!word || !wordId) return null

  const justAdded = added.wordId === wordId ? added.keys : []
  const suggestions = (loaded?.wordId === wordId ? loaded.list : []).filter((s) => !justAdded.includes(s.key))
  if (suggestions.length === 0) return null

  const farshNarratorIds = new Set(
    activeRows.filter((r) => !r.deleted && r.kind === 'farsh').flatMap((r) => r.narrators.map((n) => n.id)),
  )

  async function add(suggestion: ReviewSuggestion) {
    if (!word) return
    setAdded((current) => ({
      wordId: wordId ?? '',
      keys: [...(current.wordId === wordId ? current.keys : []), suggestion.key],
    }))
    const ok = await onAdd(suggestionToDraft(suggestion, word))
    if (!ok) setAdded((current) => ({ ...current, keys: current.keys.filter((k) => k !== suggestion.key) }))
  }

  return (
    <section
      aria-label="اقتراحات من الأوجه المعتمدة"
      className="mt-2 rounded-xl border border-emerald-300 bg-emerald-50/50 shadow-2xs"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-1.5"
      >
        <span className="text-xs font-bold text-emerald-900">
          💡 اقتراحات من الأوجه المعتمدة سابقًا ({suggestions.length})
        </span>
        <span className="text-[11px] text-emerald-800">{open ? 'إخفاء ▲' : 'عرض ▼'}</span>
      </button>

      {open ? (
        <div className="flex flex-col gap-1.5 border-t border-emerald-200 px-3 pb-2.5 pt-2">
          <p className="text-[11px] text-emerald-900/80">
            تُبنى الاقتراحات من الأوجه التي اعتمدتها فقط. الإضافة بنقرة واحدة تُنشئ وجهًا «غير معتمد» تراجعه وتعتمده بنفسك.
          </p>
          <ul className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">
            {suggestions.map((s) => {
              const clash =
                s.config.kind === 'farsh' && s.config.narrators.some((n) => farshNarratorIds.has(n.id))
              return (
                <li
                  key={s.key}
                  className="flex flex-col gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-[var(--color-ink)]">
                        <span
                          className={cn(
                            'rounded px-1.5 py-px text-[11px]',
                            s.tier === 'exact' ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white',
                          )}
                        >
                          {s.tier === 'exact' ? 'مطابقة' : 'نمط'}
                        </span>
                        <span>{s.config.kind === 'usul' ? 'أصول' : 'فرش'}</span>
                        {s.config.categoryNameAr ? <span>· {s.config.categoryNameAr}</span> : null}
                      </div>
                      {s.config.readingText ? (
                        <div className="font-quran text-lg leading-snug text-[var(--color-ink)]" dir="rtl">
                          {s.config.readingText}
                        </div>
                      ) : null}
                      {s.config.rulingText ? (
                        <p className="text-[11px] text-[var(--color-ink-soft)]">{s.config.rulingText}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      disabled={clash}
                      onClick={() => void add(s)}
                      title={clash ? 'أحد الرواة مسجَّل مسبقًا في وجه فرش آخر على هذه الكلمة' : 'إضافة كوجه غير معتمد'}
                      className="shrink-0 rounded bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white shadow-xs hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ➕ إضافة
                    </button>
                  </div>
                  <NarratorBadges items={describeNarratorGroup(s.config.narrators)} />
                  {s.config.appliesWasl === false || s.config.appliesWaqf === false ? (
                    <span className="text-[11px] text-[var(--color-ink-muted)]">
                      {s.config.appliesWasl === false ? 'وقفًا فقط' : 'وصلًا فقط'}
                    </span>
                  ) : null}
                  <span className="text-[11px] text-[var(--color-ink-muted)]">{evidenceText(s)}</span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
