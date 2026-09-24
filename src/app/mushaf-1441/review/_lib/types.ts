// Shared types for the qiraat review screen. They mirror the JSON returned by the
// qiraat_review_* RPCs (supabase/migrations/20260925120000_qiraat_phase4_review_api.sql).

export type ReviewStatus = 'unreviewed' | 'reviewed' | 'flagged'
export type ReadingKind = 'farsh' | 'usul'

export type ReviewWord = { key: string; surah: number; ayah: number; word: number; line: number; text: string }

export type ReviewNarrator = {
  id: string
  code: string | null
  nameAr: string
  action: string | null
  wajhOrder: number
  wajhNote: string | null
}

export type ReviewFlag = {
  id: number
  type: string
  issueAr: string
  status: 'open' | 'verified' | 'corrected' | 'ignored'
  createdAt: string
  resolvedNote: string | null
  resolvedAt: string | null
}

export type ReviewRow = {
  entryId: string
  locationId: string
  version: string
  kind: ReadingKind
  categoryCode: string | null
  categoryNameAr: string | null
  surah: number
  ayah: number
  startWord: number
  endAyah: number
  endWord: number
  startKey: string
  endKey: string
  page: number
  hafsText: string
  readingText: string | null
  uthmaniText: string | null
  description: string | null
  performanceNote: string | null
  variantType: string | null
  rulingText: string | null
  options: string[] | null
  notes: string | null
  reviewStatus: ReviewStatus
  locationReviewStatus: ReviewStatus
  verificationStatus: string
  legacyRef: string | null
  entryOrder: number
  deleted: boolean
  narrators: ReviewNarrator[]
  flags: ReviewFlag[]
}

export type CatalogNarrator = {
  id: string
  code: string | null
  nameAr: string
  parentId: string | null
  type: 'reader' | 'narrator' | 'route'
  color: string | null
}

export type ReviewPage = {
  page: number
  words: ReviewWord[]
  rows: ReviewRow[]
  stats: { total: number; unreviewed: number; reviewed: number; flagged: number; deleted: number }
  narrators: CatalogNarrator[]
  categories: { code: string; nameAr: string }[]
  variantTypes: string[]
}

export type PageProgress = { page: number; total: number; unreviewed: number; reviewed: number; flagged: number }
export type ReviewOverview = { isEditor: boolean; pages: PageProgress[] }

export type HistoryChange = { table: string; rowId: string; op: 'INSERT' | 'UPDATE' | 'DELETE'; field: string | null; old: unknown; new: unknown }
export type HistoryTransaction = { txid: number; at: string; deviceId: string | null; undone: boolean; entryId: string | null; changes: HistoryChange[] }

export type NarratorInput = { id: string; action?: string | null; wajhOrder?: number; wajhNote?: string | null }
export type CreateEntryInput = {
  surah: number
  ayah: number
  startWord: number
  endAyah?: number
  endWord?: number
  kind: 'farsh' | 'usul'
  readingText?: string
  uthmaniText?: string | null
  description?: string | null
  performanceNote?: string | null
  variantType?: string
  categoryCode?: string
  rulingText?: string | null
  notes?: string | null
  narrators: NarratorInput[]
}
export type EntryFields = Partial<{
  notes: string | null
  readingText: string
  uthmaniText: string | null
  description: string | null
  performanceNote: string | null
  variantType: string
  categoryCode: string
  rulingText: string | null
}>

export type ReviewErrorCode =
  | 'unauthorized' | 'forbidden' | 'VERSION_CONFLICT' | 'RULE_D8' | 'RULE_NARRATOR_TWICE'
  | 'RULE_EMPTY_LOCATION' | 'UNDO_CONFLICT' | 'UNDO_REFUSED' | 'not_found' | 'bad_request' | 'unavailable'

export type ReviewError = { code: ReviewErrorCode; status: number; message: string; messageAr?: string }
export type ReviewResult<T> = { ok: true; data: T } | { ok: false; error: ReviewError }
