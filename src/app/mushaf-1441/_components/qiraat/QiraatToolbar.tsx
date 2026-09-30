'use client'

import { QIRAAT_READERS } from '../../../../../packages/qiraat-core/readers'
import { QIRAAT_NARRATORS } from '../../../../../packages/qiraat-core/narrators'
import { BASE_READING, type ReaderId, type ReadingId } from '../../../../../packages/qiraat-core/types'
import type { QiraatComparisonFilter, QiraatMode } from './types'

interface QiraatToolbarProps {
  mode: QiraatMode
  onModeChange: (mode: QiraatMode) => void
  selectedReadingId: ReadingId
  onReadingChange: (id: ReadingId) => void
  showDifferenceFromHafs: boolean
  onShowDifferenceFromHafsChange: (value: boolean) => void
  filter: QiraatComparisonFilter
  onFilterChange: (filter: QiraatComparisonFilter) => void
}

const MODE_OPTIONS: { id: QiraatMode; label: string }[] = [
  { id: 'normal', label: 'المصحف' },
  { id: 'comparison', label: 'مقارنة القراءات' },
  { id: 'riwayah', label: 'القراءة برواية' },
]

const tint = (color: string) => `color-mix(in srgb, ${color} 14%, white)`

/** The ten readers as a coloured list; the colour is the reader's own (same as the page underline). */
function ReaderList({ value, onChange }: { value: ReaderId; onChange: (id: ReaderId) => void }) {
  return (
    <div role="radiogroup" aria-label="القارئ" className="grid grid-cols-2 gap-1">
      {QIRAAT_READERS.map((reader) => {
        const active = reader.id === value
        return (
          <button
            key={reader.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(reader.id)}
            className="flex min-h-8 items-center gap-1.5 rounded-md border px-2 text-right text-[11px] font-bold transition-colors"
            style={{
              borderColor: active ? reader.color : '#e3d6b4',
              background: active ? tint(reader.color) : 'transparent',
              color: reader.color,
            }}
          >
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: reader.color }} />
            <span className="truncate">{reader.nameArShort}</span>
          </button>
        )
      })}
    </div>
  )
}

/** The twenty riwayat grouped under their reader, each coloured like its marker on the page. */
function RiwayahList({ value, onChange }: { value: ReadingId; onChange: (id: ReadingId) => void }) {
  return (
    <div role="radiogroup" aria-label="الرواية" className="space-y-1">
      {QIRAAT_READERS.map((reader) => (
        <div key={reader.id} className="flex items-center gap-1.5">
          <span className="flex w-[74px] shrink-0 items-center gap-1 text-[10px] font-black" style={{ color: reader.color }}>
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: reader.color }} />
            <span className="truncate">{reader.nameArShort}</span>
          </span>
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-1">
            {QIRAAT_NARRATORS.filter((narrator) => narrator.readerId === reader.id).map((narrator) => {
              const active = narrator.id === value
              return (
                <button
                  key={narrator.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onChange(narrator.id)}
                  className="min-h-8 rounded-md border px-1.5 py-1 text-[11px] font-bold leading-tight transition-colors"
                  style={{
                    borderColor: active ? narrator.color : '#e3d6b4',
                    background: active ? tint(narrator.color) : 'transparent',
                    color: reader.color,
                  }}
                  title={narrator.nameAr}
                >
                  {narrator.nameAr}{narrator.id === BASE_READING ? ' ✓' : ''}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function QiraatToolbar({
  mode, onModeChange,
  selectedReadingId, onReadingChange,
  showDifferenceFromHafs, onShowDifferenceFromHafsChange,
  filter, onFilterChange,
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
          <RiwayahList value={selectedReadingId} onChange={onReadingChange} />
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
            <ReaderList value={filter.readerId} onChange={(readerId) => onFilterChange({ kind: 'reader', readerId })} />
          ) : null}
          {filter.kind === 'reading' ? (
            <RiwayahList value={filter.readingId} onChange={(readingId) => onFilterChange({ kind: 'reading', readingId })} />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
