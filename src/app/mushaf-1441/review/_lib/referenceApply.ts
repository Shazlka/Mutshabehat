// What pressing ➕ on a reference group does to the editor's draft -- as a pure function so the rules
// are testable without React. Nothing here saves anything: the reviewer still presses «حفظ».

import { HAFS_ID } from '../_components/ReaderNarratorSelector'
import { nextWajhOrder } from '../_components/ImalahDetailFields'
import type { ReferenceGroup, ReferenceSuggestion } from './referenceGroup'
import type { NarratorInput } from './types'

export type ReferenceSourceId = 'nquran' | 'shamil'

export interface ApplyContext {
  narrators: NarratorInput[]
  readingText: string
  /** The Hafs word the editor pre-fills into a new draft's reading field; it counts as "not typed yet". */
  defaultReadingText: string
  kind: 'farsh' | 'usul'
  categoryCode: string | null
  /** An add-mode draft with no narrators yet: nothing the reviewer typed can be overwritten. */
  isFreshDraft: boolean
  /** Narrators of the word's OTHER active farsh rows (for the one-wajh-1-per-narrator rule). */
  otherFarshNarrators: { id: string; wajhOrder: number }[]
}

/** Only the fields that change are set; absent means "leave the draft's value alone". */
export interface ApplyPlan {
  narrators: NarratorInput[]
  readingText?: string
  kind?: 'farsh' | 'usul'
  appliesWasl?: boolean
  appliesWaqf?: boolean
  categoryCode?: string
  /** Part of the suggestion that was not applied -- the panel offers it as a click-to-apply chip. */
  pendingSuggestion: ReferenceSuggestion | null
}

const HAFS_NOTE: Record<ReferenceSourceId, string> = {
  nquran: 'مستورد من مرجع nquran.com',
  shamil: 'مستورد من مرجع الشامل',
}

export function planApplyReferenceGroup(source: ReferenceSourceId, group: ReferenceGroup, ctx: ApplyContext): ApplyPlan {
  const performance = group.performanceText || null
  // wajh numbering must also respect the other active farsh rows at this word (DB rule
  // QIRAAT_NARRATOR_TWICE), and Hafs is floored at wajh 2 with a note (rule D8).
  const narrators = [...ctx.narrators]
  for (const id of group.narratorIds) {
    if (narrators.some((n) => n.id === id && (n.action ?? null) === performance)) continue
    const wajhOrder = nextWajhOrder([...ctx.otherFarshNarrators, ...narrators], id)
    const wajhNote = id === HAFS_ID ? performance || HAFS_NOTE[source] : null
    narrators.push({ id, action: performance, wajhOrder, wajhNote })
  }

  const plan: ApplyPlan = { narrators, pendingSuggestion: null }

  // Never overwrite what the reviewer typed. A new draft starts with the Hafs word in the field, which
  // is not their input, so on a fresh draft that default is replaced too.
  const typed = ctx.readingText.trim()
  const readingIsUntouched = typed === '' || (ctx.isFreshDraft && typed === ctx.defaultReadingText.trim())
  if (group.readingText && readingIsUntouched) plan.readingText = group.readingText

  const suggestion = group.suggestion
  if (ctx.isFreshDraft) {
    if (suggestion) plan.kind = suggestion.kind
    if (group.condition) {
      plan.appliesWasl = group.condition !== 'waqf'
      plan.appliesWaqf = group.condition !== 'wasl'
    }
  }

  if (suggestion) {
    const finalKind = plan.kind ?? ctx.kind
    const canApplyCategory =
      suggestion.categoryCode !== null && suggestion.kind === 'usul' && finalKind === 'usul' && ctx.categoryCode === null
    if (canApplyCategory) plan.categoryCode = suggestion.categoryCode as string
    const categoryLeft = suggestion.categoryCode !== null && !canApplyCategory
    if (categoryLeft || suggestion.kind !== finalKind) plan.pendingSuggestion = suggestion
  }

  return plan
}
