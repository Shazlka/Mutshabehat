'use client'

// External reference panel of the review editor: shows what an outside source (nquran.com or
// «الشامل») documents for the SELECTED word, reconciled against what is already recorded for it.
// Display only -- never authoritative, never auto-applied; ➕ hands a group to the editor, which
// fills its draft, and the reviewer presses «حفظ» themselves.

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { cn } from '@/lib/cn'
import {
  findNquranEntryForAyah,
  hasNquranReferenceForSurah,
  loadNquranReference,
  nquranGroupsForDifference,
  findNquranDifferencesForWord,
  type NquranAyahEntry,
} from '../_lib/nquranReference'
import {
  findShamilEntriesForWord,
  hasShamilReferenceForSurah,
  loadShamilReference,
  shamilGroupsForEntry,
  type ShamilEntry,
} from '../_lib/shamilReference'
import {
  isGroupInDraft,
  proposeReferenceDecision,
  referenceBadgeVisibility,
  type ReferenceCondition,
  type ReferenceDecisionStatus,
  type ReferenceGroup,
  type ReferenceSuggestion,
} from '../_lib/referenceGroup'
import type { ReferenceSourceId } from '../_lib/referenceApply'
import type { ReviewRow } from '../_lib/types'
import { FALLBACK_USUL_CATEGORIES } from './UsulRuleGrid'
import { STATUS_LABEL_AR } from './statusMeta'
import type { WordMeta } from './ReviewEditorPane'

// Labels/colors for the reconciliation badges -- see proposeReferenceDecision() for what each
// status means. Kept as a plain lookup (not JSX) so it can sit at module scope.
const DECISION_BADGES: Record<ReferenceDecisionStatus, { label: string; className: string }> = {
  matched: { label: '✓ معتمد كوجه', className: 'bg-green-100 text-green-800' },
  recorded_unreviewed: { label: '🔎 مسجَّل كوجه، بانتظار الاعتماد', className: 'bg-blue-100 text-blue-800' },
  partial: { label: '⚠ تعارض جزئي في القراء', className: 'bg-orange-100 text-orange-800' },
  missing: { label: '➕ غير مسجَّل — يُقترح إضافته', className: 'bg-red-100 text-red-800' },
  unresolved: { label: '❔ تعذّر التعرّف على القارئ', className: 'bg-gray-100 text-gray-700' },
}

const CONDITION_LABEL: Record<ReferenceCondition, string> = {
  both: 'وصلاً ووقفاً',
  wasl: 'وصلاً',
  waqf: 'وقفاً',
}

const SOURCE_STORAGE_KEY = 'mushaf1441:review:reference-source:v1'

// The chosen source is per device. useSyncExternalStore keeps server and first client render equal
// (server snapshot = nquran) and then reads the stored value; `memorySource` keeps the switch working
// when storage is blocked (private window), it just is not remembered.
let memorySource: ReferenceSourceId | null = null
const sourceListeners = new Set<() => void>()

function readStoredSource(): ReferenceSourceId {
  if (memorySource) return memorySource
  try {
    return window.localStorage.getItem(SOURCE_STORAGE_KEY) === 'shamil' ? 'shamil' : 'nquran'
  } catch {
    return 'nquran'
  }
}

