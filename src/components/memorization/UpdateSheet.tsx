'use client'

import { useState, useMemo } from 'react'
import {
  type AyahKey,
  type AyahMemorizationRecord,
  type BatchPlan,
  type BatchRecord,
  MemorizationStatus,
  MUSHAF_PAGE_COUNT,
} from '../../../packages/memorization-core/types'
import {
  type MemorizationSelection,
  resolveSelection,
} from '../../../packages/memorization-core/selection'
import {
  planUpdate,
  needsConfirmation,
} from '../../../packages/memorization-core/planner'
import {
  parseSelectionTarget,
  targetToSelection,
} from '../../../packages/memorization-core/selectionParser'
import {
  type BrowserQuranIndex,
  type SurahMeta,
  type UpdateFormValues,
  type UpdateSelectionMode,
  DEFAULT_FORM_VALUES,
  selectionToFormValues,
  formValuesToSelection,
  getSelectionLabel,
  getStatusLabel,
  getStatusShape,
} from '../../lib/memorization-view'

export interface UpdateSheetProps {
  readonly isOpen: boolean
  readonly initialSelection?: MemorizationSelection | null
  readonly records: Readonly<Record<string, AyahMemorizationRecord>>
  readonly index: BrowserQuranIndex
  readonly surahNames: Readonly<Record<number, string>>
  readonly surahs: readonly SurahMeta[]
  readonly onClose: () => void
  readonly onApplyPlan: (
    plan: BatchPlan,
    makeCurrentPosition: boolean,
    selection: MemorizationSelection,
  ) => Promise<BatchRecord | null>
  readonly onApplied: (
    plan: BatchPlan,
    batch: BatchRecord,
    makeCurrentPosition: boolean,
  ) => void
}

const STRINGS = {
  title: 'تحديث الحفظ',
  close: 'إغلاق',
  cancel: 'إلغاء',
  save: 'حفظ',
  confirm: 'تأكيد',
  confirmTitle: 'تأكيد التحديث',
  searchPlaceholder: 'اكتب: يس · البقرة 255 · صفحة 582',
  searchAria: 'بحث سريع عن سورة أو آية أو صفحة',
  modeSurah: 'سورة',
  modeAyat: 'آيات',
  modePages: 'صفحات',
  modeJuz: 'جزء',
  surahSelectLabel: 'السورة',
  fromAyahLabel: 'من آية',
  toAyahLabel: 'إلى آية',
  fromPageLabel: 'من صفحة',
  toPageLabel: 'إلى صفحة',
  juzLabel: 'الجزء',
  statusSectionTitle: 'الحالة',
  learningToggle: 'قيد الحفظ',
  setCurrentToggle: 'اجعله موضع الحفظ الحالي',
  ayatCountLabel: (count: number, label: string) => `${count} آية · ${label}`,
  noChangesError: 'لا يوجد تغيير: كل هذه الآيات بهذه الحالة بالفعل.',
  applyingError: 'تعذر تطبيق التحديث.',
  previewChanges: (changed: number, gain: number) =>
    `سيتم تحديث ${changed} آية${gain > 0 ? ` (+${gain} جديد)` : ''}`,
}

const ALL_STATUSES: readonly MemorizationStatus[] = [
  MemorizationStatus.mastered,
  MemorizationStatus.memorizedWithErrors,
  MemorizationStatus.needsMushaf,
  MemorizationStatus.notMemorized,
]

export function UpdateSheet(props: UpdateSheetProps) {
  if (!props.isOpen) return null
  return <UpdateSheetContent {...props} />
}

