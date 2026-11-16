'use client'

import { useId, useState, type FormEvent } from 'react'
import { MUSHAF_1441_SURAH_OPTIONS, getMushaf1441AyahCount } from '../../../packages/quran-data/mushaf1441/pageMetadata'
import { useReadingStore } from '../../lib/hooks/useReadingStore'
import {
  getAyahsForAyahRange,
  getAyahsForPageRange,
  getAyahsForSurah,
  toArabicDigits,
} from '../../lib/reading-view'
import type { RecordReadingResult } from '../../lib/storage/reading-db'

const STRINGS = {
  title: 'أضف جلسة قراءة',
  cancel: 'إلغاء',
  save: 'حفظ',
  confirm: 'تأكيد وتسجيل الجلسة',
  modeSurah: 'سورة كاملة',
  modeAyahs: 'حسب الآيات',
  modePages: 'حسب الصفحات',
  surahLabel: 'السورة',
  fromSurahLabel: 'من سورة',
  fromAyahLabel: 'من آية',
  toSurahLabel: 'إلى سورة',
  toAyahLabel: 'إلى آية',
  fromPageLabel: 'من صفحة',
  toPageLabel: 'إلى صفحة',
  durationLabel: 'مدة التلاوة (بالدقائق)',
  minutesUnit: 'دقيقة',
  dateLabel: 'تاريخ الجلسة',
  fromMemoryTitle: 'تلوتُ عن ظهر قلب (من الذاكرة)',
  fromMemoryDesc: 'حفظ أو مراجعة بدون الاستعانة بالمصحف',
  estimatedVolume: 'المحتوى المقدّر:',
  ayahsCount: 'آية',
  pagesCount: 'صفحة',
  invalidRangeError: 'نطاق الآيات غير صالح. تحقق من البداية والنهاية.',
  saveError: 'لم تُسجَّل أي آية. تحقق من النطاق ثم حاول مرة أخرى.',
  closeLabel: 'إغلاق نافذة إضافة جلسة',
} as const

const QUICK_DURATIONS = [5, 10, 15, 20, 30, 45, 60] as const

export interface AddReadingSessionSheetProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly onSaved?: (result: RecordReadingResult) => void
}

type RangeMode = 'bySurah' | 'byAyah' | 'byPage'

