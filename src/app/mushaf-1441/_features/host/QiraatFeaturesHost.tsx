'use client'

// Single mount point for the iOS-parity Qiraat sheets. The viewer owns which sheet is open (it is the
// component that opens them, so it cannot sit below its own provider); this host renders the active one.
// A sheet is added here per feature, so Mushaf1441Viewer.tsx only keeps a state hook and one mount.
import type { QiraatComparisonFilter } from '../../_components/qiraat/types'
import type { QiraatRuling, QiraatVariant } from '../../../../../packages/qiraat-core/types'
import { LegendSheet } from '../legend/LegendSheet'
import { ReaderPicker } from '../reader-picker/ReaderPicker'

export type FeatureName = 'legend' | 'readerPicker' | 'pageSummary' | 'search' | 'usulIndex' | 'compare' | 'mutoon'

/** Hub «المزيد» entries, in order; a feature appears once its sheet exists (the picker is the filter chip itself). */
export const HUB_ENTRIES: { name: FeatureName; label: string }[] = [
  { name: 'legend', label: 'مفتاح الألوان' },
]

export interface QiraatFeaturesHostProps {
  active: FeatureName | null
  onClose: () => void
  filter: QiraatComparisonFilter
  onFilterChange: (filter: QiraatComparisonFilter) => void
  /** Everything the viewer has loaded so far, by page number (visible pages and prefetched neighbours). */
  variantsByPage: Record<number, readonly QiraatVariant[]>
  rulingsByPage: Record<number, readonly QiraatRuling[]>
}

export function QiraatFeaturesHost({ active, onClose, filter, onFilterChange, variantsByPage, rulingsByPage }: QiraatFeaturesHostProps) {
  if (active === 'readerPicker') return <ReaderPicker filter={filter} onPick={onFilterChange} onClose={onClose} />
  if (active === 'legend') return <LegendSheet variantsByPage={variantsByPage} rulingsByPage={rulingsByPage} onClose={onClose} />
  return null
}
