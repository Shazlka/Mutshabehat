import { QIRAAT_NARRATORS } from '../narrators'
import type { NarratorId } from '../types'

export const ALL_NARRATOR_IDS: readonly NarratorId[] = QIRAAT_NARRATORS.map((n) => n.id)

export const HAFS_ID: NarratorId = 'Q05-R02'

/**
 * Expands "الباقون" (the remaining narrators) given the explicit narrators
 * attributed to other faces/wajhs at the same locus.
 */
export function expandAlBaqoon(specifiedNarrators: readonly string[]): {
  expandedIds: NarratorId[]
  hafsIncluded: boolean
  isOnlyHafs: boolean
} {
  const specifiedSet = new Set(specifiedNarrators)
  const remaining = ALL_NARRATOR_IDS.filter((id) => !specifiedSet.has(id))
  const hafsIncluded = remaining.includes(HAFS_ID)
  const isOnlyHafs = remaining.length === 1 && hafsIncluded

  return {
    expandedIds: remaining,
    hafsIncluded,
    isOnlyHafs,
  }
}

/**
 * Validates that an authority ID or reading ID is recognized
 */
export function isValidAuthorityId(id: string): boolean {
  if (id.startsWith('Q') && id.includes('-R')) {
    return ALL_NARRATOR_IDS.includes(id as NarratorId)
  }
  // Reader ID (Q01..Q10)
  return /^Q0[1-9]|Q10$/.test(id)
}