export function AddReadingSessionSheet({
  isOpen,
  onClose,
  onSaved,
}: AddReadingSessionSheetProps) {
  const titleId = useId()
  const { addManualSession } = useReadingStore()

  const [mode, setMode] = useState<RangeMode>('bySurah')
  const [selectedSurah, setSelectedSurah] = useState<number>(1)

  const [fromSurah, setFromSurah] = useState<number>(1)
  const [fromAyah, setFromAyah] = useState<number>(1)
  const [toSurah, setToSurah] = useState<number>(1)
  const [toAyah, setToAyah] = useState<number>(7)

  const [fromPage, setFromPage] = useState<number>(1)
  const [toPage, setToPage] = useState<number>(1)

  const [durationMinutes, setDurationMinutes] = useState<number>(15)
  const [isFromMemory, setIsFromMemory] = useState<boolean>(false)
  const [sessionDate, setSessionDate] = useState<string>(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  })

  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  if (!isOpen) return null

  const isRangeInvalid =
    mode === 'byAyah' &&
    (fromSurah > toSurah || (fromSurah === toSurah && toAyah < fromAyah))

  const handleFromSurahChange = (surahNum: number) => {
    setFromSurah(surahNum)
    setFromAyah(1)
    if (toSurah < surahNum) {
      setToSurah(surahNum)
      setToAyah(getMushaf1441AyahCount(surahNum))
    }
  }

  const handleToSurahChange = (surahNum: number) => {
    setToSurah(surahNum)
    setToAyah(getMushaf1441AyahCount(surahNum))
  }

  const handleSubmit = async (event?: FormEvent) => {
    if (event) event.preventDefault()
    if (isRangeInvalid || isSubmitting) return

    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      let items: ReturnType<typeof getAyahsForSurah> = []
      if (mode === 'bySurah') {
        items = getAyahsForSurah(selectedSurah)
      } else if (mode === 'byAyah') {
        items = getAyahsForAyahRange(fromSurah, fromAyah, toSurah, toAyah)
      } else {
        items = getAyahsForPageRange(fromPage, toPage)
      }

      if (items.length === 0) {
        setErrorMessage(STRINGS.invalidRangeError)
        setIsSubmitting(false)
        return
      }

      const sessionDateObj = new Date(`${sessionDate}T12:00:00Z`)
      const res = await addManualSession({
        items,
        durationMinutes: Math.max(1, durationMinutes),
        fromMemory: isFromMemory,
        sessionDate: sessionDateObj,
        dateString: sessionDate,
      })

      if (onSaved) onSaved(res)
      onClose()
    } catch {
      setErrorMessage(STRINGS.saveError)
    } finally {
      setIsSubmitting(false)
    }
  }

  const estimatedAyahCount =
    mode === 'bySurah'
      ? getMushaf1441AyahCount(selectedSurah)
      : mode === 'byAyah'
        ? Math.max(0, getAyahsForAyahRange(fromSurah, fromAyah, toSurah, toAyah).length)
        : Math.max(0, getAyahsForPageRange(fromPage, toPage).length)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-xs sm:items-center sm:p-4 motion-reduce:transition-none"
      dir="rtl"
    >
      <div
        className="relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-2xl border border-[var(--qiraat-card-stroke,#d7c7a7)] bg-[var(--mushaf-paper,#fcf8ed)] text-[var(--mushaf-ink,#171717)] shadow-2xl sm:rounded-2xl"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        {/* Top Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--qiraat-card-stroke,#d7c7a7)] px-4 py-3 sm:px-5 sm:py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-2 text-sm font-semibold text-[var(--mushaf-brown,#665b48)] transition-colors hover:bg-black/5 active:scale-95"
            aria-label={STRINGS.closeLabel}
          >
            {STRINGS.cancel}
          </button>

          <h2 id={titleId} className="text-base font-bold sm:text-lg">
            {STRINGS.title}
          </h2>

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isRangeInvalid || isSubmitting}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-3 text-sm font-bold text-[var(--app-progress,#1A7340)] transition-colors hover:bg-[var(--app-progress,#1A7340)]/10 active:scale-95 disabled:opacity-40"
          >
            {STRINGS.save}
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {/* Mode Switcher */}
          <div
            role="radiogroup"
            aria-label={STRINGS.title}
            className="grid grid-cols-3 gap-1 rounded-xl border border-[var(--qiraat-card-stroke,#d7c7a7)] bg-black/5 p-1 text-center"
          >
            {(['bySurah', 'byAyah', 'byPage'] as const).map((m) => {
              const active = mode === m
              const label =
                m === 'bySurah'
                  ? STRINGS.modeSurah
                  : m === 'byAyah'
                    ? STRINGS.modeAyahs
                    : STRINGS.modePages
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setMode(m)
                    setErrorMessage(null)
                  }}
                  className={`min-h-[44px] rounded-lg text-xs font-bold transition-all sm:text-sm ${
                    active
                      ? 'bg-[var(--qiraat-card-fill,#ffffff)] text-[var(--mushaf-ink,#171717)] shadow-xs'
                      : 'text-[var(--mushaf-brown,#665b48)] hover:text-[var(--mushaf-ink,#171717)]'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Range Inputs based on Mode */}
          {mode === 'bySurah' ? (
            <div className="rounded-xl border border-[var(--qiraat-card-stroke,#d7c7a7)] bg-[var(--qiraat-card-fill,#ffffff)] p-3">
              <label htmlFor="select-surah" className="block text-xs font-bold text-[var(--mushaf-brown,#665b48)]">
                {STRINGS.surahLabel}
              </label>
              <select
                id="select-surah"
                value={selectedSurah}
                onChange={(e) => setSelectedSurah(Number(e.target.value))}
                className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[var(--qiraat-card-stroke,#d7c7a7)] bg-[var(--mushaf-paper,#fcf8ed)] px-3 text-sm font-bold text-[var(--mushaf-ink,#171717)]"
              >
                {MUSHAF_1441_SURAH_OPTIONS.map((s) => (
                  <option key={s.surahNumber} value={s.surahNumber}>
                    {toArabicDigits(s.surahNumber)}. سورة {s.name} ({toArabicDigits(s.ayahCount)} آية)
                  </option>
                ))}
              </select>
            </div>
          ) : mode === 'byAyah' ? (
            <div className="space-y-3 rounded-xl border border-[var(--qiraat-card-stroke,#d7c7a7)] bg-[var(--qiraat-card-fill,#ffffff)] p-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="from-surah" className="block text-xs font-bold text-[var(--mushaf-brown,#665b48)]">
                    {STRINGS.fromSurahLabel}
                  </label>
                  <select
                    id="from-surah"
                    value={fromSurah}
                    onChange={(e) => handleFromSurahChange(Number(e.target.value))}
                    className="mt-1 min-h-[44px] w-full rounded-lg border border-[var(--qiraat-card-stroke,#d7c7a7)] bg-[var(--mushaf-paper,#fcf8ed)] px-2 text-xs font-bold sm:text-sm"
                  >
                    {MUSHAF_1441_SURAH_OPTIONS.map((s) => (
                      <option key={s.surahNumber} value={s.surahNumber}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="from-ayah" className="block text-xs font-bold text-[var(--mushaf-brown,#665b48)]">
                    {STRINGS.fromAyahLabel}
                  </label>
                  <input
                    id="from-ayah"
                    type="number"
                    min={1}
                    max={getMushaf1441AyahCount(fromSurah)}
                    value={fromAyah}
                    onChange={(e) => setFromAyah(Math.max(1, Number(e.target.value)))}
                    className="mt-1 min-h-[44px] w-full rounded-lg border border-[var(--qiraat-card-stroke,#d7c7a7)] bg-[var(--mushaf-paper,#fcf8ed)] px-3 text-sm font-bold tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="to-surah" className="block text-xs font-bold text-[var(--mushaf-brown,#665b48)]">
                    {STRINGS.toSurahLabel}
                  </label>
                  <select
                    id="to-surah"
                    value={toSurah}
                    onChange={(e) => handleToSurahChange(Number(e.target.value))}
                    className="mt-1 min-h-[44px] w-full rounded-lg border border-[var(--qiraat-card-stroke,#d7c7a7)] bg-[var(--mushaf-paper,#fcf8ed)] px-2 text-xs font-bold sm:text-sm"
                  >
                    {MUSHAF_1441_SURAH_OPTIONS.map((s) => (
                      <option key={s.surahNumber} value={s.surahNumber}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="to-ayah" className="block text-xs font-bold text-[var(--mushaf-brown,#665b48)]">
                    {STRINGS.toAyahLabel}
                  </label>
                  <input
                    id="to-ayah"
                    type="number"
                    min={1}
                    max={getMushaf1441AyahCount(toSurah)}
                    value={toAyah}
                    onChange={(e) => setToAyah(Math.max(1, Number(e.target.value)))}
                    className="mt-1 min-h-[44px] w-full rounded-lg border border-[var(--qiraat-card-stroke,#d7c7a7)] bg-[var(--mushaf-paper,#fcf8ed)] px-3 text-sm font-bold tabular-nums"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-[var(--qiraat-card-stroke,#d7c7a7)] bg-[var(--qiraat-card-fill,#ffffff)] p-3">
              <div>
                <label htmlFor="from-page" className="block text-xs font-bold text-[var(--mushaf-brown,#665b48)]">
                  {STRINGS.fromPageLabel}
                </label>
                <input
                  id="from-page"
                  type="number"
                  min={1}
                  max={604}
                  value={fromPage}
                  onChange={(e) => setFromPage(Math.min(604, Math.max(1, Number(e.target.value))))}
                  className="mt-1 min-h-[44px] w-full rounded-lg border border-[var(--qiraat-card-stroke,#d7c7a7)] bg-[var(--mushaf-paper,#fcf8ed)] px-3 text-sm font-bold tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="to-page" className="block text-xs font-bold text-[var(--mushaf-brown,#665b48)]">
                  {STRINGS.toPageLabel}
                </label>
                <input
                  id="to-page"
                  type="number"
                  min={1}
                  max={604}
                  value={toPage}
                  onChange={(e) => setToPage(Math.min(604, Math.max(1, Number(e.target.value))))}
                  className="mt-1 min-h-[44px] w-full rounded-lg border border-[var(--qiraat-card-stroke,#d7c7a7)] bg-[var(--mushaf-paper,#fcf8ed)] px-3 text-sm font-bold tabular-nums"
                />
              </div>
            </div>
          )}

          {/* Volume Summary Badge */}
          <div className="flex items-center justify-between rounded-lg bg-black/5 px-3 py-2 text-xs font-bold text-[var(--mushaf-brown,#665b48)]">
            <span>{STRINGS.estimatedVolume}</span>
            <span className="text-[var(--app-progress,#1A7340)]">
              {toArabicDigits(estimatedAyahCount)} {STRINGS.ayahsCount}
            </span>
          </div>

          {/* Duration Selector */}
          <div className="rounded-xl border border-[var(--qiraat-card-stroke,#d7c7a7)] bg-[var(--qiraat-card-fill,#ffffff)] p-3">
            <label htmlFor="duration-input" className="block text-xs font-bold text-[var(--mushaf-brown,#665b48)]">
              {STRINGS.durationLabel}
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {QUICK_DURATIONS.map((dur) => (
                <button
                  key={dur}
                  type="button"
                  onClick={() => setDurationMinutes(dur)}
                  className={`flex min-h-[44px] items-center justify-center rounded-lg px-3 text-xs font-bold transition-colors ${
                    durationMinutes === dur
                      ? 'bg-[var(--app-progress,#1A7340)] text-white'
                      : 'bg-black/5 text-[var(--mushaf-brown,#665b48)] hover:bg-black/10'
                  }`}
                >
                  {toArabicDigits(dur)} د
                </button>
              ))}
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <input
                id="duration-input"
                type="number"
                min={1}
                max={720}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Math.max(1, Number(e.target.value)))}
                className="min-h-[44px] w-24 rounded-lg border border-[var(--qiraat-card-stroke,#d7c7a7)] bg-[var(--mushaf-paper,#fcf8ed)] px-3 text-center text-sm font-bold tabular-nums"
              />
              <span className="text-xs font-bold text-[var(--mushaf-brown,#665b48)]">
                {STRINGS.minutesUnit}
              </span>
            </div>
          </div>

          {/* Date Picker */}
          <div className="rounded-xl border border-[var(--qiraat-card-stroke,#d7c7a7)] bg-[var(--qiraat-card-fill,#ffffff)] p-3">
            <label htmlFor="session-date" className="block text-xs font-bold text-[var(--mushaf-brown,#665b48)]">
              {STRINGS.dateLabel}
            </label>
            <input
              id="session-date"
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[var(--qiraat-card-stroke,#d7c7a7)] bg-[var(--mushaf-paper,#fcf8ed)] px-3 text-sm font-bold"
            />
          </div>

          {/* From Memory Toggle */}
          <label className="flex min-h-[44px] cursor-pointer items-center justify-between rounded-xl border border-[var(--qiraat-card-stroke,#d7c7a7)] bg-[var(--qiraat-card-fill,#ffffff)] p-3 select-none">
            <div className="space-y-0.5">
              <p className="text-sm font-bold text-[var(--mushaf-ink,#171717)]">
                {STRINGS.fromMemoryTitle}
              </p>
              <p className="text-xs text-[var(--mushaf-brown,#665b48)]">
                {STRINGS.fromMemoryDesc}
              </p>
            </div>
            <input
              type="checkbox"
              checked={isFromMemory}
              onChange={(e) => setIsFromMemory(e.target.checked)}
              className="size-5 rounded accent-[var(--app-insight,#6A3DB0)]"
            />
          </label>

          {errorMessage ? (
            <p role="alert" className="text-center text-xs font-bold text-[var(--app-danger,#B4232A)]">
              {errorMessage}
            </p>
          ) : null}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isRangeInvalid || isSubmitting}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--app-progress-fill,#1A7340)] px-4 text-base font-bold text-white shadow-sm transition-transform active:scale-[0.98] disabled:opacity-40"
          >
            <span>✓</span>
            <span>{STRINGS.confirm}</span>
          </button>
        </form>
      </div>
    </div>
  )
}
