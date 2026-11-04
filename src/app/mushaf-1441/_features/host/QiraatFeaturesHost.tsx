'use client'

// Single mount point for the iOS-parity Qiraat sheets. The viewer owns which sheet is open (it is the
// component that opens them, so it cannot sit below its own provider); this host renders the active one.
// A sheet is added here per feature, so Mushaf1441Viewer.tsx only keeps a state hook and one mount.
import type { QiraatComparisonFilter } from '../../_components/qiraat/types'
import { ReaderPicker } from '../reader-picker/ReaderPicker'

export type FeatureName = 'legend' | 'readerPicker' | 'pageSummary' | 'search' | 'usulIndex' | 'compare' | 'mutoon'

/** Hub «المزيد» entries, in order; a feature appears once its sheet exists (the picker is the filter chip itself). */
export const HUB_ENTRIES: { name: FeatureName; label: string }[] = []

export interface QiraatFeaturesHostProps {
  active: FeatureName | null
  onClose: () => void
  filter: QiraatComparisonFilter
  onFilterChange: (filter: QiraatComparisonFilter) => void
}

export function QiraatFeaturesHost({ active, onClose, filter, onFilterChange }: QiraatFeaturesHostProps) {
  if (active === 'readerPicker') return <ReaderPicker filter={filter} onPick={onFilterChange} onClose={onClose} />
  return null
}