function subscribeSource(listener: () => void): () => void {
  sourceListeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    sourceListeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

function storeSource(next: ReferenceSourceId) {
  memorySource = next
  try {
    window.localStorage.setItem(SOURCE_STORAGE_KEY, next)
  } catch {
    /* blocked storage: memorySource still carries the choice for this page view */
  }
  sourceListeners.forEach((listener) => listener())
}

function suggestionLabel(s: ReferenceSuggestion): string {
  if (s.kind === 'farsh') return 'فرش'
  const name = FALLBACK_USUL_CATEGORIES.find((c) => c.code === s.categoryCode)?.nameAr
  return name ? `أصول › ${name}` : 'أصول'
}

type Props = {
  selectedWordMeta: WordMeta | null
  activeRowsForWord: ReviewRow[]
  /** The words of the selected word's ayah that the page shows (1-based `word`), for phrase matching. */
  ayahWords: { word: number; text: string }[]
  /** Narrators already in the open draft. */
  draftNarratorIds: string[]
  isSaving: boolean
  /** Key of the group whose ➕ was just pressed (drives the «✓ أُضيف» flash). */
  appliedKey: string | null
  onApply(group: ReferenceGroup, source: ReferenceSourceId, appliedKey: string): void
  onApplySuggestion(suggestion: ReferenceSuggestion): void
}

export default function ReferencePanel({
  selectedWordMeta,
  activeRowsForWord,
  ayahWords,
  draftNarratorIds,
  isSaving,
  appliedKey,
  onApply,
  onApplySuggestion,
}: Props) {
  const source = useSyncExternalStore(subscribeSource, readStoredSource, () => 'nquran' as ReferenceSourceId)
  const [open, setOpen] = useState(true)
  const [nquranLoaded, setNquranLoaded] = useState<{ surah: number; entries: NquranAyahEntry[] } | null>(null)
  const [shamilLoaded, setShamilLoaded] = useState<{ surah: number; entries: ShamilEntry[] } | null>(null)
  const [shamilFailed, setShamilFailed] = useState(false)
  const [retry, setRetry] = useState(0)

  const chooseSource = storeSource

  const surah = selectedWordMeta?.surah ?? null

  useEffect(() => {
    if (source !== 'nquran' || surah === null || !hasNquranReferenceForSurah(surah)) return
    if (nquranLoaded?.surah === surah) return
    let cancelled = false
    loadNquranReference(surah).then((entries) => {
      if (!cancelled) setNquranLoaded({ surah, entries })
    })
    return () => {
      cancelled = true
    }
  }, [source, surah, nquranLoaded])

  // The الشامل chunk is only fetched while its tab is active.
  useEffect(() => {
    if (source !== 'shamil' || surah === null || !hasShamilReferenceForSurah(surah)) return
    if (shamilLoaded?.surah === surah) return
    let cancelled = false
    loadShamilReference(surah)
      .then((entries) => {
        if (cancelled) return
        setShamilFailed(false)
        setShamilLoaded({ surah, entries })
      })
      .catch(() => {
        if (!cancelled) setShamilFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [source, surah, shamilLoaded, retry])

  const nquranRanked = useMemo(() => {
    if (!selectedWordMeta || !nquranLoaded || nquranLoaded.surah !== selectedWordMeta.surah) return null
    const entry = findNquranEntryForAyah(nquranLoaded.entries, selectedWordMeta.ayah)
    if (!entry || entry.differences.length === 0) return null
    // Only the differences about the clicked word -- the rest of the ayah's differences are hidden.
    return {
      entry,
      differences: findNquranDifferencesForWord(entry.differences, selectedWordMeta.text, {
        wordIndex: selectedWordMeta.word,
        ayahWords,
      }),
    }
  }, [selectedWordMeta, nquranLoaded, ayahWords])

  const shamilEntries = useMemo(() => {
    if (!selectedWordMeta || !shamilLoaded || shamilLoaded.surah !== selectedWordMeta.surah) return null
    return findShamilEntriesForWord(shamilLoaded.entries, selectedWordMeta.ayah, selectedWordMeta.text, {
      wordIndex: selectedWordMeta.word,
      ayahWords,
    })
  }, [selectedWordMeta, shamilLoaded, ayahWords])

  if (!selectedWordMeta) return null

  const sourceTitle = source === 'nquran' ? 'nquran.com' : 'الشامل'
  const shamilCovered = hasShamilReferenceForSurah(selectedWordMeta.surah)

  function renderGroupRow(group: ReferenceGroup, matchesWord: boolean, badgeKey: string, withDetails: boolean) {
    const decision = matchesWord ? proposeReferenceDecision(group, activeRowsForWord) : null
    const inDraft = matchesWord && isGroupInDraft(group, draftNarratorIds)
    const visible = referenceBadgeVisibility(decision, inDraft)
    const badge = decision && visible.decision ? DECISION_BADGES[decision.status] : null
    const canApply = matchesWord && group.narratorIds.length > 0
    const suggestion = withDetails ? group.suggestion : undefined
    return (
      <div key={group.key} className="text-[11px] leading-snug">
        <div className="flex flex-wrap items-center gap-1">
          <span className="font-bold text-amber-900">{group.readersLabel}:</span>
          {visible.draft ? (
            <span
              title="هؤلاء الرواة في المسودة الحالية بالفعل"
              className="rounded bg-purple-100 px-1 py-px text-[11px] font-bold text-purple-800"
            >
              ✎ في المسودة
            </span>
          ) : null}
          {badge ? (
            <span
              title={
                decision?.matchedRow
                  ? `مقارنةً بوجه ${STATUS_LABEL_AR[decision.matchedRow.reviewStatus]} مسجّل لهذه الكلمة`
                  : undefined
              }
              className={cn('rounded px-1 py-px text-[11px] font-bold', badge.className)}
            >
              {badge.label}
            </span>
          ) : null}
          {withDetails && group.condition ? (
            <span
              title={group.conditionBasis === 'default' ? 'لم يذكر الكتاب شرطًا؛ افتُرض «وصلاً ووقفاً»' : undefined}
              className="rounded bg-amber-100 px-1 py-px text-[11px] text-amber-900"
            >
              {CONDITION_LABEL[group.condition]}
              {group.conditionBasis === 'default' ? ' · افتراضي' : ''}
            </span>
          ) : null}
          {suggestion ? (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => onApplySuggestion(suggestion)}
              title="يضبط نوع الوجه والباب المقترحين (ثم اضغط حفظ)"
              className="rounded border border-amber-400 bg-white px-1 py-px text-[11px] text-amber-900 hover:bg-amber-100 disabled:opacity-50"
            >
              {suggestionLabel(suggestion)}
            </button>
          ) : null}
          {canApply ? (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => onApply(group, source, badgeKey)}
              title={
                inDraft
                  ? 'هؤلاء الرواة في المسودة بالفعل — الإضافة تنشئ لهم وجهًا آخر بنص أداء مختلف'
                  : 'يضيف القراء/الرواة مع نص الأداء إلى «تفاصيل الأداء والأوجه للرواة المحددين» في هذا الوجه (ثم اضغط حفظ)'
              }
              className="rounded border border-amber-500 bg-white px-1 py-px text-[11px] font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
            >
              {appliedKey === badgeKey ? '✓ أُضيف — اضغط حفظ' : inDraft ? '➕ إضافة وجه آخر' : '➕ إضافة للأداء'}
            </button>
          ) : null}
        </div>
        <div className="text-[var(--color-ink-muted)]">{group.performanceText}</div>
        {withDetails && group.readingText ? (
          <div className="font-quran text-sm text-[var(--color-ink)]" dir="rtl">
            ﴿{group.readingText}﴾
          </div>
        ) : null}
      </div>
    )
  }

  function renderNquran() {
    if (!hasNquranReferenceForSurah(selectedWordMeta!.surah)) return <p className="text-[11px] text-amber-800">لا بيانات من nquran.com لهذه السورة.</p>
    if (!nquranLoaded) return <p className="text-[11px] text-amber-800">جارٍ التحميل…</p>
    if (!nquranRanked) return <p className="text-[11px] text-amber-800">لا توجد فروق قراءات موثقة في nquran.com لهذه الآية.</p>
    return (
      <>
        <p className="text-[11px] text-amber-800/80">
          مرجع للاطّلاع — غير معتمد تلقائيًا؛ زر «إضافة كوجه» ينشئ وجهًا جديدًا مُعبَّأً مسبقًا بالقراء/الرواة والبيان دون حفظه، فيبقى قابلًا للتعديل والمراجعة قبل «حفظ».
        </p>
        {nquranRanked.differences.length === 0 ? (
          <p className="text-[11px] text-amber-800">
            لا توجد فروق قراءات موثقة في nquran.com لهذه الكلمة تحديدًا (توجد فروق في كلمات أخرى من الآية).
          </p>
        ) : null}
        {nquranRanked.differences.map((difference, idx) => (
          <div
            key={idx}
            className="rounded-md border border-amber-500 bg-amber-100/80 p-1.5"
          >
            <p className="font-quran text-base text-[var(--color-ink)]" dir="rtl">
              ﴿{difference.location}﴾
            </p>
            <div className="mt-1 flex flex-col gap-1">
              {nquranGroupsForDifference(difference).map((group) =>
                renderGroupRow(group, true, `nquran:${idx}-${group.key}`, false),
              )}
            </div>
          </div>
        ))}
        <a
          href={nquranRanked.entry.sourceUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="text-[11px] text-amber-700 underline"
        >
          المصدر: nquran.com ↗
        </a>
      </>
    )
  }

  function renderShamil() {
    if (!shamilCovered) return <p className="text-[11px] text-amber-800">لا بيانات من الشامل لهذه السورة بعد.</p>
    if (shamilFailed) {
      return (
        <p className="text-[11px] text-amber-800">
          تعذّر تحميل بيانات الشامل.{' '}
          <button type="button" onClick={() => setRetry((n) => n + 1)} className="font-bold underline">
            إعادة المحاولة
          </button>
        </p>
      )
    }
    if (!shamilEntries) return <p className="text-[11px] text-amber-800">جارٍ التحميل…</p>
    if (shamilEntries.length === 0) return <p className="text-[11px] text-amber-800">لا يوجد في الشامل لهذه الكلمة.</p>
    return (
      <>
        <p className="text-[11px] text-amber-800/80">
          مرجع للاطّلاع — غير معتمد تلقائيًا؛ «➕ إضافة للأداء» تضيف القراء/الرواة مع نص الأداء، وتملأ نص القراءة وشرط الوصل/الوقف عند الإمكان، ثم اضغط «حفظ». الكلمة المكررة في الآية تُعرض لها الأوجه نفسها في كل موضع.
        </p>
        {shamilEntries.map((entry) => (
          <div key={entry.entryId} className="rounded-md border border-amber-500 bg-amber-100/80 p-1.5">
            <div className="flex flex-wrap items-center gap-1">
              <p className="font-quran text-base text-[var(--color-ink)]" dir="rtl">
                ﴿{entry.words.join(' / ')}﴾
              </p>
              {entry.scope === 'all_quran' ? (
                <span className="rounded bg-purple-100 px-1 py-px text-[11px] font-bold text-purple-800">قاعدة عامة</span>
              ) : null}
              {entry.ayahs.length > 1 ? (
                <span className="text-[11px] text-amber-800">الآيات: {entry.ayahs.join('، ')}</span>
              ) : null}
              <span className="text-[11px] text-amber-800">ص {entry.page}</span>
            </div>
            <div className="mt-1 flex flex-col gap-1">
              {shamilGroupsForEntry(entry).map((group) =>
                renderGroupRow(group, true, `shamil:${entry.entryId}-${group.key}`, true),
              )}
            </div>
            <details className="mt-1 text-[11px] text-amber-900">
              <summary className="cursor-pointer font-bold">{entry.sourceDifference ? 'نص المصدر' : 'نص الكتاب'}</summary>
              <p className="mt-1 whitespace-pre-line leading-relaxed" dir="rtl">
                {entry.sourceText}
              </p>
              {entry.flags.map((flag) => (
                <p key={flag} className="mt-0.5 text-orange-800">
                  ⚠ {flag}
                </p>
              ))}
            </details>
          </div>
        ))}
      </>
    )
  }

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50/60">
      <div className="flex w-full flex-col gap-1 px-2 py-1">
        <span className="text-[11px] font-bold text-amber-900">📖 مرجع خارجي ({sourceTitle}) — فروق القراءات في هذه الكلمة</span>
        <div className="flex items-center justify-between gap-2">
          <div role="tablist" aria-label="مصدر المرجع" className="flex overflow-hidden rounded border border-amber-400">
            {(['nquran', 'shamil'] as const).map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={source === id}
                onClick={() => chooseSource(id)}
                className={cn(
                  'px-2 py-px text-[11px] font-bold',
                  source === id ? 'bg-amber-500 text-white' : 'bg-white text-amber-800 hover:bg-amber-100',
                )}
              >
                {id === 'nquran' ? 'nquran' : 'الشامل'}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setOpen((v) => !v)} className="text-[11px] text-amber-800">
            {open ? 'إخفاء ▲' : 'عرض ▼'}
          </button>
        </div>
      </div>
      {open ? (
        <div className="flex flex-col gap-1.5 border-t border-amber-200 px-2 pb-2 pt-1.5">
          {source === 'nquran' ? renderNquran() : renderShamil()}
        </div>
      ) : null}
    </div>
  )
}
