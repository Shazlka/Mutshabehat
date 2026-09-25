'use client'

import { useState } from 'react'
import type {
  BulkApplyResult,
  CreateEntryInput,
  EntryFields,
  HamzahDetail,
  NarratorInput,
  ReviewPage,
  ReviewRow,
} from '../_lib/types'
import { getMushaf1441SurahOption } from '../../../../../packages/quran-data/mushaf1441/pageMetadata'
import ReaderNarratorSelector from './ReaderNarratorSelector'
import UsulRuleGrid from './UsulRuleGrid'
import FarshFields from './FarshFields'
import HamzahDetailFields, { isHamzahCategory } from './HamzahDetailFields'
import { STATUS_LABEL_AR } from './statusMeta'
import { useReviewEditorDraft, type WordMeta } from './useReviewEditorDraft'
import { cn } from '@/lib/cn'

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
  onCopyToOccurrence(
    sourceEntryId: string,
    target: { surah: number; ayah: number; startWord: number }
  ): Promise<void>
  onBulkApply(
    sourceEntryId: string,
    targets: { surah: number; ayah: number; word: number }[]
  ): Promise<BulkApplyResult | null>
  onCreateNewEntry(entry: CreateEntryInput): Promise<void>
  isSaving: boolean
  saveMessage: string | null
  errorMessage: string | null
  onBack(): void
  onSaveAndNext(): Promise<void>
}

