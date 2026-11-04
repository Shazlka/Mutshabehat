'use client'

import { useMemo, useState } from 'react'
import { narratorColor, readerColor } from '../../../../../packages/qiraat-core/colors'
import { filterLabel, narratorLabel, searchReaders, toggleCompare } from '../../../../../packages/qiraat-core/features/readerPicker'
import type { QiraatComparisonFilter } from '../../_components/qiraat/types'
import { Glyph } from '../host/Glyph'
import { FeatureSheet } from '../host/FeatureSheet'

const ROW =
  'flex min-h-6 w-full items-center gap-2 rounded border px-2 py-1 text-start text-xs font-bold [@media(pointer:coarse)]:min-h-11'

/** Full-screen reader/narrator picker: choose what the page is filtered to, or (with `onCompare`) pick two to compare. */
export function ReaderPicker(props: {
  filter: QiraatComparisonFilter
  onPick: (filter: QiraatComparisonFilter) => void
  onClose: () => void
  onCompare?: (ids: [string, string]) => void
}) {
  const { filter, onPick, onClose, onCompare } = props
  const [query, setQuery] = useState('')
  const [compare, setCompare] = useState<string[]>([])
  const { readers, narrators } = useMemo(() => searchReaders(query), [query])
  const comparing = onCompare !== undefined

  const isSelected = (kind: 'all' | 'reader' | 'reading', id?: string) =>
    filter.kind === kind && (kind === 'all' || (filter.kind === 'reader' ? filter.readerId === id : filter.kind === 'reading' && filter.readingId === id))

  return (
    <FeatureSheet title="القارئ والراوي" onClose={onClose} testId="reader-picker">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="ابحث عن قارئ أو راوٍ"
        aria-label="ابحث عن قارئ أو راوٍ"
        className="mb-3 min-h-6 w-full rounded border border-[var(--mushaf-rule)] bg-white px-3 py-1.5 text-sm [@media(pointer:coarse)]:min-h-11"
      />
      {comparing ? (
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-[var(--qx-muted)]">اختر اثنين للمقارنة ({compare.length}/2)</span>
          <button
            type="button"
            data-testid="compare-go"
            disabled={compare.length !== 2}
            onClick={() => onCompare?.([compare[0], compare[1]])}
            className="min-h-6 rounded border border-[var(--mushaf-ink)] bg-[var(--mushaf-ink)] px-3 text-xs font-bold text-white disabled:opacity-40 [@media(pointer:coarse)]:min-h-11"
          >
            قارن
          </button>
        </div>
      ) : (
        <button
          type="button"
          aria-pressed={isSelected('all')}
          onClick={() => { onPick({ kind: 'all' }); onClose() }}
          className={`${ROW} mb-2 border-[var(--mushaf-rule)]`}
        >
          {isSelected('all') ? <><Glyph>✓</Glyph>{' '}</> : null}الكل
        </button>
      )}
      <ul className="space-y-3">
        {readers.map((reader) => (
          <li key={reader.id} className="rounded-lg border border-[var(--mushaf-rule-soft)] p-2">
            <PickRow
              label={reader.nameAr}
              color={readerColor(reader.id)}
              selected={comparing ? compare.includes(reader.id) : isSelected('reader', reader.id)}
              comparing={comparing}
              onClick={() => {
                if (comparing) setCompare((c) => toggleCompare(c, reader.id))
                else { onPick({ kind: 'reader', readerId: reader.id }); onClose() }
              }}
            />
            <ul className="mt-1 space-y-1 ps-4">
              {narrators.filter((n) => n.readerId === reader.id).map((narrator) => (
                <li key={narrator.id}>
                  <PickRow
                    label={narratorLabel(narrator.id)}
                    color={narratorColor(narrator.id)}
                    selected={comparing ? compare.includes(narrator.id) : isSelected('reading', narrator.id)}
                    comparing={comparing}
                    onClick={() => {
                      if (comparing) setCompare((c) => toggleCompare(c, narrator.id))
                      else { onPick({ kind: 'reading', readingId: narrator.id }); onClose() }
                    }}
                  />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {readers.length === 0 ? <p className="text-xs text-[var(--qx-muted)]">لا نتائج لـ «{query}».</p> : null}
      <p className="mt-3 text-[11px] text-[var(--qx-muted)]">الاختيار الحالي: {filterLabel(filter.kind === 'reading' ? { kind: 'reading', readingId: filter.readingId } : filter)}</p>
    </FeatureSheet>
  )
}

function PickRow(props: { label: string; color: string; selected: boolean; comparing: boolean; onClick: () => void }) {
  const { label, color, selected, comparing, onClick } = props
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`${ROW} ${selected ? 'border-[var(--mushaf-ink)] bg-white' : 'border-transparent'}`}
    >
      <span aria-hidden="true" className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />
      <span className="flex-1">{label}</span>
      {selected ? <span aria-hidden="true">{comparing ? '☑' : '✓'}</span> : comparing ? <span aria-hidden="true">☐</span> : null}
    </button>
  )
}
