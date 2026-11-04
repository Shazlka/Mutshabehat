'use client'

import { useEffect, useRef } from 'react'
import { filterLabel } from '../../../../../packages/qiraat-core/features/readerPicker'
import type { QiraatComparisonFilter } from '../../_components/qiraat/types'
import type { FeatureName } from '../host/QiraatFeaturesHost'
import type { SyncOutcome } from '../../../../../packages/qiraat-core/features/syncStatus'
import { SyncStatusChip } from '../sync-status/SyncStatusChip'

// The Qiraat entry row: the filter chip (opens the picker) and the «المزيد» menu listing the sheets that exist
// (colour key, page summary, search, usul index, compare, «المتون»).
export function QiraatHubBar(props: {
  filter: QiraatComparisonFilter
  entries: { name: FeatureName; label: string }[]
  onOpen: (name: FeatureName) => void
  sync?: { outcome: SyncOutcome | null; lastSuccess: number | null }
}) {
  const { filter, entries, onOpen, sync } = props
  const menu = useRef<HTMLDetailsElement>(null)
  // The «المزيد» menu closes on Escape and on a click outside it, like any menu.
  useEffect(() => {
    const close = (event: Event) => {
      const el = menu.current
      if (!el?.open) return
      if (event.type === 'keydown' && (event as KeyboardEvent).key !== 'Escape') return
      if (event.type === 'pointerdown' && el.contains(event.target as Node)) return
      el.open = false
    }
    document.addEventListener('keydown', close)
    document.addEventListener('pointerdown', close)
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('pointerdown', close) }
  }, [])
  const active = filter.kind !== 'all'
  return (
    <div data-testid="qiraat-hub" className="flex flex-wrap items-center gap-2" dir="rtl">
      <button
        type="button"
        data-testid="filter-chip"
        onClick={() => onOpen('readerPicker')}
        aria-label={`تصفية القراءات: ${filterLabel(filter)}`}
        className={`min-h-6 rounded-full border px-3 py-0.5 text-[11px] font-bold [@media(pointer:coarse)]:min-h-11 ${
          active ? 'border-[var(--mushaf-ink)] bg-[var(--mushaf-ink)] text-white' : 'border-[var(--mushaf-rule)] text-[var(--mushaf-ink)]'
        }`}
      >
        {active ? '✓ ' : ''}{filterLabel(filter)}
      </button>
      {sync ? <SyncStatusChip outcome={sync.outcome} lastSuccess={sync.lastSuccess} /> : null}
      {entries.length > 0 ? (
        <details ref={menu} data-testid="hub-menu" className="relative">
          <summary className="min-h-6 cursor-pointer list-none rounded border border-[var(--mushaf-rule)] px-3 py-0.5 text-[11px] font-bold [@media(pointer:coarse)]:min-h-11">
            المزيد ▾
          </summary>
          <ul className="absolute start-0 z-10 mt-1 min-w-40 rounded-lg border border-[var(--mushaf-rule)] bg-white p-1 shadow">
            {entries.map((entry) => (
              <li key={entry.name}>
                <button
                  type="button"
                  data-testid={`hub-${entry.name}`}
                  onClick={(event) => {
                    event.currentTarget.closest('details')?.removeAttribute('open')
                    onOpen(entry.name)
                  }}
                  className="min-h-6 w-full rounded px-2 py-1 text-start text-xs font-bold hover:bg-[var(--mushaf-cream-3)] [@media(pointer:coarse)]:min-h-11"
                >
                  {entry.label}
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}