function UpdateSheetContent({
  initialSelection,
  records,
  index,
  surahNames,
  surahs,
  onClose,
  onApplyPlan,
  onApplied,
}: Omit<UpdateSheetProps, 'isOpen'>) {
  const [formValues, setFormValues] = useState<UpdateFormValues>(() =>
    initialSelection ? selectionToFormValues(initialSelection, index) : DEFAULT_FORM_VALUES,
  )
  const [status, setStatus] = useState<MemorizationStatus | null>(null)
  const [isLearning, setIsLearning] = useState(false)
  const [setCurrent, setSetCurrent] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [pendingPlan, setPendingPlan] = useState<BatchPlan | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currentSelection = useMemo<MemorizationSelection>(() => {
    return formValuesToSelection(formValues)
  }, [formValues])

  const resolvedAyat = useMemo<AyahKey[]>(() => {
    return resolveSelection(currentSelection, index)
  }, [currentSelection, index])

  const selectionLabel = useMemo<string>(() => {
    return getSelectionLabel(currentSelection, (s) => surahNames[s] ?? String(s))
  }, [currentSelection, surahNames])

  const selectedSurahAyahCount = useMemo<number>(() => {
    return Math.max(1, index.ayahCount(formValues.surah))
  }, [formValues.surah, index])

  // Live plan preview
  const livePlan = useMemo<BatchPlan | null>(() => {
    if (status === null || resolvedAyat.length === 0) return null
    return planUpdate({
      selection: currentSelection,
      label: selectionLabel,
      status,
      learning: isLearning ? true : null,
      records,
      index,
      now: new Date(),
    })
  }, [status, resolvedAyat.length, currentSelection, selectionLabel, isLearning, records, index])

  // Handle Search input
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchText.trim()) return
    const target = parseSelectionTarget(searchText, surahNames as Record<number, string>, index)
    if (target) {
      const sel = targetToSelection(target)
      setFormValues(selectionToFormValues(sel, index))
      setSearchText('')
    }
  }

  // Handle mode tab change
  const setMode = (mode: UpdateSelectionMode) => {
    setFormValues((prev) => ({
      ...prev,
      mode,
    }))
  }

  // Handle surah change
  const handleSurahChange = (surahNum: number) => {
    const count = Math.max(1, index.ayahCount(surahNum))
    setFormValues((prev) => ({
      ...prev,
      surah: surahNum,
      fromAyah: Math.min(prev.fromAyah, count),
      toAyah: Math.min(Math.max(prev.toAyah, 1), count),
    }))
  }

  const handleApplyTapped = () => {
    if (status === null || !livePlan) return
    setErrorMessage(null)

    if (livePlan.changes.length === 0) {
      setErrorMessage(STRINGS.noChangesError)
      return
    }

    if (needsConfirmation(currentSelection, livePlan, index)) {
      setPendingPlan(livePlan)
    } else {
      void commitPlan(livePlan)
    }
  }

  const commitPlan = async (plan: BatchPlan) => {
    setPendingPlan(null)
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const batch = await onApplyPlan(plan, setCurrent, currentSelection)
      if (batch) {
        onApplied(plan, batch, setCurrent)
        onClose()
      } else {
        setErrorMessage(STRINGS.applyingError)
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : STRINGS.applyingError)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={STRINGS.title}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs transition-opacity duration-200"
      dir="rtl"
    >
      <div className="relative flex flex-col w-full max-w-lg max-h-[90vh] rounded-t-3xl border-t border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl text-right overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-neutral-800 px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            data-testid="memo-update-cancel"
            className="text-sm font-semibold text-gray-500 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-neutral-100 min-h-[44px] flex items-center"
          >
            {STRINGS.cancel}
          </button>

          <h2 className="text-base font-bold text-gray-900 dark:text-neutral-100">
            {STRINGS.title}
          </h2>

          <div className="w-10" />
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
          {/* Quick Search */}
          <form onSubmit={handleSearchSubmit} className="w-full">
            <input
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder={STRINGS.searchPlaceholder}
              aria-label={STRINGS.searchAria}
              data-testid="memo-update-search"
              className="w-full rounded-xl border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-800/60 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 min-h-[44px]"
            />
          </form>

          {/* Mode Tabs */}
          <div
            role="tablist"
            data-testid="memo-update-mode"
            className="grid grid-cols-4 gap-1 rounded-xl bg-gray-100 dark:bg-neutral-800 p-1"
          >
            {(['surah', 'ayat', 'pages', 'juz'] as const).map((m) => {
              const active = formValues.mode === m
              const label =
                m === 'surah'
                  ? STRINGS.modeSurah
                  : m === 'ayat'
                  ? STRINGS.modeAyat
                  : m === 'pages'
                  ? STRINGS.modePages
                  : STRINGS.modeJuz

              return (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMode(m)}
                  className={`rounded-lg py-2 text-xs font-semibold transition min-h-[44px] flex items-center justify-center ${
                    active
                      ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-neutral-100 shadow-xs'
                      : 'text-gray-500 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-neutral-100'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Mode Controls */}
          <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 dark:border-neutral-800 bg-gray-50/60 dark:bg-neutral-800/40 p-3.5">
            {formValues.mode === 'surah' && (
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="memo-surah-picker"
                  className="text-xs font-medium text-gray-500 dark:text-neutral-400"
                >
                  {STRINGS.surahSelectLabel}
                </label>
                <select
                  id="memo-surah-picker"
                  value={formValues.surah}
                  onChange={(e) => handleSurahChange(Number(e.target.value))}
                  data-testid="memo-update-surah"
                  className="w-full rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm font-medium text-gray-900 dark:text-neutral-100 outline-none min-h-[44px]"
                >
                  {surahs.map((s) => (
                    <option key={s.surahNumber} value={s.surahNumber}>
                      {`${s.surahNumber}. ${s.name}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {formValues.mode === 'ayat' && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="memo-ayat-surah-picker"
                    className="text-xs font-medium text-gray-500 dark:text-neutral-400"
                  >
                    {STRINGS.surahSelectLabel}
                  </label>
                  <select
                    id="memo-ayat-surah-picker"
                    value={formValues.surah}
                    onChange={(e) => handleSurahChange(Number(e.target.value))}
                    data-testid="memo-update-surah"
                    className="w-full rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm font-medium text-gray-900 dark:text-neutral-100 outline-none min-h-[44px]"
                  >
                    {surahs.map((s) => (
                      <option key={s.surahNumber} value={s.surahNumber}>
                        {`${s.surahNumber}. ${s.name}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-gray-500 dark:text-neutral-400">
                      {STRINGS.fromAyahLabel}
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={selectedSurahAyahCount}
                      value={formValues.fromAyah}
                      onChange={(e) =>
                        setFormValues((prev) => ({
                          ...prev,
                          fromAyah: Math.max(1, Math.min(selectedSurahAyahCount, Number(e.target.value) || 1)),
                        }))
                      }
                      data-testid="memo-update-from"
                      className="w-full rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm font-mono text-gray-900 dark:text-neutral-100 outline-none min-h-[44px]"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-gray-500 dark:text-neutral-400">
                      {STRINGS.toAyahLabel}
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={selectedSurahAyahCount}
                      value={formValues.toAyah}
                      onChange={(e) =>
                        setFormValues((prev) => ({
                          ...prev,
                          toAyah: Math.max(1, Math.min(selectedSurahAyahCount, Number(e.target.value) || 1)),
                        }))
                      }
                      data-testid="memo-update-to"
                      className="w-full rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm font-mono text-gray-900 dark:text-neutral-100 outline-none min-h-[44px]"
                    />
                  </div>
                </div>
              </div>
            )}

            {formValues.mode === 'pages' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-500 dark:text-neutral-400">
                    {STRINGS.fromPageLabel}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={MUSHAF_PAGE_COUNT}
                    value={formValues.fromPage}
                    onChange={(e) =>
                      setFormValues((prev) => ({
                        ...prev,
                        fromPage: Math.max(1, Math.min(MUSHAF_PAGE_COUNT, Number(e.target.value) || 1)),
                      }))
                    }
                    data-testid="memo-update-page-from"
                    className="w-full rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm font-mono text-gray-900 dark:text-neutral-100 outline-none min-h-[44px]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-500 dark:text-neutral-400">
                    {STRINGS.toPageLabel}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={MUSHAF_PAGE_COUNT}
                    value={formValues.toPage}
                    onChange={(e) =>
                      setFormValues((prev) => ({
                        ...prev,
                        toPage: Math.max(1, Math.min(MUSHAF_PAGE_COUNT, Number(e.target.value) || 1)),
                      }))
                    }
                    data-testid="memo-update-page-to"
                    className="w-full rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm font-mono text-gray-900 dark:text-neutral-100 outline-none min-h-[44px]"
                  />
                </div>
              </div>
            )}

            {formValues.mode === 'juz' && (
              <div className="grid grid-cols-6 gap-2">
                {Array.from({ length: 30 }, (_, i) => i + 1).map((jNum) => {
                  const selected = formValues.juz === jNum
                  return (
                    <button
                      key={jNum}
                      type="button"
                      onClick={() => setFormValues((prev) => ({ ...prev, juz: jNum }))}
                      data-testid={`memo-update-juz-${jNum}`}
                      className={`flex items-center justify-center rounded-xl py-2 font-mono text-sm font-semibold transition min-h-[44px] ${
                        selected
                          ? 'bg-[var(--memo-mastered)] text-white shadow-xs'
                          : 'bg-white dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 border border-gray-200 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800'
                      }`}
                    >
                      {jNum}
                    </button>
                  )
                })}
              </div>
            )}

            {formValues.mode === 'custom' && (
              <div className="py-2 text-sm font-medium text-gray-700 dark:text-neutral-300">
                {selectionLabel}
              </div>
            )}
          </div>

          {/* Status Choice */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-neutral-400">
              {STRINGS.statusSectionTitle}
            </span>

            <div className="flex flex-col divide-y divide-gray-100 dark:divide-neutral-800 rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden shadow-xs">
              {ALL_STATUSES.map((candidate) => {
                const selected = status === candidate
                const shape = getStatusShape(candidate)
                const label = getStatusLabel(candidate)

                return (
                  <button
                    key={candidate}
                    type="button"
                    onClick={() => setStatus(candidate)}
                    data-testid={`memo-status-${candidate}`}
                    className={`flex items-center justify-between px-4 py-3 transition min-h-[44px] ${
                      selected ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : 'hover:bg-gray-50 dark:hover:bg-neutral-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="flex w-6 items-center justify-center font-mono font-bold text-sm"
                        style={{
                          color:
                            candidate === MemorizationStatus.mastered
                              ? 'var(--memo-mastered)'
                              : candidate === MemorizationStatus.memorizedWithErrors
                              ? 'var(--memo-with-errors)'
                              : candidate === MemorizationStatus.needsMushaf
                              ? 'var(--memo-needs-mushaf)'
                              : 'var(--memo-not-memorized)',
                        }}
                      >
                        {shape}
                      </span>
                      <span className="text-sm font-medium text-gray-800 dark:text-neutral-200">
                        {label}
                      </span>
                    </div>

                    {selected && (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                        ✓
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-xs">
            <label className="flex items-center justify-between cursor-pointer min-h-[44px]">
              <span className="text-sm font-medium text-gray-800 dark:text-neutral-200">
                {STRINGS.learningToggle}
              </span>
              <input
                type="checkbox"
                checked={isLearning}
                onChange={(e) => setIsLearning(e.target.checked)}
                data-testid="memo-update-learning"
                className="h-5 w-5 rounded-md accent-emerald-600 focus:ring-emerald-500"
              />
            </label>

            <div className="border-t border-gray-100 dark:border-neutral-800" />

            <label className="flex items-center justify-between cursor-pointer min-h-[44px]">
              <span className="text-sm font-medium text-gray-800 dark:text-neutral-200">
                {STRINGS.setCurrentToggle}
              </span>
              <input
                type="checkbox"
                checked={setCurrent}
                onChange={(e) => setSetCurrent(e.target.checked)}
                data-testid="memo-update-set-current"
                className="h-5 w-5 rounded-md accent-emerald-600 focus:ring-emerald-500"
              />
            </label>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 p-3 text-xs text-red-700 dark:text-red-300">
              {errorMessage}
            </div>
          )}
        </div>

        {/* Bottom Bar: Selection summary & Save Action */}
        <div className="border-t border-gray-100 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xs px-5 py-3.5 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-neutral-400">
            <span data-testid="memo-update-count" className="font-medium">
              {STRINGS.ayatCountLabel(resolvedAyat.length, selectionLabel)}
            </span>
            {livePlan && livePlan.changes.length > 0 && (
              <span className="font-mono text-emerald-700 dark:text-emerald-400">
                {STRINGS.previewChanges(livePlan.changes.length, livePlan.gainAyahs)}
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={status === null || resolvedAyat.length === 0 || isSubmitting}
            onClick={handleApplyTapped}
            data-testid="memo-update-apply"
            className="flex w-full items-center justify-center rounded-xl bg-[var(--memo-mastered)] px-4 py-3 text-sm font-bold text-white shadow-md transition hover:opacity-95 disabled:opacity-40 disabled:pointer-events-none min-h-[44px]"
          >
            {isSubmitting ? '...' : STRINGS.save}
          </button>
        </div>
      </div>

      {/* Confirmation Dialog Overlay when pendingPlan is set */}
      {pendingPlan && status !== null && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label={STRINGS.confirmTitle}
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-sm rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-2xl text-right animate-scale-in">
            <h3 className="text-base font-bold text-gray-900 dark:text-neutral-100">
              {STRINGS.confirmTitle}
            </h3>

            <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-neutral-300">
              {`سيتم تحديث ${pendingPlan.changes.length} آية من ${selectionLabel} إلى «${getStatusLabel(
                status,
              )}».`}
              {pendingPlan.unchangedCount > 0
                ? ` (${pendingPlan.unchangedCount} منها بهذه الحالة بالفعل)`
                : ''}
            </p>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setPendingPlan(null)}
                className="rounded-xl border border-gray-200 dark:border-neutral-700 px-4 py-2 text-xs font-semibold text-gray-700 dark:text-neutral-300 transition hover:bg-gray-100 dark:hover:bg-neutral-800 min-h-[44px] flex items-center"
              >
                {STRINGS.cancel}
              </button>

              <button
                type="button"
                onClick={() => void commitPlan(pendingPlan)}
                className="rounded-xl bg-[var(--memo-mastered)] px-4 py-2 text-xs font-bold text-white transition hover:opacity-95 min-h-[44px] flex items-center"
              >
                {STRINGS.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
