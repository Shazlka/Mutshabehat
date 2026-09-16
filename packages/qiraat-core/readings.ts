import { BASE_READING } from './types'
import type { QiraatReading, ReadingId } from './types'
import { QIRAAT_NARRATORS } from './narrators'
import { getReader } from './readers'

// A "reading"/Riwayah is exactly reader+narrator (Part 8 qiraat_readings). Derived from the
// narrator table so the two never drift apart; ReadingId and NarratorId are the same ID space
// (Part 35) by design — a Riwayah IS a narrator's transmission of a reader's Qiraah.
export const QIRAAT_READINGS: readonly QiraatReading[] = QIRAAT_NARRATORS.map((narrator) => {
  const reader = getReader(narrator.readerId)
  return {
    id: narrator.id,
    readerId: reader.id,
    narratorId: narrator.id,
    displayNameAr: `${narrator.nameAr} عن ${reader.nameAr}`,
    displayNameEn: `${narrator.nameEn} an ${reader.nameEn}`,
    slug: `${narrator.slug}-an-${reader.slug}`,
    isBaseline: narrator.id === BASE_READING,
  }
})

export const QIRAAT_READING_BY_ID: Readonly<Record<ReadingId, QiraatReading>> = Object.fromEntries(
  QIRAAT_READINGS.map((reading) => [reading.id, reading])
) as Record<ReadingId, QiraatReading>

export function getReading(readingId: ReadingId): QiraatReading {
  return QIRAAT_READING_BY_ID[readingId]
}

export function readingsOfReader(readerId: string): QiraatReading[] {
  return QIRAAT_READINGS.filter((reading) => reading.readerId === readerId)
}

export { BASE_READING }
