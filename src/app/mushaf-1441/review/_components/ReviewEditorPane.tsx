'use client'

import { useEffect, useMemo, useState } from 'react'
import type {
  BulkApplyResult,
  CatalogNarrator,
  CreateEntryInput,
  EntryFields,
  HamzahDetail,
  NarratorInput,
  OccurrenceCandidate,
  ReviewPage,
  ReviewRow,
  SameWordMatch,
} from '../_lib/types'
import {
  getMushaf1441SurahOption,
} from '../../../../../packages/quran-data/mushaf1441/pageMetadata'
import ReaderNarratorSelector, { CANONICAL_READERS } from './ReaderNarratorSelector'
import UsulRuleGrid, { FALLBACK_USUL_CATEGORIES } from './UsulRuleGrid'
import FarshFields, { CANONICAL_VARIANT_TYPES, normalizeVariantType } from './FarshFields'
import HamzahDetailFields, { isHamzahCategory } from './HamzahDetailFields'
import { isImalahCategory } from './ImalahDetailFields'
import { STATUS_LABEL_AR, KIND_LABEL_AR } from './statusMeta'
import { cn } from '@/lib/cn'
import { normalizeArabic } from '@/lib/arabic'
import * as reviewApi from '../_lib/api'
import { describeNarratorGroup } from './narratorDisplay'
import { NarratorBadges } from './NarratorBadges'
import { labelForRow } from './facesSummary'
import {
  findNquranEntryForAyah,
  hasNquranReferenceForSurah,
  loadNquranBaqarahReference,
  proposeNquranDecision,
  rankDifferencesForWord,
  resolveDifferenceGroups,
  type NquranAyahEntry,
  type NquranDecisionStatus,
} from '../_lib/nquranReference'

import { useReviewEditorDraft } from './useReviewEditorDraft'

