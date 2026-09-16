// Qiraat Ashr (ten canonical Quran readings) domain types.
//
// IDs are fixed forever (Part 1/35 of the spec) — never key anything by an Arabic name, and never
// collapse the two narrators both called "الدوري" (Q03-R01 "الدوري عن أبي عمرو" vs Q07-R02
// "الدوري عن الكسائي"): they are unrelated people who happen to share a name.

export type ReaderId =
  | 'Q01' | 'Q02' | 'Q03' | 'Q04' | 'Q05'
  | 'Q06' | 'Q07' | 'Q08' | 'Q09' | 'Q10'

export type NarratorId =
  | 'Q01-R01' | 'Q01-R02'
  | 'Q02-R01' | 'Q02-R02'
  | 'Q03-R01' | 'Q03-R02'
  | 'Q04-R01' | 'Q04-R02'
  | 'Q05-R01' | 'Q05-R02'
  | 'Q06-R01' | 'Q06-R02'
  | 'Q07-R01' | 'Q07-R02'
  | 'Q08-R01' | 'Q08-R02'
  | 'Q09-R01' | 'Q09-R02'
  | 'Q10-R01' | 'Q10-R02'

/**
 * A "Riwayah" (a full, independently-renderable reading of the Quran) is exactly one narrator.
 * Selecting a reader alone (e.g. "نافع") is never sufficient to render a page deterministically
 * when that reader's narrators differ (Part 16) — full-page rendering always operates at this level.
 */
export type ReadingId = NarratorId

export interface QiraatReader {
  id: ReaderId
  nameAr: string
  nameEn: string
  slug: string
  /** Parent-reader color: used when BOTH narrators of this reader apply to a variant (Part 10 Case B). */
  color: string
  sortOrder: number
}

export interface QiraatNarrator {
  id: NarratorId
  readerId: ReaderId
  nameAr: string
  nameEn: string
  slug: string
  /** Narrator color: used when only this one narrator (not its sibling) applies (Part 10 Case A). */
  color: string
  sortOrder: number
}

export interface QiraatReading {
  id: ReadingId
  readerId: ReaderId
  narratorId: NarratorId
  displayNameAr: string
  displayNameEn: string
  slug: string
  isBaseline: boolean
}

/** Hafs 'an Asim (Q05-R02) is the Mushaf 1441 baseline. Defined once, reused everywhere (Part 36). */
export const BASE_READING: ReadingId = 'Q05-R02'

export type VariantOperation =
  | 'KEEP'
  | 'REPLACE'
  | 'INSERT'
  | 'DELETE'
  | 'MERGE'
  | 'SPLIT'
  | 'DIACRITIC_CHANGE'
  | 'ORTHOGRAPHIC_CHANGE'

export type DifferenceType =
  | 'HARAKAH' | 'LETTER' | 'ADDITION' | 'OMISSION' | 'MADD' | 'HAMZ'
  | 'IMALAH' | 'IDGHAM' | 'WAQF' | 'NAQL' | 'SILAH' | 'ORTHOGRAPHY' | 'OTHER'

export const DIFFERENCE_TYPE_LABELS_AR: Record<DifferenceType, string> = {
  HARAKAH: 'حركة',
  LETTER: 'حرف',
  ADDITION: 'زيادة',
  OMISSION: 'حذف',
  MADD: 'مد',
  HAMZ: 'همز',
  IMALAH: 'إمالة',
  IDGHAM: 'إدغام',
  WAQF: 'وقف',
  NAQL: 'نقل',
  SILAH: 'صلة',
  ORTHOGRAPHY: 'رسم',
  OTHER: 'أخرى',
}

/**
 * Verification lifecycle (Part 9). Only VERIFIED/PUBLISHED records are shown to ordinary users;
 * everything earlier in the pipeline requires an explicit debug/review flag to surface at all.
 */
export type VerificationStatus = 'EXTRACTED' | 'MAPPED' | 'REVIEWED' | 'VERIFIED' | 'PUBLISHED'

export const PUBLIC_VERIFICATION_STATUSES: readonly VerificationStatus[] = ['VERIFIED', 'PUBLISHED']

export interface QiraatSource {
  id: string
  variantId: string
  sourceName: string
  sourceType: 'manuscript' | 'printed-book' | 'pdf' | 'academic' | 'other'
  pdfFilename?: string
  pdfPage?: number
  sourceReference: string
  sourceText?: string
  verificationNotes?: string
}

/**
 * One documented difference from the Hafs baseline, anchored to canonical Quran position
 * (never to a text search — Part 7). `startToken`/`endToken` are 1-based `wordIndexInAyah`
 * values into the SAME ayah (multi-ayah spans are out of scope for this engine).
 */
export interface QiraatVariant {
  id: string
  surah: number
  ayah: number
  startToken: number
  endToken: number
  operation: VariantOperation
  hafsText: string
  variantText: string
  /** Present when the variant text needs the Uthmani rasm distinct from a plain-Unicode rendering. */
  uthmaniText?: string
  differenceType: DifferenceType
  notes?: string
  verificationStatus: VerificationStatus
  /** Optional: only relevant while this record is not yet published widely. Marks demo/dev-only data. */
  synthetic?: boolean
  createdAt: string
  updatedAt: string
  /** Many-to-many attribution — which of the 20 Riwayat read this variant (never duplicated 10x). */
  readingIds: ReadingId[]
  sources?: QiraatSource[]
}

/** page-scoped payload shape returned by GET /api/mushaf-1441/qiraat */
export interface QiraatPageResponse {
  pageNumber: number
  variants: QiraatVariant[]
}
