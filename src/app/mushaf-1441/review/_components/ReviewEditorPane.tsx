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
import UsulRuleGrid from './UsulRuleGrid'
import FarshFields from './FarshFields'
import HamzahDetailFields, { isHamzahCategory } from './HamzahDetailFields'
import { STATUS_LABEL_AR, KIND_LABEL_AR } from './statusMeta'
import { cn } from '@/lib/cn'
import * as reviewApi from '../_lib/api'

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
  // Local edit draft for existing row
  const [kind, setKind] = useState<'farsh' | 'usul'>('farsh')
  const [categoryCode, setCategoryCode] = useState<string | null>(null)
  const [readingText, setReadingText] = useState('')
  const [variantType, setVariantType] = useState<string | null>(null)
  const [rulingText, setRulingText] = useState<string | null>(null)
  const [description, setDescription] = useState<string | null>(null)
  const [performanceNote, setPerformanceNote] = useState<string | null>(null)
  const [narrators, setNarrators] = useState<NarratorInput[]>([])
  const [appliesWasl, setAppliesWasl] = useState(true)
  const [appliesWaqf, setAppliesWaqf] = useState(true)
  const [hamzahDetail, setHamzahDetail] = useState<HamzahDetail | null>(null)

  // Multi-select delete (feature 1)
  const [multiSelectMode, setMultiSelectMode] = useState(false)
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set())

  // Same-word verified-config copy (feature 3)
  const [sameWordOpen, setSameWordOpen] = useState(false)
  const [sameWordLoading, setSameWordLoading] = useState(false)
  const [sameWordMatches, setSameWordMatches] = useState<SameWordMatch[] | null>(null)

  // Apply-to-all-occurrences (feature 7)
  const [bulkApplyOpen, setBulkApplyOpen] = useState(false)
  const [bulkApplyLoading, setBulkApplyLoading] = useState(false)
  const [occurrences, setOccurrences] = useState<OccurrenceCandidate[] | null>(null)
  const [selectedOccurrences, setSelectedOccurrences] = useState<Set<string>>(new Set())

  // New entry draft local state
  const isAddMode = Boolean(newEntryDraft)

  // Synchronize when selectedRow changes
  useEffect(() => {
    if (selectedRow) {
      setKind(selectedRow.kind)
      setCategoryCode(selectedRow.categoryCode)
      setReadingText(selectedRow.readingText ?? selectedRow.hafsText ?? '')
      setVariantType(selectedRow.variantType)
      setRulingText(selectedRow.rulingText)
      setDescription(selectedRow.description)
      setPerformanceNote(selectedRow.performanceNote)
      setAppliesWasl(selectedRow.appliesWasl)
      setAppliesWaqf(selectedRow.appliesWaqf)
      setHamzahDetail(selectedRow.hamzahDetail)
      setNarrators(
        selectedRow.narrators.map((n) => ({
          id: n.id,
          action: n.action,
          wajhOrder: n.wajhOrder,
          wajhNote: n.wajhNote,
        }))
      )
    }
  }, [selectedRow])

  // Synchronize when newEntryDraft changes
  useEffect(() => {
    if (newEntryDraft) {
      setKind(newEntryDraft.kind)
      setCategoryCode(newEntryDraft.categoryCode ?? null)
      setReadingText(newEntryDraft.readingText ?? newEntryDraft.uthmaniText ?? '')
      setVariantType(newEntryDraft.variantType ?? 'تشكيل')
      setRulingText(newEntryDraft.rulingText ?? null)
      setDescription(newEntryDraft.description ?? null)
      setPerformanceNote(newEntryDraft.performanceNote ?? null)
      setAppliesWasl(true)
      setAppliesWaqf(true)
      setHamzahDetail(null)
      setNarrators(newEntryDraft.narrators ?? [])
    }
  }, [newEntryDraft])

  // Reset the transient bulk/copy panels whenever the selected word changes.
  useEffect(() => {
    setMultiSelectMode(false)
    setSelectedForDelete(new Set())
    setSameWordOpen(false)
    setSameWordMatches(null)
    setBulkApplyOpen(false)
    setOccurrences(null)
    setSelectedOccurrences(new Set())
  }, [selectedWordKey])

  // Context metadata
  const currentSurahNumber = selectedRow?.surah ?? selectedWordMeta?.surah ?? null
  const currentAyahNumber = selectedRow?.ayah ?? selectedWordMeta?.ayah ?? null
  const currentWordNumber = selectedRow?.startWord ?? selectedWordMeta?.word ?? null
  const currentHafsText = selectedRow?.hafsText ?? selectedWordMeta?.text ?? ''
  const surahName = currentSurahNumber
    ? getMushaf1441SurahOption(currentSurahNumber)?.name ?? `سورة ${currentSurahNumber}`
    : ''

  function handleSaveExisting() {
    if (!selectedRow) return
    const fields: EntryFields = {
      readingText: kind === 'farsh' ? readingText.trim() : selectedRow.hafsText,
      categoryCode: kind === 'usul' && categoryCode ? categoryCode : undefined,
      variantType: kind === 'farsh' && variantType ? variantType : undefined,
      rulingText: kind === 'usul' ? rulingText?.trim() || null : null,
      description: description?.trim() || null,
      performanceNote: performanceNote?.trim() || null,
      appliesWasl,
      appliesWaqf,
      hamzahDetail: kind === 'usul' && isHamzahCategory(categoryCode) ? hamzahDetail : null,
    }
    void onSaveRowEdits(selectedRow, fields, narrators)
  }

  function handleCreate() {
    if (!newEntryDraft) return
    const draft: CreateEntryInput = {
      ...newEntryDraft,
      kind,
      readingText: kind === 'farsh' ? readingText.trim() : undefined,
      categoryCode: kind === 'usul' && categoryCode ? categoryCode : undefined,
      variantType: kind === 'farsh' && variantType ? variantType : undefined,
      rulingText: kind === 'usul' ? rulingText?.trim() || null : null,
      description: description?.trim() || null,
      performanceNote: performanceNote?.trim() || null,
      narrators,
    }
    void onCreateNewEntry(draft)
  }

  // Feature 1: multi-select delete over "الأوجه المسجلة"
  function toggleDeleteSelection(entryId: string) {
    setSelectedForDelete((prev) => {
      const next = new Set(prev)
      if (next.has(entryId)) next.delete(entryId)
      else next.add(entryId)
      return next
    })
  }

  async function confirmBulkDelete() {
    const rows = activeRowsForWord.filter((r) => selectedForDelete.has(r.entryId))
    if (rows.length === 0) return
    const narratorSummary = rows
      .map((r) => r.narrators.map((n) => n.nameAr).join('، ') || (r.kind === 'usul' ? r.categoryNameAr ?? 'أصل' : r.readingText ?? ''))
      .join(' | ')
    if (
      !window.confirm(
        `سيتم حذف ${rows.length} أوجه مسجلة لهذه الكلمة (${narratorSummary}). هل تريد المتابعة؟`
      )
    ) {
      return
    }
    await onBulkDelete(rows, 'حذف جماعي من شاشة المراجعة')
    setMultiSelectMode(false)
    setSelectedForDelete(new Set())
  }

  // Feature 3: same-word verified-config copy
  async function openSameWordPanel() {
    if (!currentSurahNumber || !currentAyahNumber || !currentWordNumber) return
    setSameWordOpen(true)
    setSameWordLoading(true)
    const result = await reviewApi.findSameWord({
      surah: currentSurahNumber,
      ayah: currentAyahNumber,
      word: currentWordNumber,
      excludeLocusId: selectedRow?.locationId ?? null,
    })
    setSameWordLoading(false)
    setSameWordMatches(result.ok ? result.data : [])
  }

  async function copyFromMatch(match: SameWordMatch) {
    if (!currentSurahNumber || !currentAyahNumber || !currentWordNumber) return
    await onCopyToOccurrence(match.entryId, {
      surah: currentSurahNumber,
      ayah: currentAyahNumber,
      startWord: currentWordNumber,
    })
    setSameWordOpen(false)
  }

  // Feature 7: apply to all occurrences of the same word
  async function openBulkApplyPanel() {
    if (!selectedRow) return
    setBulkApplyOpen(true)
    setBulkApplyLoading(true)
    const result = await reviewApi.findOccurrences(selectedRow.entryId)
    setBulkApplyLoading(false)
    if (result.ok) {
      setOccurrences(result.data)
      setSelectedOccurrences(new Set(result.data.filter((o) => o.status === 'add').map((o) => o.canonicalKey)))
    } else {
      setOccurrences([])
    }
  }

  function toggleOccurrence(key: string) {
    setSelectedOccurrences((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function confirmBulkApply() {
    if (!selectedRow || !occurrences) return
    const targets = occurrences
      .filter((o) => selectedOccurrences.has(o.canonicalKey))
      .map((o) => ({ surah: o.surah, ayah: o.ayah, word: o.word }))
    if (targets.length === 0) return
    const result = await onBulkApply(selectedRow.entryId, targets)
    if (result) setBulkApplyOpen(false)
  }

  // 1. Empty state when no word is selected
  if (!selectedWordKey && !selectedRow) {
    return (
      <aside
        dir="rtl"
        aria-label="محرر القراءات"
        className="flex h-full w-full min-w-[340px] md:w-[480px] lg:w-[560px] xl:w-[740px] 2xl:w-[840px] shrink-0 flex-col justify-between overflow-y-auto border-s border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5 text-right select-none"
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
      className="flex h-full w-full min-w-[340px] md:w-[480px] lg:w-[560px] xl:w-[740px] 2xl:w-[840px] shrink-0 flex-col overflow-y-auto border-s border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:p-4 text-right"
    >
      {/* 1. Header & Hafs Word Display + Quick Actions */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/30 p-2.5 sm:p-3 space-y-2">
        <div className="flex items-center justify-between text-xs text-[var(--color-ink-muted)] font-medium">
          <div className="flex items-center gap-1.5 flex-wrap">
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
                'rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                selectedRow.reviewStatus === 'reviewed' && 'bg-green-100 text-green-800',
                selectedRow.reviewStatus === 'unreviewed' && 'bg-amber-100 text-amber-800',
                selectedRow.reviewStatus === 'flagged' && 'bg-red-100 text-red-800'
              )}
            >
              {STATUS_LABEL_AR[selectedRow.reviewStatus]}
            </span>
          ) : (
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
              + موضع جديد
            </span>
          )}
        </div>

        {/* Word Box & Action Bar Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-3 py-1.5">
          <div className="flex items-baseline gap-2">
            <span className="font-quran text-2xl sm:text-3xl font-bold text-[var(--color-ink)]">
              ﴿{currentHafsText}﴾
            </span>
            <span className="text-[10px] text-[var(--color-ink-muted)]">
              رواية حفص عن عاصم
            </span>
          </div>

          {/* Quick Actions in same row on desktop */}
          {selectedRow && !isAddMode ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => onConfirmRow(selectedRow)}
                disabled={isSaving}
                className={cn(
                  'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer',
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
                  'rounded-md border px-2 py-1 text-xs font-bold transition-all disabled:opacity-50',
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
                className="rounded-md bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] px-2.5 py-1 text-xs font-bold text-white shadow-xs disabled:opacity-50"
              >
                حفظ
              </button>

              <button
                type="button"
                onClick={() => onDeleteRow(selectedRow)}
                disabled={isSaving}
                className="rounded-md border border-[var(--color-danger)]/40 px-2 py-1 text-xs font-bold text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] disabled:opacity-50"
                title="حذف الموضع"
              >
                🗑
              </button>

              <button
                type="button"
                onClick={openBulkApplyPanel}
                disabled={isSaving}
                title="تطبيق هذا الوجه على جميع مواضع نفس الكلمة"
                className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs font-bold text-[var(--color-ink-soft)] hover:border-[var(--color-primary)] disabled:opacity-50"
              >
                تطبيق على جميع المواضع
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCreate}
                disabled={isSaving || (kind === 'farsh' && !readingText.trim()) || (kind === 'usul' && !categoryCode) || narrators.length === 0}
                className="rounded-md bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] px-3 py-1 text-xs font-bold text-white shadow-sm disabled:opacity-40"
              >
                + إضافة للقاعدة
              </button>
              <button
                type="button"
                onClick={onCancelNewEntry}
                className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-bold text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-2)]"
              >
                إلغاء
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Multiple Variants Switcher (when word has >1 entries, or adding another) */}
      {!isAddMode && activeRowsForWord.length > 0 ? (
        <div className="mt-2 space-y-1.5 border-b border-[var(--color-border-soft)] pb-2">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <span className="text-[11px] font-bold text-[var(--color-ink-muted)]">
              الأوجه المسجلة:{multiSelectMode ? ` تم تحديد ${selectedForDelete.size} أوجه` : ''}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setMultiSelectMode((v) => !v)
                  setSelectedForDelete(new Set())
                }}
                className="rounded-md border border-[var(--color-border)] px-2 py-0.5 text-[11px] font-bold text-[var(--color-ink-soft)] hover:border-[var(--color-primary)]"
              >
                {multiSelectMode ? 'إلغاء التحديد' : 'تحديد للحذف'}
              </button>
              {selectedRow ? (
                <button
                  type="button"
                  onClick={openSameWordPanel}
                  className="rounded-md border border-[var(--color-border)] px-2 py-0.5 text-[11px] font-bold text-[var(--color-ink-soft)] hover:border-[var(--color-primary)]"
                >
                  نسخ الوجه
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {multiSelectMode ? (
              <button
                type="button"
                onClick={() =>
                  setSelectedForDelete((prev) =>
                    prev.size === activeRowsForWord.length ? new Set() : new Set(activeRowsForWord.map((r) => r.entryId))
                  )
                }
                className="rounded-md border border-dashed border-[var(--color-border)] px-2 py-0.5 text-xs font-bold text-[var(--color-ink-muted)]"
              >
                {selectedForDelete.size === activeRowsForWord.length ? 'إلغاء التحديد' : 'تحديد الكل'}
              </button>
            ) : null}
            {activeRowsForWord.map((row, idx) => {
              const isSelected = selectedRow?.entryId === row.entryId
              const narratorNames = row.narrators.map((n) => n.nameAr).join('، ')
              return (
                <span key={row.entryId} className="inline-flex items-center gap-1">
                  {multiSelectMode ? (
                    <input
                      type="checkbox"
                      checked={selectedForDelete.has(row.entryId)}
                      onChange={() => toggleDeleteSelection(row.entryId)}
                      aria-label={`تحديد الوجه ${idx + 1} للحذف`}
                      className="h-3.5 w-3.5"
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => (multiSelectMode ? toggleDeleteSelection(row.entryId) : onSelectRow(row))}
                    className={cn(
                      'rounded-md px-2 py-0.5 text-xs font-bold transition-all',
                      isSelected && !multiSelectMode
                        ? 'border border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-xs'
                        : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-2)]'
                    )}
                    title={narratorNames}
                  >
                    <span>{idx + 1}. </span>
                    <span>{row.kind === 'usul' ? row.categoryNameAr ?? 'أصل' : row.readingText}</span>
                  </button>
                </span>
              )
            })}
            {!multiSelectMode && selectedWordMeta ? (
              <button
                type="button"
                onClick={() => onStartNewEntry(selectedWordMeta)}
                className="rounded-md border border-dashed border-[var(--color-border)] px-2 py-0.5 text-xs font-bold text-[var(--color-primary)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]/20"
              >
                + إضافة وجه
              </button>
            ) : null}
          </div>

          {multiSelectMode && selectedForDelete.size > 0 ? (
            <button
              type="button"
              onClick={confirmBulkDelete}
              disabled={isSaving}
              className="rounded-md bg-[var(--color-danger)] px-2.5 py-1 text-xs font-bold text-white shadow-xs disabled:opacity-50"
            >
              حذف المحدد ({selectedForDelete.size})
            </button>
          ) : null}

          {sameWordOpen ? (
            <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-2)]/30 p-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[var(--color-ink)]">
                  {sameWordLoading ? 'جارٍ البحث…' : 'تمت مراجعة هذه الكلمة سابقًا: نسخ الأوجه من موضع سابق'}
                </span>
                <button type="button" onClick={() => setSameWordOpen(false)} className="text-xs text-[var(--color-ink-muted)]">
                  إغلاق
                </button>
              </div>
              {!sameWordLoading && sameWordMatches && sameWordMatches.length === 0 ? (
                <p className="text-[11px] text-[var(--color-ink-muted)]">لا توجد مواضع مراجَعة سابقًا لنفس الكلمة.</p>
              ) : null}
              {sameWordMatches?.map((m) => (
                <div key={m.entryId} className="flex items-center justify-between gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[11px]">
                  <span>
                    ص{m.page} · {m.surah}:{m.ayah}:{m.startWord} ·{' '}
                    {m.kind === 'usul' ? m.categoryNameAr ?? 'أصل' : m.readingText} ·{' '}
                    {m.narrators.map((n) => n.nameAr).join('، ')}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyFromMatch(m)}
                    disabled={isSaving}
                    className="shrink-0 rounded-md bg-[var(--color-primary)] px-2 py-0.5 font-bold text-white disabled:opacity-50"
                  >
                    نسخ إلى هذا الموضع
                  </button>
                </div>
              ))}
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

      {/* 2. Main 2-Column Responsive Layout on Desktop */}
      <div className="mt-2.5 grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
        {/* Column 1: Kind Toggle + Sub-editor (Farsh / Usul) */}
        <div className="space-y-2">
          {/* Kind Toggle */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-[var(--color-ink)]">نوع الموضع:</label>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-0.5">
              <button
                type="button"
                onClick={() => setKind('farsh')}
                className={cn(
                  'rounded-md py-1 text-xs font-bold transition-all',
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
                  'rounded-md py-1 text-xs font-bold transition-all',
                  kind === 'usul'
                    ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow-xs'
                    : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
                )}
              >
                أصول القراءات
              </button>
            </div>
          </div>

          {/* Sub-Editor Container */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-2xs">
            {kind === 'usul' ? (
              <UsulRuleGrid
                selectedCategoryCode={categoryCode}
                onSelectCategory={setCategoryCode}
                rulingText={rulingText}
                onChangeRulingText={setRulingText}
                availableCategories={page.categories}
              />
            ) : (
              <FarshFields
                readingText={readingText}
                onChangeReadingText={setReadingText}
                variantType={variantType}
                onChangeVariantType={setVariantType}
                description={description}
                onChangeDescription={setDescription}
                performanceNote={performanceNote}
                onChangePerformanceNote={setPerformanceNote}
              />
            )}
          </div>

          {/* Hamzah structured controls (feature 4): only for the relevant Usul chapters */}
          {kind === 'usul' ? (
            <HamzahDetailFields
              categoryCode={categoryCode}
              value={hamzahDetail}
              onChange={setHamzahDetail}
              disabled={isSaving}
            />
          ) : null}

          {/* Wasl/Waqf applicability (feature 5) */}
          <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-2)]/30 p-2">
            <span className="text-[11px] font-bold text-[var(--color-ink)]">حالة الأداء:</span>
            <div className="flex gap-1.5">
              <button
                type="button"
                aria-pressed={appliesWasl}
                disabled={isSaving}
                onClick={() => {
                  // Never allow both to end up unchecked.
                  if (appliesWasl && !appliesWaqf) return
                  setAppliesWasl((v) => !v)
                }}
                className={cn(
                  'rounded-md border px-2.5 py-0.5 text-[11px] font-bold',
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
                  'rounded-md border px-2.5 py-0.5 text-[11px] font-bold',
                  appliesWaqf ? 'border-green-600 bg-green-50 text-green-800' : 'border-[var(--color-border)] text-[var(--color-ink-muted)]'
                )}
              >
                {appliesWaqf ? '✓ ' : ''}الوقف
              </button>
            </div>
          </div>
        </div>

        {/* Column 2: Reader and Narrator Selector Grid */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-2xs">
          <ReaderNarratorSelector
            narrators={narrators}
            onChange={setNarrators}
            disabled={isSaving}
          />
        </div>
      </div>
    </aside>
  )
}
