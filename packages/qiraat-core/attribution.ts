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

export type AuthorityPill = {
  key: string
  name: string
  color: string
  kind: 'reader' | 'narrator' | 'other'
  readerId?: ReaderId
  narratorId?: NarratorId
}

/**
 * Rolls up a set of authority IDs into display pills.
 * If all narrators of a reader are present (or the reader ID is directly given),
 * rolls them up into the Imam's name (e.g. "الإمام حمزة").
 * If only one narrator of a reader is present, displays that narrator alone (e.g. "الراوي ورش").
 */
export function rollupAuthorityPills(authorityIds: readonly string[]): AuthorityPill[] {
  const normalizedIds = Array.from(new Set(authorityIds.filter(Boolean)))
  const readerMap = new Map<ReaderId, Set<NarratorId>>()
  const knownReadersSet = new Set<ReaderId>()
  const otherIds: string[] = []

  for (const id of normalizedIds) {
    if (id.includes('-')) {
      const reading = getReadingOrNull(id as ReadingId)
      if (reading) {
        const set = readerMap.get(reading.readerId) ?? new Set<NarratorId>()
        set.add(reading.narratorId)
        readerMap.set(reading.readerId, set)
      } else {
        otherIds.push(id)
      }
    } else {
      const reader = QIRAAT_READERS.find((r) => r.id === id)
      if (reader) {
        knownReadersSet.add(reader.id)
      } else {
        otherIds.push(id)
      }
    }
  }

  const pills: AuthorityPill[] = []

  for (const reader of QIRAAT_READERS) {
    const totalNarrators = narratorsOfReader(reader.id)
    const presentNarratorIds = readerMap.get(reader.id) ?? new Set<NarratorId>()
    const isExplicitReader = knownReadersSet.has(reader.id)

    if (isExplicitReader || presentNarratorIds.size >= totalNarrators.length) {
      // Both narrators are present or reader was explicitly chosen -> show READER
      pills.push({
        key: reader.id,
        name: `الإمام ${reader.nameArShort}`,
        color: readerColor(reader.id),
        kind: 'reader',
        readerId: reader.id,
      })
    } else if (presentNarratorIds.size > 0) {
      // Narrator has variant alone -> show each narrator individually
      for (const narrator of totalNarrators) {
        if (presentNarratorIds.has(narrator.id)) {
          pills.push({
            key: narrator.id,
            name: `الراوي ${narrator.nameAr}`,
            color: narratorColor(narrator.id as ReadingId),
            kind: 'narrator',
            narratorId: narrator.id,
            readerId: reader.id,
          })
        }
      }
    }
  }

  for (const id of otherIds) {
    pills.push({
      key: id,
      name: id,
      color: '#8a7c5c',
      kind: 'other',
    })
  }

  return pills
}

