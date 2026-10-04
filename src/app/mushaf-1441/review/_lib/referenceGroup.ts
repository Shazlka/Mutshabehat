// Source-agnostic shape for one "reader group" of an external reference (nquran.com, الشامل), and
// the reconciliation of such a group against what is already recorded for the selected word.
// Reference data is display-only: nothing here writes anything.

import type { ReviewRow } from './types'

export type ReferenceCondition = 'both' | 'wasl' | 'waqf'

export interface ReferenceSuggestion {
  kind: 'farsh' | 'usul'
  categoryCode: string | null
}

export interface ReferenceGroup {
  /** Unique within its entry / difference. */
  key: string
  /** Shown before the colon. */
  readersLabel: string
  /** Q-ids this group covers; empty when no reader label could be resolved. */
  narratorIds: string[]
  /** Saved as each narrator's «الأداء» when the group is added. */
  performanceText: string
  readingText?: string | null
  condition?: ReferenceCondition
  conditionBasis?: string
  suggestion?: ReferenceSuggestion
  unresolvedLabels?: string[]
}

export type ReferenceDecisionStatus = 'matched' | 'recorded_unreviewed' | 'partial' | 'missing' | 'unresolved'

export interface ReferenceDecision {
  status: ReferenceDecisionStatus
  /** The existing entry (if any) the decision is based on. */
  matchedRow: ReviewRow | null
}

/**
 * Proposes what to do about one reference group, by comparing its narrator ids against the entries
 * already recorded for the currently selected word (`activeRowsForWord`). This never writes
 * anything -- it only labels a suggestion for the reviewer to act on by hand:
 *
 *  - 'matched': a REVIEWED row's narrators already cover this group exactly (or as a superset).
 *  - 'recorded_unreviewed': an existing row covers it, but that row itself isn't reviewed yet.
 *  - 'partial': some existing row shares narrators with this group but doesn't fully cover it --
 *    a real discrepancy worth a reviewer's attention.
 *  - 'missing': no existing row shares any narrator with this group -- the source documents a
 *    reading this app has no entry for yet at this word.
 *  - 'unresolved': the group's reader label(s) couldn't be mapped to a narrator id at all, so no
 *    decision can be proposed (shown so the gap is visible, never silently skipped).
 */
export function proposeReferenceDecision(
  group: { narratorIds: readonly string[] },
  existingRows: readonly ReviewRow[],
): ReferenceDecision {
  if (group.narratorIds.length === 0) {
    return { status: 'unresolved', matchedRow: null }
  }
  const wanted = new Set(group.narratorIds)
  let best: { row: ReviewRow; overlap: number; isSuperset: boolean } | null = null
  for (const row of existingRows) {
    if (row.deleted) continue
    const rowIds = new Set(row.narrators.map((n) => n.id))
    let overlap = 0
    for (const id of wanted) if (rowIds.has(id)) overlap += 1
    if (overlap === 0) continue
    const isSuperset = overlap === wanted.size
    if (!best || overlap > best.overlap || (overlap === best.overlap && isSuperset && !best.isSuperset)) {
      best = { row, overlap, isSuperset }
    }
  }
  if (!best) return { status: 'missing', matchedRow: null }
  if (best.isSuperset) {
    return {
      status: best.row.reviewStatus === 'reviewed' ? 'matched' : 'recorded_unreviewed',
      matchedRow: best.row,
    }
  }
  return { status: 'partial', matchedRow: best.row }
}

/**
 * Whether the open draft already carries every narrator of this group. The decision badge compares
 * against SAVED rows only, so without this the other source keeps offering a reading the reviewer has
 * just added, and a second ➕ creates a false second wajh (the action texts of the two sources differ).
 */
export function isGroupInDraft(group: { narratorIds: readonly string[] }, draftNarratorIds: readonly string[]): boolean {
  if (group.narratorIds.length === 0) return false
  const inDraft = new Set(draftNarratorIds)
  return group.narratorIds.every((id) => inDraft.has(id))
}
