import type { ReaderId, ReadingId } from '../../../../../packages/qiraat-core/types'

export type QiraatMode = 'normal' | 'comparison' | 'riwayah'

export type QiraatComparisonFilter =
  | { kind: 'all' }
  | { kind: 'reader'; readerId: ReaderId }
  | { kind: 'reading'; readingId: ReadingId }

export const QIRAAT_PREFS_STORAGE_KEY = 'mushaf1441:qiraat-prefs:v1'

export interface QiraatPrefs {
  mode: QiraatMode
  selectedReadingId: ReadingId
  studyMode: boolean
  showDifferenceFromHafs: boolean
  filter: QiraatComparisonFilter
}
