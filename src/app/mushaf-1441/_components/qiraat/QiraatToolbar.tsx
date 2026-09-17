'use client'

import { QIRAAT_READERS } from '../../../../../packages/qiraat-core/readers'
import { readingsOfReader, getReading } from '../../../../../packages/qiraat-core/readings'
import { BASE_READING, type ReaderId, type ReadingId } from '../../../../../packages/qiraat-core/types'
import type { QiraatComparisonFilter, QiraatMode } from './types'

interface QiraatToolbarProps {
  mode: QiraatMode
  onModeChange: (mode: QiraatMode) => void
  selectedReadingId: ReadingId
  onReadingChange: (id: ReadingId) => void
  studyMode: boolean
  onStudyModeChange: (value: boolean) => void
  showDifferenceFromHafs: boolean
  onShowDifferenceFromHafsChange: (value: boolean) => void
  filter: QiraatComparisonFilter
  onFilterChange: (filter: QiraatComparisonFilter) => void
  includeReviewed: boolean
  onIncludeReviewedChange: (value: boolean) => void
  onOpenLegend: () => void
}

const MODE_OPTIONS: { id: QiraatMode; label: string }[] = [
  { id: 'normal', label: 'المصحف' },
  { id: 'comparison', label: 'مقارنة القراءات' },
  { id: 'riwayah', label: 'القراءة برواية' },
]

export default function QiraatToolbar({
  mode, onModeChange,
  selectedReadingId, onReadingChange,
  studyMode, onStudyModeChange,
  showDifferenceFromHafs, onShowDifferenceFromHafsChange,
  filter, onFilterChange,
  includeReviewed, onIncludeReviewedChange,
  onOpenLegend,
}: QiraatToolbarProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-1 rounded-md border border-[#d7c7a7] bg-[#fffaf0] p-1 text-[11px] font-bold">
        {MODE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onModeChange(option.id)}
            className={`min-h-9 rounded-[5px] px-2 transition-colors ${
              mode === option.id ? 'bg-[#171717] text-white' : 'text-[#59461d] hover:bg-[#fff1cf]'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {mode === 'riwayah' ? (
        <div className="space-y-2 rounded-md border border-[#d7c7a7] bg-white p-2">
          <label className="block text-[11px] font-bold text-[#80662c]">الرواية</label>
          <select
            value={selectedReadingId}
            onChange={(event) => onReadingChange(event.target.value as ReadingId)}
            className="w-full rounded-md border border-[#d7c7a7] bg-white px-2 py-2 text-sm"
          >
            {QIRAAT_READERS.map((reader) => (
              <optgroup key={reader.id} label={reader.nameAr}>
                {readingsOfReader(reader.id).map((reading) => (
                  <option key={reading.id} value={reading.id}>
                    {reading.displayNameAr}{reading.isBaseline ? ' (الأساس)' : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <label className="flex items-center justify-between gap-3 pt-1 text-[11px] text-[#3a3326]">
            <span>إظهار الاختلاف عن حفص</span>
            <input
              type="checkbox"
              disabled={selectedReadingId === BASE_READING}
              checked={showDifferenceFromHafs}
              onChange={(event) => onShowDifferenceFromHafsChange(event.target.checked)}
              className="size-4 accent-[#171717] disabled:opacity-40"
            />
          </label>
        </div>
      ) : null}

      {mode === 'comparison' ? (
        <div className="space-y-2 rounded-md border border-[#d7c7a7] bg-white p-2">
          <div className="grid grid-cols-3 gap-1 text-[11px] font-bold">
            {(['all', 'reader', 'reading'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => {
                  if (kind === 'all') onFilterChange({ kind: 'all' })
                  else if (kind === 'reader') onFilterChange({ kind: 'reader', readerId: QIRAAT_READERS[0].id })
                  else onFilterChange({ kind: 'reading', readingId: selectedReadingId !== BASE_READING ? selectedReadingId : 'Q01-R01' })
                }}
                className={`min-h-8 rounded-md border px-2 transition-colors ${
                  filter.kind === kind ? 'border-[#171717] bg-[#171717] text-white' : 'border-[#d7c7a7] text-[#59461d] hover:bg-[#fff1cf]'
                }`}
              >
                {kind === 'all' ? 'الكل' : kind === 'reader' ? 'قارئ' : 'رواية'}
              </button>
            ))}
          </div>
          {filter.kind === 'reader' ? (
            <select
              value={filter.readerId}
              onChange={(event) => onFilterChange({ kind: 'reader', readerId: event.target.value as ReaderId })}
              className="w-full rounded-md border border-[#d7c7a7] bg-white px-2 py-2 text-sm"
            >
              {QIRAAT_READERS.map((reader) => (
                <option key={reader.id} value={reader.id}>{reader.nameAr}</option>
              ))}
            </select>
          ) : null}
          {filter.kind === 'reading' ? (
            <select
              value={filter.readingId}
              onChange={(event) => onFilterChange({ kind: 'reading', readingId: event.target.value as ReadingId })}
              className="w-full rounded-md border border-[#d7c7a7] bg-white px-2 py-2 text-sm"
            >
              {QIRAAT_READERS.map((reader) => (
                <optgroup key={reader.id} label={reader.nameAr}>
                  {readingsOfReader(reader.id).map((reading) => (
                    <option key={reading.id} value={reading.id}>{reading.displayNameAr}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          ) : null}
        </div>
      ) : null}

      {mode !== 'normal' ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-[#d7c7a7] bg-white px-3 py-2 text-[11px]">
          <label className="flex items-center gap-2 font-bold text-[#3a3326]">
            <input
              type="checkbox"
              checked={studyMode}
              onChange={(event) => onStudyModeChange(event.target.checked)}
              className="size-4 accent-[#171717]"
            />
            وضع الدراسة (تمييز أوضح)
          </label>
          <button type="button" onClick={onOpenLegend} className="font-bold text-[#80662c] underline underline-offset-2">
            مفتاح القراءات
          </button>
        </div>
      ) : (
        <button type="button" onClick={onOpenLegend} className="text-[11px] font-bold text-[#80662c] underline underline-offset-2">
          مفتاح القراءات
        </button>
      )}

      {mode !== 'normal' ? (
        <label className="flex items-center justify-between gap-3 text-[10px] text-[#8a7c5c]">
          <span>عرض بيانات قيد المراجعة (غير معتمدة بعد) — لأغراض التطوير</span>
          <input
            type="checkbox"
            checked={includeReviewed}
            onChange={(event) => onIncludeReviewedChange(event.target.checked)}
            className="size-3.5 accent-[#a16207]"
          />
        </label>
      ) : null}

      <p className="text-[11px] leading-6 text-[#665b48]">
        {mode === 'normal' && 'وضع المصحف العادي: النص برواية حفص عن عاصم بلا أي رموز قراءات.'}
        {mode === 'comparison' && 'مقارنة القراءات: النص المعروض هو حفص، وتظهر خطوط ملوّنة أسفل الكلمات التي لها قراءات مختلفة. اضغط على الكلمة لعرض التفاصيل.'}
        {mode === 'riwayah' && `القراءة الحالية: ${getReading(selectedReadingId).displayNameAr}.`}
      </p>
    </div>
  )
}
