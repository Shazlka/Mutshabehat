export type { AssignmentRow, Intent, MarkRow, VerseState, WordRef } from './ops'
export type DispatchLike = { ok: true } | { ok: false; error: string; orphans?: number }
