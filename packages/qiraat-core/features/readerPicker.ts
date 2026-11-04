// Labels, search and compare selection for the reader/narrator picker (iOS QiraatReaderPicker).
import { normalizeArabic } from '../../../src/lib/arabic'
import { QIRAAT_NARRATORS } from '../narrators'
import { QIRAAT_READERS, getReader } from '../readers'
import type { QiraatNarrator, QiraatReader, ReadingId } from '../types'

export type PickerFilter =
  | { kind: 'all' }
  | { kind: 'reader'; readerId: QiraatReader['id'] }
  | { kind: 'reading'; readingId: ReadingId }

/**
 * A narrator's full label. «الدوري» alone names two different people (Q03-R01 and Q07-R02), and «خلف» alone
 * is a narrator (Q06-R01) while the reader is «خلف العاشر», so a narrator whose name does not already say
 * whom he narrates from gets «… عن <reader>».
 */
export function narratorLabel(narratorId: ReadingId): string {
  const narrator = QIRAAT_NARRATORS.find((n) => n.id === narratorId)
  if (!narrator) return narratorId
  return narrator.nameAr.includes(' عن ') ? narrator.nameAr : `${narrator.nameAr} عن ${getReader(narrator.readerId).nameArShort}`
}

export function filterLabel(filter: PickerFilter): string {
  if (filter.kind === 'reader') return getReader(filter.readerId).nameAr
  if (filter.kind === 'reading') return narratorLabel(filter.readingId)
  return 'الكل'
}

/** Readers and narrators matching `query` (diacritics and alef forms ignored). A matching reader brings all of
 * its narrators; a matching narrator brings its reader. An empty query returns everything. */
export function searchReaders(query: string): { readers: QiraatReader[]; narrators: QiraatNarrator[] } {
  const q = normalizeArabic(query).trim()
  if (!q) return { readers: [...QIRAAT_READERS], narrators: [...QIRAAT_NARRATORS] }
  const readerHit = (r: QiraatReader) => normalizeArabic(r.nameAr).includes(q) || normalizeArabic(r.nameArShort).includes(q)
  const narratorHit = (n: QiraatNarrator) => normalizeArabic(narratorLabel(n.id)).includes(q)
  const narrators = QIRAAT_NARRATORS.filter((n) => narratorHit(n) || readerHit(getReader(n.readerId)))
  const readerIds = new Set([...QIRAAT_READERS.filter(readerHit).map((r) => r.id), ...narrators.map((n) => n.readerId)])
  return { readers: QIRAAT_READERS.filter((r) => readerIds.has(r.id)), narrators }
}

/** Compare selection of at most two authorities (a reader or a narrator id); a third pick drops the oldest. */
export function toggleCompare(selected: string[], id: string): string[] {
  if (selected.includes(id)) return selected.filter((x) => x !== id)
  return [...selected, id].slice(-2)
}
