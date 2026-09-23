// Part 10/11: color/marker logic for "who reads this variant" — never "what kind of difference".
import type { NarratorId, ReaderId, ReadingId } from './types'
import { readerColor, narratorColor } from './colors'
import { getNarrator } from './narrators'
import { getReading, getReadingOrNull } from './readings'
import { QIRAAT_READERS } from './readers'
import { narratorsOfReader } from './narrators'

export type AttributionSegment = { readerId: ReaderId; color: string; percentFrom: number; percentTo: number }

export type Attribution =
  | { kind: 'single-narrator'; narratorId: NarratorId; readerId: ReaderId; color: string }
  | { kind: 'reader'; readerId: ReaderId; color: string }
  | { kind: 'multi-reader'; segments: AttributionSegment[] }

/**
 * Groups a variant's attributed readings into the marker the Mushaf page should show.
 * - one reader, one narrator     -> Case A: narrator color
 * - one reader, both narrators   -> Case B: parent reader color
 * - more than one reader involved -> Case C: one segmented marker, one equal slice per reader
 *   (never one underline per reader — Part 10/11).
 */
export function computeAttribution(readingIds: ReadingId[]): Attribution {
  const knownReadingIds = readingIds.filter((id) => getReadingOrNull(id) !== null)
  const readerIds = Array.from(new Set(knownReadingIds.map((id) => getReading(id).readerId)))

  if (readerIds.length === 0) {
    throw new Error('computeAttribution requires at least one reading id')
  }

  if (readerIds.length === 1) {
    const readerId = readerIds[0]
    const narratorsPresent = knownReadingIds.length
    const totalNarratorsOfReader = narratorsOfReader(readerId).length
    if (narratorsPresent >= totalNarratorsOfReader) {
      return { kind: 'reader', readerId, color: readerColor(readerId) }
    }
    const narratorId = knownReadingIds[0] as NarratorId
    return { kind: 'single-narrator', narratorId, readerId, color: narratorColor(narratorId) }
  }

  const orderedReaderIds = QIRAAT_READERS
    .map((reader) => reader.id)
    .filter((readerId) => readerIds.includes(readerId))
  const step = 100 / orderedReaderIds.length
  const segments: AttributionSegment[] = orderedReaderIds.map((readerId, index) => ({
    readerId,
    color: readerColor(readerId),
    percentFrom: index * step,
    percentTo: (index + 1) * step,
  }))
  return { kind: 'multi-reader', segments }
}

/** CSS `background` value for a multi-reader segmented marker (Part 10 Case C). */
export function gradientCss(segments: AttributionSegment[]): string {
  const stops = segments.map((segment) => `${segment.color} ${segment.percentFrom}% ${segment.percentTo}%`)
  return `linear-gradient(to right, ${stops.join(', ')})`
}

/** Accessible label list (Part 20 — never rely on color alone). */
export function attributionLabelsAr(readingIds: ReadingId[]): string[] {
  return readingIds.flatMap((id) => {
    const reading = getReadingOrNull(id)
    return reading ? [getNarrator(reading.narratorId).nameAr] : []
  })
}

/** The 20 readings NOT covered by this variant — they still read the Hafs baseline text. */
export function readingsNotIn(readingIds: ReadingId[], allReadingIds: readonly ReadingId[]): ReadingId[] {
  const present = new Set(readingIds)
  return allReadingIds.filter((id) => !present.has(id))
}