export default function MobileReviewEditorView({
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
  onBack,
  onSaveAndNext,
}: Props) {
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
    isDirty,
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
    sameWordOpen,
    setSameWordOpen,
    sameWordLoading,
    sameWordMatches,
    openSameWordPanel,
    copyFromMatch,
    bulkApplyOpen,
    setBulkApplyOpen,
    bulkApplyLoading,
    occurrences,
    selectedOccurrences,
    openBulkApplyPanel,
    toggleOccurrence,
    confirmBulkApply,
    handleSaveExisting,
    handleCreate,
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

  const [unsavedModalOpen, setUnsavedModalOpen] = useState(false)

  const surahName = currentSurahNumber
    ? getMushaf1441SurahOption(currentSurahNumber)?.name ?? `سورة ${currentSurahNumber}`
    : ''

  function handleBackClick() {
    if (isDirty) {
      setUnsavedModalOpen(true)
    } else {
      onBack()
    }
  }

  async function handleSaveAndStay() {
    if (isAddMode) {
      await handleCreate()
    } else {
      await handleSaveExisting()
    }
  }

  async function handleSaveAndReturn() {
    let success = false
    if (isAddMode) {
      success = await handleCreate()
    } else {
      success = await handleSaveExisting()
    }
    if (success) {
      setUnsavedModalOpen(false)
      onBack()
    }
  }

  async function handleSaveAndNextClick() {
    let success = false
    if (isAddMode) {
      success = await handleCreate()
    } else {
      success = await handleSaveExisting()
    }
    if (success) {
      await onSaveAndNext()
    }
  }

  return (
    <div dir="rtl" lang="ar" data-mobile-review-editor="true" className="flex h-dvh flex-col bg-[var(--color-paper)]">
      {/* 1. Mobile Dedicated Editor Top Bar */}
      <header className="sticky top-0 z-30 flex shrink-0 flex-col border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] shadow-xs">
        <div className="flex items-center justify-between gap-2">
          {/* Back button */}
          <button
            type="button"
            onClick={handleBackClick}
            aria-label="العودة إلى المصحف"
            className="flex min-h-10 items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-bold text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] active:scale-95 transition-transform"
          >
            <span className="text-sm font-bold">←</span>
            <span>المصحف</span>
          </button>

          {/* Status badge & Quick 1-Click Status buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {selectedRow ? (
              <>
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

                <button
                  type="button"
                  onClick={() => onConfirmRow(selectedRow)}
                  disabled={isSaving}
                  className={cn(
                    'flex min-h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-bold transition-all shadow-xs disabled:opacity-50 active:scale-95',
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
                    'flex min-h-9 items-center rounded-lg border px-2 text-xs font-bold transition-all disabled:opacity-50 active:scale-95',
                    selectedRow.reviewStatus === 'flagged'
                      ? 'border-red-600 bg-red-600 text-white'
                      : 'border-red-300 bg-red-50 text-red-700'
                  )}
                  title="تعليم للمراجعة"
                >
                  ⚑
                </button>
              </>
            ) : (
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
                + موضع جديد
              </span>
            )}
          </div>
        </div>

        {/* Word Display Banner */}
        <div className="mt-2 flex items-center justify-between rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-2)]/40 px-3 py-2">
          <div className="flex flex-col">
            <span className="font-quran text-2xl font-bold text-[var(--color-ink)]">
              ﴿{currentHafsText}﴾
            </span>
            <span className="text-[11px] text-[var(--color-ink-muted)]">
              سورة {surahName} • الآية {currentAyahNumber} • ص {page.page}
            </span>
          </div>

          {selectedRow && !isAddMode ? (
            <button
              type="button"
              onClick={() => onDeleteRow(selectedRow)}
              disabled={isSaving}
              aria-label="حذف هذا الموضع"
              title="حذف هذا الموضع"
              className="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-[var(--color-danger)]/30 text-xs font-bold text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] active:scale-95 transition-transform"
            >
              🗑
            </button>
          ) : null}
        </div>
      </header>

      {/* 2. Scrollable Body Content */}
      <main className="flex-1 overflow-y-auto p-3 space-y-3 pb-28">
        {/* Status Toast Messages */}
        {saveMessage ? (
          <div
            role="status"
            className="rounded-xl border border-green-200 bg-green-50 p-2.5 text-xs font-bold text-green-900 shadow-xs"
          >
            {saveMessage}
          </div>
        ) : null}
        {errorMessage ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs font-bold text-red-900 shadow-xs"
          >
            {errorMessage}
          </div>
        ) : null}

        {/* Section A: Recorded Faces (الأوجه المسجلة) */}
        {!isAddMode && activeRowsForWord.length > 0 ? (
          <section
            aria-label="الأوجه المسجلة"
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 space-y-2 shadow-2xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-[var(--color-border-soft)] pb-2">
              <span className="text-xs font-bold text-[var(--color-ink)]">
                الأوجه المسجلة ({activeRowsForWord.length}):
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setMultiSelectMode((v) => !v)
                    setSelectedForDelete(new Set())
                  }}
                  className="rounded-lg border border-[var(--color-border)] px-2 py-1 text-[11px] font-bold text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-2)]"
                >
                  {multiSelectMode ? 'إلغاء التحديد' : 'تحديد للحذف'}
                </button>
                {selectedWordMeta ? (
                  <button
                    type="button"
                    onClick={() => onStartNewEntry(selectedWordMeta)}
                    className="rounded-lg border border-dashed border-[var(--color-primary)] px-2 py-1 text-[11px] font-bold text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]/20"
                  >
                    + وجه جديد
                  </button>
                ) : null}
              </div>
            </div>

            {/* List of Faces */}
            <div className="space-y-1.5">
              {activeRowsForWord.map((row, idx) => {
                const isSelected = selectedRow?.entryId === row.entryId
                const narratorNames = row.narrators.map((n) => n.nameAr).join('، ')
                return (
                  <div
                    key={row.entryId}
                    onClick={() =>
                      multiSelectMode ? toggleDeleteSelection(row.entryId) : onSelectRow(row)
                    }
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-xl border p-2.5 transition-all cursor-pointer select-none',
                      isSelected && !multiSelectMode
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]/20 ring-1 ring-[var(--color-primary)]'
                        : 'border-[var(--color-border-soft)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)]'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {multiSelectMode ? (
                        <input
                          type="checkbox"
                          checked={selectedForDelete.has(row.entryId)}
                          onChange={() => toggleDeleteSelection(row.entryId)}
                          aria-label={`تحديد الوجه ${idx + 1} للحذف`}
                          className="h-4 w-4 rounded accent-[var(--color-danger)]"
                        />
                      ) : (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-[10px] font-bold text-[var(--color-ink)]">
                          {idx + 1}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-[var(--color-ink)]">
                          {row.kind === 'usul' ? row.categoryNameAr ?? 'أصل' : row.readingText}
                        </p>
                        <p className="truncate text-[10px] text-[var(--color-ink-muted)]">
                          {narratorNames || 'لم يُحدد راوٍ'}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.2 text-[10px] font-bold',
                          row.reviewStatus === 'reviewed' && 'bg-green-100 text-green-800',
                          row.reviewStatus === 'unreviewed' && 'bg-amber-100 text-amber-800',
                          row.reviewStatus === 'flagged' && 'bg-red-100 text-red-800'
                        )}
                      >
                        {STATUS_LABEL_AR[row.reviewStatus]}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Bulk Delete Action Button */}
            {multiSelectMode && selectedForDelete.size > 0 ? (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={confirmBulkDelete}
                  disabled={isSaving}
                  className="w-full rounded-xl bg-[var(--color-danger)] py-2 text-xs font-bold text-white shadow-xs disabled:opacity-50"
                >
                  حذف {selectedForDelete.size} أوجه محددة
                </button>
              </div>
            ) : null}

            {/* Secondary: Copy from Verified Word & Apply to all Occurrences */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--color-border-soft)]">
              {selectedRow ? (
                <>
                  <button
                    type="button"
                    onClick={openSameWordPanel}
                    className="flex-1 rounded-lg border border-[var(--color-border)] py-1.5 text-center text-xs font-bold text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-2)]"
                  >
                    نسخ من كلمة موثقة
                  </button>
                  <button
                    type="button"
                    onClick={openBulkApplyPanel}
                    className="flex-1 rounded-lg border border-[var(--color-border)] py-1.5 text-center text-xs font-bold text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-2)]"
                  >
                    تطبيق على نفس الكلمة
                  </button>
                </>
              ) : null}
            </div>

            {/* Panel: Same-word verified-config copy */}
            {sameWordOpen ? (
              <div className="mt-2 space-y-2 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-2)]/30 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--color-ink)]">
                    {sameWordLoading ? 'جارٍ البحث…' : 'نسخ الأوجه من مواضع موثقة سابقة:'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSameWordOpen(false)}
                    className="text-xs text-[var(--color-ink-muted)]"
                  >
                    إغلاق
                  </button>
                </div>
                {!sameWordLoading && sameWordMatches && sameWordMatches.length === 0 ? (
                  <p className="text-xs text-[var(--color-ink-muted)]">
                    لا توجد مواضع مراجَعة سابقًا لنفس الكلمة.
                  </p>
                ) : null}
                {sameWordMatches?.map((m) => (
                  <div
                    key={m.entryId}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-xs"
                  >
                    <div>
                      <p className="font-bold text-[var(--color-ink)]">
                        ص{m.page} · {m.surah}:{m.ayah}:{m.startWord} ·{' '}
                        {m.kind === 'usul' ? m.categoryNameAr ?? 'أصل' : m.readingText}
                      </p>
                      <p className="text-[10px] text-[var(--color-ink-muted)]">
                        {m.narrators.map((n) => n.nameAr).join('، ')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyFromMatch(m)}
                      disabled={isSaving}
                      className="shrink-0 rounded-lg bg-[var(--color-primary)] px-2.5 py-1 text-xs font-bold text-white shadow-xs disabled:opacity-50"
                    >
                      نسخ الوجه
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Panel: Bulk Apply Across Mushaf */}
            {bulkApplyOpen ? (
              <div className="mt-2 space-y-2 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-2)]/30 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--color-ink)]">
                    {bulkApplyLoading
                      ? 'جارٍ البحث عن مواضع الكلمة…'
                      : `مواضع أخرى لنفس الكلمة (${occurrences?.length ?? 0}):`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setBulkApplyOpen(false)}
                    className="text-xs text-[var(--color-ink-muted)]"
                  >
                    إغلاق
                  </button>
                </div>
                {!bulkApplyLoading && occurrences ? (
                  <>
                    <p className="text-[11px] text-[var(--color-ink-muted)]">
                      سيتم تطبيق هذا الوجه على {selectedOccurrences.size} موضعًا لكلمة "
                      {currentHafsText}".
                    </p>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {occurrences.map((o) => (
                        <label
                          key={o.canonicalKey}
                          className={cn(
                            'flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-xs',
                            o.status === 'exists'
                              ? 'border-amber-200 bg-amber-50 text-amber-900'
                              : 'border-[var(--color-border)] bg-[var(--color-surface)]'
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedOccurrences.has(o.canonicalKey)}
                              onChange={() => toggleOccurrence(o.canonicalKey)}
                              className="h-4 w-4"
                            />
                            <span>
                              ص{o.page} · {o.surah}:{o.ayah}:{o.word} · {o.text}
                            </span>
                          </span>
                          <span className="text-[10px] font-bold">
                            {o.status === 'exists' ? 'موجود' : 'سيُضاف'}
                          </span>
                        </label>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={confirmBulkApply}
                      disabled={isSaving || selectedOccurrences.size === 0}
                      className="w-full rounded-xl bg-[var(--color-primary)] py-2 text-xs font-bold text-white shadow-xs disabled:opacity-50"
                    >
                      تطبيق على {selectedOccurrences.size} موضعًا
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {/* Section B: Kind Selector (Segmented: فرش الحروف / أصول القراءات) */}
        <section aria-label="نوع الموضع" className="space-y-1">
          <label className="text-xs font-bold text-[var(--color-ink)]">نوع الموضع:</label>
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-1">
            <button
              type="button"
              onClick={() => setKind('farsh')}
              className={cn(
                'min-h-10 rounded-lg text-xs font-bold transition-all',
                kind === 'farsh'
                  ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow-xs font-black'
                  : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
              )}
            >
              فرش الحروف
            </button>
            <button
              type="button"
              onClick={() => setKind('usul')}
              className={cn(
                'min-h-10 rounded-lg text-xs font-bold transition-all',
                kind === 'usul'
                  ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow-xs font-black'
                  : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
              )}
            >
              أصول القراءات
            </button>
          </div>
        </section>

        {/* Section C: Sub-Editor Fields (Farsh or Usul) */}
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-2xs">
          {kind === 'usul' ? (
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
              disabled={isSaving}
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
              disabled={isSaving}
            />
          )}
        </section>

        {/* Section D: Hamzah Structured Controls (if Usul chapter is Hamzah) */}
        {kind === 'usul' && isHamzahCategory(categoryCode) ? (
          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-2xs">
            <HamzahDetailFields
              categoryCode={categoryCode}
              value={hamzahDetail}
              onChange={setHamzahDetail}
              disabled={isSaving}
            />
          </section>
        ) : null}

        {/* Section E: Waqf / Wasl Applicability */}
        <section className="flex items-center justify-between gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-2xs">
          <span className="text-xs font-bold text-[var(--color-ink)]">حالة الأداء:</span>
          <div className="flex gap-2">
            <button
              type="button"
              aria-pressed={appliesWasl}
              disabled={isSaving}
              onClick={() => {
                if (appliesWasl && !appliesWaqf) return
                setAppliesWasl((v) => !v)
              }}
              className={cn(
                'min-h-9 rounded-lg border px-3 text-xs font-bold transition-all',
                appliesWasl
                  ? 'border-green-600 bg-green-50 text-green-800'
                  : 'border-[var(--color-border)] text-[var(--color-ink-muted)]'
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
                'min-h-9 rounded-lg border px-3 text-xs font-bold transition-all',
                appliesWaqf
                  ? 'border-green-600 bg-green-50 text-green-800'
                  : 'border-[var(--color-border)] text-[var(--color-ink-muted)]'
              )}
            >
              {appliesWaqf ? '✓ ' : ''}الوقف
            </button>
          </div>
        </section>

        {/* Section F: Readers and Narrators */}
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-2xs">
          <ReaderNarratorSelector
            narrators={narrators}
            onChange={setNarrators}
            disabled={isSaving}
          />
        </section>
      </main>

      {/* 3. Fixed Bottom Action Bar */}
      <footer
        className="fixed bottom-0 inset-x-0 z-40 flex items-center justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg backdrop-blur-md"
        role="region"
        aria-label="شريط الحفظ والإجراءات"
      >
        <button
          type="button"
          onClick={handleSaveAndStay}
          disabled={
            isSaving ||
            (kind === 'farsh' && !readingText.trim()) ||
            (kind === 'usul' && !categoryCode) ||
            narrators.length === 0
          }
          className="flex-1 min-h-12 items-center justify-center rounded-xl bg-[var(--color-primary)] px-4 text-sm font-bold text-white shadow-md hover:bg-[var(--color-primary-hover)] active:scale-98 transition-all disabled:opacity-40"
        >
          {isSaving ? 'جارٍ الحفظ…' : isAddMode ? 'إضافة إلى القاعدة' : 'حفظ'}
        </button>

        <button
          type="button"
          onClick={handleSaveAndNextClick}
          disabled={
            isSaving ||
            (kind === 'farsh' && !readingText.trim()) ||
            (kind === 'usul' && !categoryCode) ||
            narrators.length === 0
          }
          className="flex-1 min-h-12 items-center justify-center rounded-xl border-2 border-[var(--color-primary)] bg-[var(--color-surface)] px-4 text-sm font-bold text-[var(--color-primary)] shadow-sm hover:bg-[var(--color-primary-soft)]/20 active:scale-98 transition-all disabled:opacity-40"
        >
          {isSaving ? 'جارٍ الحفظ…' : 'حفظ والتالي ←'}
        </button>
      </footer>

      {/* 4. Unsaved Changes Guard Modal */}
      {unsavedModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="تنبيه: تعديلات غير محفوظة"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-xs rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl text-center">
            <span className="text-3xl" role="img" aria-hidden="true">
              ⚠️
            </span>
            <h3 className="mt-2 text-sm font-bold text-[var(--color-ink)]">
              لديك تعديلات غير محفوظة
            </h3>
            <p className="mt-1 text-xs text-[var(--color-ink-muted)] leading-relaxed">
              تم تعديل بيانات هذه الكلمة دون حفظها. هل تريد حفظها قبل العودة؟
            </p>

            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleSaveAndReturn}
                disabled={isSaving}
                className="w-full min-h-10 rounded-xl bg-[var(--color-primary)] py-2 text-xs font-bold text-white shadow-sm hover:bg-[var(--color-primary-hover)] active:scale-95 transition-transform"
              >
                حفظ والعودة
              </button>
              <button
                type="button"
                onClick={() => {
                  setUnsavedModalOpen(false)
                  onBack()
                }}
                className="w-full min-h-10 rounded-xl border border-[var(--color-danger)]/30 text-xs font-bold text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] active:scale-95 transition-transform"
              >
                تجاهل التعديلات
              </button>
              <button
                type="button"
                onClick={() => setUnsavedModalOpen(false)}
                className="w-full min-h-10 rounded-xl border border-[var(--color-border)] py-2 text-xs font-bold text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-2)] active:scale-95 transition-transform"
              >
                متابعة التعديل
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