// Labels/colors for the nquran.com reconciliation badges -- see proposeNquranDecision() for what
// each status means. Kept as a plain lookup (not JSX) so it can sit at module scope.
const NQURAN_DECISION_BADGES: Record<NquranDecisionStatus, { label: string; className: string }> = {
  matched: { label: '✓ مطابق لوجه معتمد', className: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  recorded_unreviewed: { label: '🔎 مسجَّل، بانتظار الاعتماد', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  partial: { label: '⚠ تعارض جزئي في القراء', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' },
  missing: { label: '➕ غير مسجَّل — يُقترح إضافته', className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
  unresolved: { label: '❔ تعذّر التعرّف على القارئ', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
}

export type WordMeta = {
  surah: number
  ayah: number
  word: number
  text: string
  page: number
}

type Props = {
  page: ReviewPage
  selectedWordKey: string | null
  selectedWordMeta: WordMeta | null
  selectedRow: ReviewRow | null
  activeRowsForWord: ReviewRow[]
  newEntryDraft: CreateEntryInput | null
  // Feature 1/2: the second endpoint of an active Ctrl-click span (see ReviewMushafPane).
  spanEndKey?: string | null
  spanEndMeta?: WordMeta | null
  onSelectRow(row: ReviewRow): void
  onStartNewEntry(meta: WordMeta): void
  onCancelNewEntry(): void
  onConfirmRow(row: ReviewRow): Promise<void>
  onFlagRow(row: ReviewRow): Promise<void>
  onSaveRowEdits(row: ReviewRow, fields: EntryFields, narrators: NarratorInput[]): Promise<void>
  onDeleteRow(row: ReviewRow): Promise<void>
  onBulkDelete(rows: ReviewRow[], note: string | null): Promise<void>
  onCopyToOccurrence(sourceEntryId: string, target: { surah: number; ayah: number; startWord: number }): Promise<void>
  onBulkApply(
    sourceEntryId: string,
    targets: { surah: number; ayah: number; word: number }[]
  ): Promise<BulkApplyResult | null>
  onCreateNewEntry(entry: CreateEntryInput): Promise<void>
  isSaving: boolean
  saveMessage: string | null
  errorMessage: string | null
}

export default function ReviewEditorPane({
  page,
  selectedWordKey,
  selectedWordMeta,
  selectedRow,
  activeRowsForWord,
  newEntryDraft,
  spanEndKey = null,
  spanEndMeta = null,
  onSelectRow,
  onStartNewEntry,
  onCancelNewEntry,
  onConfirmRow,
  onFlagRow,
  onSaveRowEdits,
  onDeleteRow,
  onBulkDelete,
  onCopyToOccurrence,
  onBulkApply,
  onCreateNewEntry,
  isSaving,
  saveMessage,
  errorMessage,
}: Props) {
  // Feature 2: the two spanned words, in canonical-key order, for word-role assignment inside
  // the الهمزتان من كلمتين builder. `selectedWordKey`/`selectedWordMeta` is the anchor.
  const spanStart = useMemo(() => {
    if (!spanEndKey || !spanEndMeta || !selectedWordKey || !selectedWordMeta) return null
    return selectedWordKey <= spanEndKey
      ? { key: selectedWordKey, text: selectedWordMeta.text }
      : { key: spanEndKey, text: spanEndMeta.text }
  }, [spanEndKey, spanEndMeta, selectedWordKey, selectedWordMeta])
  const spanEnd = useMemo(() => {
    if (!spanEndKey || !spanEndMeta || !selectedWordKey || !selectedWordMeta) return null
    return selectedWordKey <= spanEndKey
      ? { key: spanEndKey, text: spanEndMeta.text }
      : { key: selectedWordKey, text: selectedWordMeta.text }
  }, [spanEndKey, spanEndMeta, selectedWordKey, selectedWordMeta])
  const {
    kind,
    setKind,
    categoryCode,
    setCategoryCode,
    readingText,
    setReadingText,
    variantType,
    setVariantType,
    rulingText,
    setRulingText,
    description,
    setDescription,
    performanceNote,
    setPerformanceNote,
    narrators,
    setNarrators,
    appliesWasl,
    setAppliesWasl,
    appliesWaqf,
    setAppliesWaqf,
    hamzahDetail,
    setHamzahDetail,
    isAddMode,
    currentSurahNumber,
    currentAyahNumber,
    currentWordNumber,
    currentHafsText,
    multiSelectMode,
    setMultiSelectMode,
    selectedForDelete,
    setSelectedForDelete,
    toggleDeleteSelection,
    confirmBulkDelete,
    deleteAllForWord,
    activeRowsSummary,
    sameWordOpen,
    setSameWordOpen,
    sameWordLoading,
    sameWordMatches,
    verifiedSameCategoryMatches,
    verifiedOnlyFilter,
    setVerifiedOnlyFilter,
    openSameWordPanel,
    previewMatch,
    selectMatchForPreview,
    cancelPreview,
    confirmCopyFromMatch,
    bulkApplyOpen,
    setBulkApplyOpen,
    bulkApplyLoading,
    occurrences,
    selectedOccurrences,
    setSelectedOccurrences,
    openBulkApplyPanel,
    toggleOccurrence,
    confirmBulkApply,
    handleSaveExisting,
    handleCreate,
    resetTransientPanels,
  } = useReviewEditorDraft({
    selectedRow,
    activeRowsForWord,
    newEntryDraft,
    selectedWordMeta,
    onSaveRowEdits,
    onCreateNewEntry,
    onBulkDelete,
    onCopyToOccurrence,
    onBulkApply,
  })

  // Reset the transient bulk/copy panels whenever the selected word changes.
  const [resetForWordKey, setResetForWordKey] = useState(selectedWordKey)
  if (resetForWordKey !== selectedWordKey) {
    setResetForWordKey(selectedWordKey)
    resetTransientPanels()
  }

  const [usulSearchQuery, setUsulSearchQuery] = useState('')
  const [showAllUsulCategories, setShowAllUsulCategories] = useState(false)

  // External reference (nquran.com), currently Baqarah-only -- display only, never written into
  // any saved field. Lazily loaded so its ~1.6 MB fixture is never in the editor's initial bundle.
  const [nquranEntries, setNquranEntries] = useState<NquranAyahEntry[] | null>(null)
  const [nquranPanelOpen, setNquranPanelOpen] = useState(true)
  useEffect(() => {
    if (!selectedWordMeta || !hasNquranReferenceForSurah(selectedWordMeta.surah)) return
    if (nquranEntries) return
    let cancelled = false
    loadNquranBaqarahReference().then((entries) => {
      if (!cancelled) setNquranEntries(entries)
    })
    return () => {
      cancelled = true
    }
  }, [selectedWordMeta, nquranEntries])

  const nquranRanked = useMemo(() => {
    if (!selectedWordMeta || !nquranEntries || !hasNquranReferenceForSurah(selectedWordMeta.surah)) return null
    const entry = findNquranEntryForAyah(nquranEntries, selectedWordMeta.ayah)
    if (!entry || entry.differences.length === 0) return null
    return { entry, ranked: rankDifferencesForWord(entry.differences, selectedWordMeta.text) }
  }, [selectedWordMeta, nquranEntries])

  const categories = useMemo(() => {
    if (page.categories && page.categories.length > 0) {
      return page.categories.filter((c) => c.code !== 'AYAH_COUNT')
    }
    return FALLBACK_USUL_CATEGORIES
  }, [page.categories])

  const selectedCategory = useMemo(() => {
    return categories.find((c) => c.code === categoryCode)
  }, [categories, categoryCode])

  const filteredCategories = useMemo(() => {
    const q = usulSearchQuery.trim()
    if (!q) return categories
    const normQ = normalizeArabic(q).toLowerCase()
    return categories.filter(
      (c) =>
        c.nameAr.includes(q) ||
        normalizeArabic(c.nameAr).toLowerCase().includes(normQ) ||
        c.code.toLowerCase().includes(q.toLowerCase())
    )
  }, [categories, usulSearchQuery])

  const surahName = currentSurahNumber
    ? getMushaf1441SurahOption(currentSurahNumber)?.name ?? `سورة ${currentSurahNumber}`
    : ''

  // 1. Empty state when no word is selected
  if (!selectedWordKey && !selectedRow) {
    return (
      <aside
        dir="rtl"
        aria-label="محرر القراءات"
        className="flex h-full w-full min-w-0 flex-1 flex-col justify-between overflow-y-auto border-s border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:p-4 text-right select-none"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-6 text-center">
            <span className="text-4xl" role="img" aria-hidden="true">
              📖
            </span>
            <h3 className="mt-3 text-sm font-bold text-[var(--color-ink)]">
              اختر كلمة من المصحف للمراجعة أو الإضافة
            </h3>
            <p className="mt-1 text-xs text-[var(--color-ink-muted)] leading-relaxed">
              اضغط على أي كلمة ملونة لعرض قراءاتها واعتمادها بضغطة واحدة، أو على أي كلمة عادية لإضافة
              وجه قراءة أو أصل جديد.
            </p>
          </div>

          {/* Quick page statistics */}
          <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface)] p-4">
            <h4 className="text-xs font-bold text-[var(--color-ink)] border-b border-[var(--color-border-soft)] pb-2 mb-3">
              إحصائيات الصفحة {page.page}:
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between rounded-lg bg-[var(--color-surface-2)] px-2.5 py-1.5">
                <span className="text-[var(--color-ink-muted)]">إجمالي المواضع:</span>
                <span className="font-bold tabular-nums text-[var(--color-ink)]">
                  {page.stats.total}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-amber-50 px-2.5 py-1.5 text-amber-900">
                <span>غير مراجع:</span>
                <span className="font-bold tabular-nums">{page.stats.unreviewed}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-green-50 px-2.5 py-1.5 text-green-900">
                <span>مُعتمد ومراجع:</span>
                <span className="font-bold tabular-nums">{page.stats.reviewed}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-red-50 px-2.5 py-1.5 text-red-900">
                <span>معلَّم للمراجعة:</span>
                <span className="font-bold tabular-nums">{page.stats.flagged}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="text-[11px] text-[var(--color-ink-muted)] border-t border-[var(--color-border-soft)] pt-3 text-center">
          مصحف المدينة ١٤٤١ هـ · مراجعة القراءات العشر الكبرى
        </div>
      </aside>
    )
  }

  return (
    <aside
      dir="rtl"
      aria-label="محرر القراءات النشط"
      className="flex h-full w-full min-w-0 flex-1 flex-col overflow-y-auto border-s border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 sm:p-3 text-right"
    >
      {/* 1. Header & Hafs Word Display + Quick Actions (Compact Single Row) */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-quran text-2xl font-bold text-[var(--color-ink)] leading-none">
            ﴿{currentHafsText}﴾
          </span>
          <div className="flex items-center gap-1 text-[11px] text-[var(--color-ink-muted)] font-medium">
            <span className="font-bold text-[var(--color-ink)]">{surahName}</span>
            <span>·</span>
            <span>الآية {currentAyahNumber}</span>
            <span>·</span>
            <span>الكلمة {currentWordNumber}</span>
            <span>·</span>
            <span>ص {page.page}</span>
          </div>

          {selectedRow ? (
            <span
              className={cn(
                'rounded-full px-2 py-0.2 text-[10px] font-bold',
                selectedRow.reviewStatus === 'reviewed' && 'bg-green-100 text-green-800',
                selectedRow.reviewStatus === 'unreviewed' && 'bg-amber-100 text-amber-800',
                selectedRow.reviewStatus === 'flagged' && 'bg-red-100 text-red-800'
              )}
            >
              {STATUS_LABEL_AR[selectedRow.reviewStatus]}
            </span>
          ) : (
            <span className="rounded-full bg-blue-100 px-2 py-0.2 text-[10px] font-bold text-blue-800">
              + موضع جديد
            </span>
          )}
        </div>

        {/* Quick Actions in same row on desktop */}
        {selectedRow && !isAddMode ? (
          <div className="flex items-center gap-1 flex-wrap">
            <button
              type="button"
              onClick={() => onConfirmRow(selectedRow)}
              disabled={isSaving}
              className={cn(
                'flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer',
                selectedRow.reviewStatus === 'reviewed'
                  ? 'bg-green-700 text-white ring-2 ring-green-500/50'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              )}
            >
              <span>✓</span>
              <span>{selectedRow.reviewStatus === 'reviewed' ? 'مُعتمد' : 'اعتماد'}</span>
            </button>

            <button
              type="button"
              onClick={() => onFlagRow(selectedRow)}
              disabled={isSaving}
              className={cn(
                'rounded border px-1.5 py-0.5 text-xs font-bold transition-all disabled:opacity-50',
                selectedRow.reviewStatus === 'flagged'
                  ? 'border-red-600 bg-red-600 text-white'
                  : 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
              )}
              title="تعليم للمراجعة"
            >
              ⚑
            </button>

            <button
              type="button"
              onClick={handleSaveExisting}
              disabled={isSaving}
              className="rounded bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] px-2.5 py-0.5 text-xs font-bold text-white shadow-xs disabled:opacity-50"
            >
              حفظ
            </button>

            <button
              type="button"
              onClick={() => onDeleteRow(selectedRow)}
              disabled={isSaving}
              className="rounded border border-[var(--color-danger)]/40 px-1.5 py-0.5 text-xs font-bold text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] disabled:opacity-50"
              title="حذف الموضع"
            >
              🗑
            </button>

            <button
              type="button"
              onClick={openBulkApplyPanel}
              disabled={isSaving}
              title="تطبيق هذا الوجه على جميع مواضع نفس الكلمة"
              className="rounded border border-[var(--color-border)] px-2 py-0.5 text-[11px] font-bold text-[var(--color-ink-soft)] hover:border-[var(--color-primary)] disabled:opacity-50"
            >
              تطبيق على جميع المواضع
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCreate}
              disabled={isSaving || (kind === 'farsh' && !readingText.trim()) || (kind === 'usul' && !categoryCode) || narrators.length === 0}
              className="rounded bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] px-2.5 py-0.5 text-xs font-bold text-white shadow-sm disabled:opacity-40"
            >
              + إضافة للقاعدة
            </button>
            <button
              type="button"
              onClick={onCancelNewEntry}
              className="rounded border border-[var(--color-border)] px-2 py-0.5 text-xs font-bold text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-2)]"
            >
              إلغاء
            </button>
          </div>
        )}
      </div>

      {/* Multiple Variants Switcher (Compact Single Strip) */}
      {!isAddMode && activeRowsForWord.length > 0 ? (
        <div className="mt-1 space-y-1">
          {/* Feature 4: live summary of everything currently recorded for this word,
              updating immediately after every add/edit/delete. */}
          {activeRowsSummary ? (
            <p className="rounded-md bg-[var(--color-primary-soft)]/15 px-2 py-1 text-[10px] font-medium leading-relaxed text-[var(--color-ink-soft)]">
              <span className="font-bold text-[var(--color-ink)]">٣. الأوجه المسجلة — </span>
              {activeRowsSummary}
            </p>
          ) : null}
        <div className="flex flex-wrap items-center justify-between gap-1 rounded-md border border-[var(--color-border-soft)] bg-[var(--color-surface-2)]/30 px-2 py-1 text-xs">
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[10px] font-bold text-[var(--color-ink-muted)]">
              الأوجه:{multiSelectMode ? ` (${selectedForDelete.size})` : ''}
            </span>
            {multiSelectMode ? (
              <button
                type="button"
                onClick={() =>
                  setSelectedForDelete((prev) =>
                    prev.size === activeRowsForWord.length ? new Set() : new Set(activeRowsForWord.map((r) => r.entryId))
                  )
                }
                className="rounded border border-dashed border-[var(--color-border)] px-1 py-0.2 text-[10px] font-bold text-[var(--color-ink-muted)]"
              >
                {selectedForDelete.size === activeRowsForWord.length ? 'إلغاء' : 'الكل'}
              </button>
            ) : null}
            {activeRowsForWord.map((row, idx) => {
              const isSelected = selectedRow?.entryId === row.entryId
              const narratorDisplay = describeNarratorGroup(row.narrators)
              const narratorNames = narratorDisplay.map((n) => n.label).join('، ')
              return (
                <span key={row.entryId} className="inline-flex items-center gap-0.5">
                  {multiSelectMode ? (
                    <input
                      type="checkbox"
                      checked={selectedForDelete.has(row.entryId)}
                      onChange={() => toggleDeleteSelection(row.entryId)}
                      aria-label={`تحديد الوجه ${idx + 1} للحذف`}
                      className="h-3 w-3"
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => (multiSelectMode ? toggleDeleteSelection(row.entryId) : onSelectRow(row))}
                    className={cn(
                      'inline-flex flex-wrap items-center gap-1 rounded px-1.5 py-0.2 text-[11px] font-bold transition-all',
                      isSelected && !multiSelectMode
                        ? 'border border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-xs'
                        : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-2)]'
                    )}
                    title={narratorNames}
                  >
                    <span>{idx + 1}. </span>
                    <span>{row.kind === 'usul' ? row.categoryNameAr ?? 'أصل' : row.readingText}</span>
                    <NarratorBadges items={narratorDisplay} />
                  </button>
                </span>
              )
            })}
            {!multiSelectMode && selectedWordMeta ? (
              <button
                type="button"
                onClick={() => onStartNewEntry(selectedWordMeta)}
                className="rounded border border-dashed border-[var(--color-border)] px-1.5 py-0.2 text-[11px] font-bold text-[var(--color-primary)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]/20"
              >
                + إضافة وجه
              </button>
            ) : null}
            {multiSelectMode && selectedForDelete.size > 0 ? (
              <button
                type="button"
                onClick={confirmBulkDelete}
                disabled={isSaving}
                className="rounded bg-[var(--color-danger)] px-2 py-0.2 text-[10px] font-bold text-white shadow-xs disabled:opacity-50"
              >
                حذف ({selectedForDelete.size})
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-1">
            {!multiSelectMode ? (
              <button
                type="button"
                onClick={deleteAllForWord}
                disabled={isSaving}
                title="حذف كل الأوجه المسجلة على هذه الكلمة دفعة واحدة، ثم إضافتها من جديد"
                className="rounded border border-[var(--color-danger)]/40 px-1.5 py-0.2 text-[10px] font-bold text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] disabled:opacity-50"
              >
                حذف الكل
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setMultiSelectMode((v) => !v)
                setSelectedForDelete(new Set())
              }}
              className="rounded border border-[var(--color-border)] px-1.5 py-0.2 text-[10px] font-bold text-[var(--color-ink-soft)] hover:border-[var(--color-primary)]"
            >
              {multiSelectMode ? 'إلغاء' : 'تحديد للحذف'}
            </button>
            {selectedRow ? (
              <button
                type="button"
                onClick={() => openSameWordPanel(false)}
                className="rounded border border-[var(--color-border)] px-1.5 py-0.2 text-[10px] font-bold text-[var(--color-ink-soft)] hover:border-[var(--color-primary)]"
              >
                نسخ الوجه
              </button>
            ) : null}
            {selectedRow && selectedRow.reviewStatus !== 'reviewed' ? (
              <button
                type="button"
                onClick={() => openSameWordPanel(true)}
                title="البحث عن بيانات معتمدة لنفس الكلمة ونفس الباب لنسخها بدلاً من إعادة إدخالها"
                className="rounded border border-[var(--color-success)]/40 px-1.5 py-0.2 text-[10px] font-bold text-[var(--color-success)] hover:bg-[var(--color-success-bg)]"
              >
                ✓ تحقق من بيانات معتمدة
              </button>
            ) : null}
          </div>
        </div>
        </div>
      ) : null}

          {sameWordOpen ? (
            <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-2)]/30 p-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[var(--color-ink)]">
                  {sameWordLoading
                    ? 'جارٍ البحث…'
                    : previewMatch
                    ? 'معاينة قبل النسخ'
                    : 'تمت مراجعة هذه الكلمة سابقًا: نسخ الأوجه من موضع سابق'}
                </span>
                <button
                  type="button"
                  onClick={() => setSameWordOpen(false)}
                  className="text-xs text-[var(--color-ink-muted)]"
                >
                  إغلاق
                </button>
              </div>

              {!sameWordLoading && !previewMatch ? (
                <label className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--color-ink-muted)]">
                  <input
                    type="checkbox"
                    checked={verifiedOnlyFilter}
                    onChange={(e) => setVerifiedOnlyFilter(e.target.checked)}
                    className="h-3 w-3"
                  />
                  معتمدة فقط لنفس الباب
                </label>
              ) : null}

              {!sameWordLoading && !previewMatch ? (
                (() => {
                  const list = verifiedOnlyFilter ? verifiedSameCategoryMatches : sameWordMatches ?? []
                  if (list.length === 0) {
                    return (
                      <p className="text-[11px] text-[var(--color-ink-muted)]">
                        {verifiedOnlyFilter
                          ? 'لا توجد بيانات معتمدة لنفس الكلمة ونفس الباب.'
                          : 'لا توجد مواضع مراجَعة سابقًا لنفس الكلمة.'}
                      </p>
                    )
                  }
                  return list.map((m) => (
                    <div
                      key={m.entryId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[11px]"
                    >
                      <span className="inline-flex flex-wrap items-center gap-1">
                        ص{m.page} · {m.surah}:{m.ayah}:{m.startWord} · {labelForRow(m)} ·
                        <NarratorBadges items={describeNarratorGroup(m.narrators)} />
                      </span>
                      <button
                        type="button"
                        onClick={() => selectMatchForPreview(m)}
                        className="shrink-0 rounded-md bg-[var(--color-primary)] px-2 py-0.5 font-bold text-white"
                      >
                        نسخ إلى هذا الموضع
                      </button>
                    </div>
                  ))
                })()
              ) : null}

              {previewMatch ? (
                <div className="space-y-1.5 rounded-md border border-[var(--color-primary)]/40 bg-[var(--color-primary-soft)]/10 p-2 text-[11px]">
                  <p className="font-bold text-[var(--color-ink)]">
                    سيتم نسخها إلى: {selectedWordMeta ? `ص${selectedWordMeta.page} · ` : ''}
                    {currentSurahNumber}:{currentAyahNumber}:{currentWordNumber} · {currentHafsText}
                  </p>
                  <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5">
                    <p>
                      <span className="font-bold">{KIND_LABEL_AR[previewMatch.kind]}</span> · {labelForRow(previewMatch)}
                    </p>
                    <p className="inline-flex flex-wrap items-center gap-1 text-[var(--color-ink-muted)]">
                      الرواة: <NarratorBadges items={describeNarratorGroup(previewMatch.narrators)} />
                    </p>
                    {!(previewMatch.appliesWasl && previewMatch.appliesWaqf) ? (
                      <p className="text-[var(--color-ink-muted)]">
                        {previewMatch.appliesWasl ? 'الوصل فقط' : previewMatch.appliesWaqf ? 'الوقف فقط' : ''}
                      </p>
                    ) : null}
                    {previewMatch.hamzahDetail ? (
                      <p className="text-[var(--color-ink-muted)]">بيانات همز مفصّلة مرفقة</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={confirmCopyFromMatch}
                      disabled={isSaving}
                      className="rounded-md bg-[var(--color-primary)] px-2 py-1 font-bold text-white disabled:opacity-50"
                    >
                      تأكيد النسخ
                    </button>
                    <button
                      type="button"
                      onClick={cancelPreview}
                      className="rounded-md border border-[var(--color-border)] px-2 py-1 font-bold text-[var(--color-ink-muted)]"
                    >
                      رجوع
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {bulkApplyOpen ? (
        <div className="mt-2 space-y-1.5 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-2)]/30 p-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[var(--color-ink)]">
              {bulkApplyLoading ? 'جارٍ البحث عن مواضع الكلمة…' : `مواضع أخرى لنفس الكلمة: ${occurrences?.length ?? 0}`}
            </span>
            <button type="button" onClick={() => setBulkApplyOpen(false)} className="text-xs text-[var(--color-ink-muted)]">
              إغلاق
            </button>
          </div>
          {!bulkApplyLoading && occurrences ? (
            <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedOccurrences((prev) =>
                      prev.size === occurrences.length ? new Set() : new Set(occurrences.map((o) => o.canonicalKey))
                    )
                  }
                  className="rounded-md border border-dashed border-[var(--color-border)] px-2 py-0.5 text-[11px] font-bold text-[var(--color-ink-muted)]"
                >
                  {selectedOccurrences.size === occurrences.length ? 'إلغاء التحديد' : 'تحديد الكل'}
                </button>
                <span className="text-[11px] text-[var(--color-ink-muted)]">
                  سيتم تطبيق هذا الوجه على {selectedOccurrences.size} موضعًا. موجود مسبقًا: {occurrences.filter((o) => o.status === 'exists').length}.
                </span>
              </div>
              <div className="max-h-56 overflow-y-auto space-y-1">
                {occurrences.map((o) => (
                  <label
                    key={o.canonicalKey}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-[11px]',
                      o.status === 'exists'
                        ? 'border-amber-300 bg-amber-50 text-amber-900'
                        : 'border-[var(--color-border)] bg-[var(--color-surface)]'
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={selectedOccurrences.has(o.canonicalKey)}
                        onChange={() => toggleOccurrence(o.canonicalKey)}
                      />
                      ص{o.page} · {o.surah}:{o.ayah}:{o.word} · {o.text}
                    </span>
                    <span className="shrink-0 font-bold">{o.status === 'exists' ? 'موجود مسبقًا' : 'سيُضاف'}</span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={confirmBulkApply}
                disabled={isSaving || selectedOccurrences.size === 0}
                className="w-full rounded-md bg-[var(--color-primary)] px-2.5 py-1.5 text-xs font-bold text-white shadow-xs disabled:opacity-50"
              >
                تطبيق على {selectedOccurrences.size} موضعًا
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {/* Status Messages */}
      {saveMessage ? (
        <div className="mt-2 rounded-md bg-green-50 border border-green-200 p-2 text-xs font-bold text-green-800">
          {saveMessage}
        </div>
      ) : null}
      {errorMessage ? (
        <div className="mt-2 rounded-md bg-red-50 border border-red-200 p-2 text-xs font-bold text-red-800">
          {errorMessage}
        </div>
      ) : null}

      {/* 2. Main Responsive Layout on Desktop */}
      {kind === 'usul' && (isHamzahCategory(categoryCode) || isImalahCategory(categoryCode)) ? (
        <div className="mt-1.5 space-y-1.5">
          {/* Kind Toggle & Performance status in one compact header row */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 px-2.5 py-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-[var(--color-ink)]">نوع الموضع:</span>
              <div className="inline-flex rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-0.5">
                <button
                  type="button"
                  onClick={() => setKind('farsh')}
                  className={cn(
                    'rounded px-2.5 py-0.5 text-[11px] font-bold transition-all',
                    (kind as string) === 'farsh' ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow-xs' : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
                  )}
                >
                  فرش الحروف
                </button>
                <button
                  type="button"
                  onClick={() => setKind('usul')}
                  className={cn(
                    'rounded px-2.5 py-0.5 text-[11px] font-bold transition-all',
                    (kind as string) === 'usul' ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow-xs' : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
                  )}
                >
                  أصول القراءات
                </button>
              </div>
            </div>

            {/* Wasl / Waqf Quick Badges */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[11px] font-bold text-[var(--color-ink-muted)]">حالة الأداء:</span>
              <button
                type="button"
                aria-pressed={appliesWasl}
                disabled={isSaving}
                onClick={() => {
                  if (appliesWasl && !appliesWaqf) return
                  setAppliesWasl((v) => !v)
                }}
                className={cn(
                  'rounded px-2 py-0.2 text-[11px] font-bold border transition-all',
                  appliesWasl ? 'border-green-600 bg-green-50 text-green-800' : 'border-[var(--color-border)] text-[var(--color-ink-muted)]'
                )}
              >
                {appliesWasl ? '✓ ' : ''}الوصل
              </button>
              <button
                type="button"
                aria-pressed={appliesWaqf}
                disabled={isSaving}
                onClick={() => {
                  if (appliesWaqf && !appliesWasl) return
                  setAppliesWaqf((v) => !v)
                }}
                className={cn(
                  'rounded px-2 py-0.2 text-[11px] font-bold border transition-all',
                  appliesWaqf ? 'border-green-600 bg-green-50 text-green-800' : 'border-[var(--color-border)] text-[var(--color-ink-muted)]'
                )}
              >
                {appliesWaqf ? '✓ ' : ''}الوقف
              </button>
            </div>
          </div>

          {/* Specialized Usul Builder (Hamzah or Imalah) */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-2xs">
            <UsulRuleGrid
              selectedCategoryCode={categoryCode}
              onSelectCategory={setCategoryCode}
              readingText={readingText}
              onChangeReadingText={setReadingText}
              rulingText={rulingText}
              onChangeRulingText={setRulingText}
              availableCategories={page.categories}
              appliesWasl={appliesWasl}
              onChangeAppliesWasl={setAppliesWasl}
              appliesWaqf={appliesWaqf}
              onChangeAppliesWaqf={setAppliesWaqf}
              narrators={narrators}
              onChangeNarrators={setNarrators}
              hamzahDetail={hamzahDetail}
              onChangeHamzahDetail={setHamzahDetail}
              disabled={isSaving}
              spanStart={spanStart}
              spanEnd={spanEnd}
            />
          </div>
        </div>
      ) : (
        /* Farsh or Standard Usul: 3-Box Side-by-Side Compact Layout */
        <div className="mt-1.5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 items-stretch">
          {/* BOX 1: Classification & Performance */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-2xs flex flex-col justify-between gap-2 min-h-[260px]">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] pb-1">
                <span className="text-xs font-bold text-[var(--color-ink)]">١. نوع الموضع والضابط</span>
                <span className="rounded bg-[var(--color-surface-2)] px-1.5 py-0.2 text-[10px] font-bold text-[var(--color-ink-muted)]">
                  {kind === 'farsh' ? 'فرش' : 'أصول'}
                </span>
              </div>

              {/* Kind Toggle */}
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-0.5">
                <button
                  type="button"
                  onClick={() => setKind('farsh')}
                  className={cn(
                    'rounded-md py-0.5 text-xs font-bold transition-all',
                    kind === 'farsh'
                      ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow-xs'
                      : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
                  )}
                >
                  فرش الحروف
                </button>
                <button
                  type="button"
                  onClick={() => setKind('usul')}
                  className={cn(
                    'rounded-md py-0.5 text-xs font-bold transition-all',
                    kind === 'usul'
                      ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow-xs'
                      : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
                  )}
                >
                  أصول القراءات
                </button>
              </div>

              {kind === 'farsh' ? (
                /* Variant Type Chips */
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[var(--color-ink)]">نوع الاختلاف:</label>
                  <div className="grid grid-cols-2 gap-1">
                    {CANONICAL_VARIANT_TYPES.map((t) => {
                      const normSelected = normalizeVariantType(variantType)
                      const isSelected = normSelected === t.dbEnum
                      return (
                        <button
                          key={t.code}
                          type="button"
                          onClick={() => setVariantType(t.dbEnum)}
                          disabled={isSaving}
                          className={cn(
                            'rounded px-1.5 py-1 text-[11px] font-medium transition-all text-center select-none truncate',
                            isSelected
                              ? 'border border-[var(--color-primary)] bg-[var(--color-primary)] font-bold text-white shadow-xs'
                              : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-soft)] hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-surface-2)]'
                          )}
                          title={t.label}
                        >
                          {t.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                /* Standard Usul Category Picker */
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-[var(--color-ink)]">باب الأصول:</label>
                    {categoryCode && !showAllUsulCategories ? (
                      <button
                        type="button"
                        onClick={() => setShowAllUsulCategories(true)}
                        className="text-[10px] font-bold text-[var(--color-primary)] hover:underline"
                      >
                        تغيير ▾
                      </button>
                    ) : null}
                  </div>

                  {categoryCode && !showAllUsulCategories ? (
                    <div className="flex items-center justify-between rounded-lg border border-[var(--color-primary)]/40 bg-[var(--color-primary-soft)]/20 px-2 py-1 text-xs">
                      <span className="font-bold text-[var(--color-primary)] truncate">
                        {selectedCategory?.nameAr ?? categoryCode}
                      </span>
                      <span className="text-green-700 font-bold text-[10px]">✓</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <input
                        type="search"
                        value={usulSearchQuery}
                        onChange={(e) => setUsulSearchQuery(e.target.value)}
                        placeholder="بحث في الأبواب..."
                        className="h-6 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[11px] text-[var(--color-ink)] focus:ring-1 focus:ring-[var(--color-primary)]"
                      />
                      <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto p-1 rounded-md border border-[var(--color-border-soft)] bg-[var(--color-surface-2)]/20">
                        {filteredCategories.map((c) => {
                          const isSel = categoryCode === c.code
                          return (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => {
                                setCategoryCode(c.code)
                                setShowAllUsulCategories(false)
                              }}
                              className={cn(
                                'flex items-center justify-between rounded px-1.5 py-0.5 text-right text-[11px] truncate',
                                isSel
                                  ? 'bg-[var(--color-primary)] font-bold text-white'
                                  : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-2)]'
                              )}
                            >
                              <span className="truncate">{c.nameAr}</span>
                              {isSel ? <span className="text-[10px]">✓</span> : null}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Wasl/Waqf applicability at bottom of Box 1 */}
            <div className="flex items-center justify-between gap-1.5 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-2)]/30 p-1.5">
              <span className="text-[11px] font-bold text-[var(--color-ink)]">حالة الأداء:</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  aria-pressed={appliesWasl}
                  disabled={isSaving}
                  onClick={() => {
                    if (appliesWasl && !appliesWaqf) return
                    setAppliesWasl((v) => !v)
                  }}
                  className={cn(
                    'rounded px-2.5 py-0.5 text-xs font-bold border transition-all',
                    appliesWasl ? 'border-green-600 bg-green-50 text-green-800' : 'border-[var(--color-border)] text-[var(--color-ink-muted)]'
                  )}
                >
                  {appliesWasl ? '✓ ' : ''}الوصل
                </button>
                <button
                  type="button"
                  aria-pressed={appliesWaqf}
                  disabled={isSaving}
                  onClick={() => {
                    if (appliesWaqf && !appliesWasl) return
                    setAppliesWaqf((v) => !v)
                  }}
                  className={cn(
                    'rounded px-2.5 py-0.5 text-xs font-bold border transition-all',
                    appliesWaqf ? 'border-green-600 bg-green-50 text-green-800' : 'border-[var(--color-border)] text-[var(--color-ink-muted)]'
                  )}
                >
                  {appliesWaqf ? '✓ ' : ''}الوقف
                </button>
              </div>
            </div>
          </div>

          {/* BOX 2: Reading Text & Explanations */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-2xs flex flex-col gap-2 min-h-[260px]">
            <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] pb-1">
              <span className="text-xs font-bold text-[var(--color-ink)]">٢. نص القراءة والبيان</span>
              <span className="text-[10px] text-[var(--color-ink-muted)]">مع الضبط والشكل</span>
            </div>

            {/* Reading Text */}
            <div>
              <label className="text-[11px] font-bold text-[var(--color-ink)]">نص الكلمة المقروء به:</label>
              <input
                type="text"
                value={readingText}
                onChange={(e) => setReadingText(e.target.value)}
                disabled={isSaving}
                placeholder="اكتب نص الكلمة في هذه القراءة..."
                dir="rtl"
                className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 font-quran text-xl text-[var(--color-ink)] placeholder:font-sans placeholder:text-xs placeholder:text-[var(--color-ink-muted)]/60 focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>

            {nquranRanked ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50/60 dark:bg-amber-950/20">
                <button
                  type="button"
                  onClick={() => setNquranPanelOpen((v) => !v)}
                  className="flex w-full items-center justify-between gap-2 px-2 py-1"
                >
                  <span className="text-[11px] font-bold text-amber-900 dark:text-amber-300">
                    📖 مرجع خارجي (nquran.com) — فروق القراءات في هذه الآية
                  </span>
                  <span className="text-[10px] text-amber-800 dark:text-amber-400">
                    {nquranPanelOpen ? 'إخفاء ▲' : `عرض (${nquranRanked.ranked.length}) ▼`}
                  </span>
                </button>
                {nquranPanelOpen ? (
                  <div className="flex flex-col gap-1.5 border-t border-amber-200 px-2 pb-2 pt-1.5 max-h-64 overflow-y-auto">
                    <p className="text-[9px] text-amber-800/80 dark:text-amber-400/80">
                      مرجع للاطّلاع فقط — غير معتمد تلقائيًا، ولا يُنسخ إلى الحقول أعلاه إلا بمراجعة يدوية.
                    </p>
                    {nquranRanked.ranked.map(({ difference, matchesWord }, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          'rounded-md border p-1.5',
                          matchesWord
                            ? 'border-amber-500 bg-amber-100/80 dark:bg-amber-900/30'
                            : 'border-amber-200/70 bg-white/60 dark:bg-transparent'
                        )}
                      >
                        <p className="font-quran text-base text-[var(--color-ink)]" dir="rtl">
                          ﴿{difference.location}﴾
                        </p>
                        <div className="mt-1 flex flex-col gap-1">
                          {resolveDifferenceGroups(difference).map((resolved, gIdx) => {
                            const decision = matchesWord
                              ? proposeNquranDecision(resolved, activeRowsForWord)
                              : null
                            const badge = decision ? NQURAN_DECISION_BADGES[decision.status] : null
                            return (
                              <div key={gIdx} className="text-[10px] leading-snug">
                                <div className="flex flex-wrap items-center gap-1">
                                  <span className="font-bold text-amber-900 dark:text-amber-300">
                                    {resolved.group.readers.join('، ')}:
                                  </span>
                                  {badge ? (
                                    <span
                                      title={
                                        decision?.matchedRow
                                          ? `مقارنةً بوجه ${STATUS_LABEL_AR[decision.matchedRow.reviewStatus]} مسجّل لهذه الكلمة`
                                          : undefined
                                      }
                                      className={cn('rounded px-1 py-px text-[9px] font-bold', badge.className)}
                                    >
                                      {badge.label}
                                    </span>
                                  ) : null}
                                </div>
                                <span className="text-[var(--color-ink-muted)]">{resolved.group.reading}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                    <a
                      href={nquranRanked.entry.sourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-[9px] text-amber-700 underline dark:text-amber-500"
                    >
                      المصدر: nquran.com ↗
                    </a>
                  </div>
                ) : null}
              </div>
            ) : null}

            {kind === 'farsh' ? (
              <>
                {/* Description */}
                <div>
                  <label className="text-[10px] font-bold text-[var(--color-ink-muted)]">
                    بيان الفرق (اختياري):
                  </label>
                  <input
                    type="text"
                    value={description ?? ''}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isSaving}
                    placeholder="مثال: بضم الياء، بكسر التاء..."
                    className="mt-0.5 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-xs text-[var(--color-ink)] focus:border-[var(--color-primary)] focus:outline-none"
                  />
                </div>

                {/* Performance note */}
                <div>
                  <label className="text-[10px] font-bold text-[var(--color-ink-muted)]">
                    ملاحظة الأداء (اختياري):
                  </label>
                  <input
                    type="text"
                    value={performanceNote ?? ''}
                    onChange={(e) => setPerformanceNote(e.target.value)}
                    disabled={isSaving}
                    placeholder="مثال: وصلًا ووقفًا، يختص بالوقف..."
                    className="mt-0.5 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-xs text-[var(--color-ink)] focus:border-[var(--color-primary)] focus:outline-none"
                  />
                </div>
              </>
            ) : (
              /* Usul Ruling Text */
              <div>
                <label className="text-[10px] font-bold text-[var(--color-ink-muted)]">
                  بيان الحكم أو الضابط (اختياري):
                </label>
                <textarea
                  rows={4}
                  value={rulingText ?? ''}
                  onChange={(e) => setRulingText(e.target.value)}
                  disabled={isSaving}
                  placeholder="مثال: صلة هاء الكناية بحركتين، نقل حركة الهمزة..."
                  className="mt-0.5 w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-ink)] focus:border-[var(--color-primary)] focus:outline-none resize-none"
                />
              </div>
            )}
          </div>

          {/* BOX 3: Readers, Narrators & Multi-Wajh Management */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-2xs flex flex-col gap-1.5 min-h-[260px]">
            <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] pb-1">
              <span className="text-xs font-bold text-[var(--color-ink)]">٣. القراء والرواة والأوجه</span>
              <span className="text-[10px] font-bold text-amber-900 dark:text-amber-300">
                {narrators.length} منسوب لهم
              </span>
            </div>
            <ReaderNarratorSelector
              narrators={narrators}
              onChange={setNarrators}
              disabled={isSaving}
            />
          </div>
        </div>
      )}
    </aside>
  )
}
