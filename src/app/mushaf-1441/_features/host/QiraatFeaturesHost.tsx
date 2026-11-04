'use client'

// Single mount point for the iOS-parity Qiraat sheets. The viewer owns which sheet is open (it is the
// component that opens them, so it cannot sit below its own provider); this host renders the active one.
// Sheets are added here one per feature, so Mushaf1441Viewer.tsx only keeps a state hook and one mount.
import type { MushafWord } from '../../../../../packages/quran-data/mushaf1441/types'
import type { QiraatRuling, QiraatVariant } from '../../../../../packages/qiraat-core/types'
import type { QiraatComparisonFilter } from '../../_components/qiraat/types'

export type FeatureName = 'legend' | 'readerPicker' | 'pageSummary' | 'search' | 'usulIndex' | 'compare' | 'mutoon'

export interface QiraatFeaturesHostProps {
  active: FeatureName | null
  onClose: () => void
  page: number
  pages: number[]
  words: MushafWord[]
  variantsByPage: Record<number, readonly QiraatVariant[]>
  rulingsByPage: Record<number, readonly QiraatRuling[]>
  filter: QiraatComparisonFilter
  onSelectWord: (word: MushafWord) => void
  onGoToPage: (page: number) => void
}

export function QiraatFeaturesHost(props: QiraatFeaturesHostProps) {
  if (props.active === null) return null
  // Features are wired in by later tasks.
  return null
}
