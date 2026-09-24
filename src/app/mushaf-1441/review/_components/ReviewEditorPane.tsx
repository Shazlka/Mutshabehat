'use client'

import { useEffect, useMemo, useState } from 'react'
import type {
  CatalogNarrator,
  CreateEntryInput,
  EntryFields,
  NarratorInput,
  ReviewPage,
  ReviewRow,
} from '../_lib/types'
import {
  getMushaf1441SurahOption,
} from '../../../../../packages/quran-data/mushaf1441/pageMetadata'
import ReaderNarratorSelector, { CANONICAL_READERS } from './ReaderNarratorSelector'
import UsulRuleGrid from './UsulRuleGrid'
import FarshFields from './FarshFields'
import { STATUS_LABEL_AR, KIND_LABEL_AR } from './statusMeta'
import { cn } from '@/lib/cn'

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
      setNarrators(newEntryDraft.narrators ?? [])
    }
  }, [newEntryDraft])

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

  // 1. Empty state when no word is selected
  if (!selectedWordKey && !selectedRow) {
    return (
      <aside
        dir="rtl"
        aria-label="محرر القراءات"
        className="flex h-full w-full max-w-[480px] min-w-[340px] flex-col justify-between overflow-y-auto border-s border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-right select-none"
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
      className="flex h-full w-full max-w-[480px] min-w-[340px] flex-col overflow-y-auto border-s border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5 text-right"
    >
      {/* 1. Header & Hafs Word Display */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/30 p-3.5 space-y-2">
        <div className="flex items-center justify-between text-xs text-[var(--color-ink-muted)] font-medium">
          <div className="flex items-center gap-1.5">
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

        {/* Big Hafs Word Box */}
        <div className="flex items-center justify-between rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface)] px-4 py-2">
          <span className="font-quran text-3xl font-bold text-[var(--color-ink)]">
            ﴿{currentHafsText}﴾
          </span>
          <span className="text-[11px] font-medium text-[var(--color-ink-muted)]">
            رواية حفص عن عاصم
          </span>
        </div>
      </div>

      {/* 2. Multiple Variants Switcher (when word has >1 entries, or adding another) */}
      {!isAddMode && activeRowsForWord.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-b border-[var(--color-border-soft)] pb-2.5">
          <span className="text-[11px] font-bold text-[var(--color-ink-muted)]">الأوجه المسجلة:</span>
          {activeRowsForWord.map((row, idx) => {
            const isSelected = selectedRow?.entryId === row.entryId
            const narratorNames = row.narrators.map((n) => n.nameAr).join('، ')
            return (
              <button
                key={row.entryId}
                type="button"
                onClick={() => onSelectRow(row)}
                className={cn(
                  'rounded-md px-2 py-1 text-xs font-bold transition-all',
                  isSelected
                    ? 'border border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-xs'
                    : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-2)]'
                )}
                title={narratorNames}
              >
                <span>{idx + 1}. </span>
                <span>{row.kind === 'usul' ? row.categoryNameAr ?? 'أصل' : row.readingText}</span>
              </button>
            )
          })}
          {selectedWordMeta ? (
            <button
              type="button"
              onClick={() => onStartNewEntry(selectedWordMeta)}
              className="rounded-md border border-dashed border-[var(--color-border)] px-2 py-1 text-xs font-bold text-[var(--color-primary)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]/20"
            >
              + إضافة وجه آخر
            </button>
          ) : null}
        </div>
      ) : null}

      {/* 3. Action Bar - Instant 1-Click Confirm & Status Controls */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-2)]/40 p-2.5">
        {selectedRow && !isAddMode ? (
          <>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onConfirmRow(selectedRow)}
                disabled={isSaving}
                className={cn(
                  'flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer',
                  selectedRow.reviewStatus === 'reviewed'
                    ? 'bg-green-700 text-white ring-2 ring-green-500/50'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                )}
              >
                <span>✓</span>
                <span>{selectedRow.reviewStatus === 'reviewed' ? 'مُعتمد (إعادة الاعتماد)' : 'اعتماد (1-Click)'}</span>
              </button>

              <button
                type="button"
                onClick={() => onFlagRow(selectedRow)}
                disabled={isSaving}
                className={cn(
                  'rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-all disabled:opacity-50',
                  selectedRow.reviewStatus === 'flagged'
                    ? 'border-red-600 bg-red-600 text-white'
                    : 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                )}
              >
                ⚑ تعليم
              </button>

              <button
                type="button"
                onClick={handleSaveExisting}
                disabled={isSaving}
                className="rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] px-3 py-1.5 text-xs font-bold text-white shadow-xs disabled:opacity-50"
              >
                حفظ التعديل
              </button>
            </div>

            <button
              type="button"
              onClick={() => onDeleteRow(selectedRow)}
              disabled={isSaving}
              className="rounded-lg border border-[var(--color-danger)]/40 px-2.5 py-1.5 text-xs font-bold text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] disabled:opacity-50"
            >
              حذف 🗑
            </button>
          </>
        ) : (
          <div className="flex w-full items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={isSaving || (kind === 'farsh' && !readingText.trim()) || (kind === 'usul' && !categoryCode) || narrators.length === 0}
              className="flex-1 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] py-2 text-xs font-bold text-white shadow-sm disabled:opacity-40"
            >
              + إضافة إلى قاعدة البيانات
            </button>
            <button
              type="button"
              onClick={onCancelNewEntry}
              className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-bold text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-2)]"
            >
              إلغاء
            </button>
          </div>
        )}
      </div>

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

      {/* 4. Kind Segmented Toggle */}
      <div className="mt-4 space-y-1.5">
        <label className="text-xs font-bold text-[var(--color-ink)]">نوع الموضع:</label>
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-1">
          <button
            type="button"
            onClick={() => setKind('farsh')}
            className={cn(
              'rounded-md py-1.5 text-xs font-bold transition-all',
              kind === 'farsh'
                ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow-xs'
                : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
            )}
          >
            فرش الحروف (تغيير رسم/نطق)
          </button>
          <button
            type="button"
            onClick={() => setKind('usul')}
            className={cn(
              'rounded-md py-1.5 text-xs font-bold transition-all',
              kind === 'usul'
                ? 'bg-[var(--color-surface)] text-[var(--color-primary)] shadow-xs'
                : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
            )}
          >
            أصول القراءات (قواعد عامة)
          </button>
        </div>
      </div>

      {/* 5. Dynamic Kind Sub-Editor */}
      <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 shadow-2xs">
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

      {/* 6. Reader and Narrator Selector Grid */}
      <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 shadow-2xs">
        <ReaderNarratorSelector
          narrators={narrators}
          onChange={setNarrators}
          disabled={isSaving}
        />
      </div>
    </aside>
  )
}
