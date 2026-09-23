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
  /** Short display name (no nisba/city, e.g. "عاصم" not "عاصم الكوفي") for compact UI like pills —
   * a fixed lookup table, never derived by string-splitting nameAr (Q10 "خلف العاشر" must stay
   * whole: it is NOT interchangeable with narrator Q06-R01 "خلف"). */
  nameArShort: string
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
  HARAKAH: 'تشكيل',
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
 * `NEEDS_MANUAL_REVIEW` (pages 1-10 batch, Part 3) is distinct from `REVIEWED`: it marks a record
 * whose exact wording/attribution could not be confidently resolved from the available source at
 * all — not merely "not yet independently re-checked" — and it must never be promoted by anything
 * other than an explicit human decision after reading the primary source.
 */
export type VerificationStatus = 'EXTRACTED' | 'MAPPED' | 'REVIEWED' | 'NEEDS_MANUAL_REVIEW' | 'VERIFIED' | 'PUBLISHED'

export const PUBLIC_VERIFICATION_STATUSES: readonly VerificationStatus[] = ['VERIFIED', 'PUBLISHED']

export interface QiraatSource {
  id: string
  /** Exactly one of `variantId`/`ruleId` is set, matching whether this source backs a
   * `QiraatVariant` or a `QiraatRule`. */
  variantId?: string
  ruleId?: string
  sourceName: string
  sourceType: 'manuscript' | 'printed-book' | 'pdf' | 'academic' | 'other'
  pdfFilename?: string
  pdfPage?: number
  sourceReference: string
  sourceText?: string
  verificationNotes?: string
}

/**
 * Whether a locus's difference is a spelling/text change, a phonetic/performance-only difference
 * (no display text change — Part 23), or a difference spanning more than one Quran word.
 */
export type LocusType = 'word_variant' | 'multi_word_variant' | 'performance_variant'

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
  /** Source wording/action detail that distinguishes otherwise identical reading forms. */
  description?: string
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
  /**
   * Groups multiple `QiraatVariant` records that represent ONE conceptual source location
   * spanning more than one token — either disjoint words in the same ayah (e.g. 2:37's آدم +
   * كلمات) or the same word repeated across ayahs (e.g. 2:2 and 2:5's هدى). Each record still
   * resolves independently through the normal per-token engine; `locusId` is display-only, used
   * to group them back together in the tap/detail panel. Absent for an ordinary single-word locus.
   */
  locusId?: string
  locusType?: LocusType
  /**
   * A phonetic/performance description (e.g. "إشمام الصاد زايًا", "ضم الهاء") for a variant that
   * does not change the displayed text at all (`variantText === hafsText`) — Part 23's rule that
   * not every Qiraat difference is a Unicode text difference. Shown in the tap/detail panel
   * alongside — or instead of — a text diff; never encoded as a fake spelling change.
   */
  performanceNote?: string
}

/**
 * A page-level Qiraat "rule" — procedural/recitation guidance that is NOT anchored to one Quran
 * token the way a `QiraatVariant` is (عدّ الآي ayah-counting conventions, الإدغام الكبير merging
 * across an ayah boundary, أوجه الوصل بين السورتين connection options at a surah break, مد قبل
 * الإدغام الكبير length options, and similar). Modeled separately from `QiraatVariant` rather than
 * forced into it: a rule is page/boundary-scoped, not a single-token REPLACE/DIACRITIC_CHANGE, and
 * several rule categories (عدّ الآي in particular) are attributed to Basran/Meccan/Kufan/etc.
 * ayah-counting schools — an entirely different, unrelated taxonomy from the ten-reader/twenty-
 * narrator `ReadingId` model, so it must never be force-fit into `readingIds`.
 */
export interface QiraatRule {
  id: string
  pageNumber: number
  /** Arabic category label verbatim from the source (e.g. "عد الآي", "الإدغام الكبير",
   * "الأوجه بين السورتين", "المد قبل الإدغام الكبير"). Kept as free text rather than a closed enum
   * so a newly-encountered category from a later page never needs a type change to import. */
  category: string
  /** The Quran text span (with an ayah-boundary marker like ۝) this rule concerns, when the rule
   * names one — e.g. "الرحيم ۝ مالك" for an idgham-across-boundary rule. */
  text?: string
  /** The rule's own named option/reading, when it has one distinct label (e.g. "البسملة", "الوصل",
   * "السكت أو الوصل") — distinct from `options`, which is an unattributed enumerated list. */
  reading?: string
  /** An enumerated list of choices with no reader/narrator attribution at all (e.g. القصر/التوسط/
   * الإشباع for a madd-length rule) — every reader may choose among these, so there is nothing to
   * attribute per-reading. */
  options?: string[]
  /** Reader/narrator attribution, ONLY when it genuinely resolves onto the 20-reading taxonomy
   * (Part 1/2's ReadingId model). Absent — never guessed — for a rule attributed to an
   * ayah-counting school; see `attributionLabel` for that case instead. */
  readingIds?: ReadingId[]
  /** Free-text attribution verbatim from the source for a rule that is NOT reader/narrator-scoped
   * (e.g. an ayah-counting school name like "المكي"/"الكوفي"). Never encoded as `readingIds`. */
  attributionLabel?: string
  verificationStatus: VerificationStatus
  notes?: string
  sources?: QiraatSource[]
}

/** page-scoped payload shape returned by GET /api/mushaf-1441/qiraat */
export interface QiraatPageResponse {
  pageNumber: number
  variants: QiraatVariant[]
  rules: QiraatRule[]
}

/**
 * One occurrence of an أصول (usul) ruling, anchored to a real Mushaf-1441 token span.
 *
 * A ruling never changes the printed rasm — it says HOW a word is performed (إمالة، تقليل، ترقيق،
 * تغليظ، إدغام، سكت، غنة، مد، وقف …). It is therefore rendered as a COLOUR on the word, one fixed
 * colour per usul family, so a reader can see at a glance that a ruling applies and of which kind.
 *
 * Distinct from `QiraatVariant` (which does change the rasm) and from `QiraatRule` (a page-level
 * convention with no token anchor at all). Every record here was resolved against the real
 * Mushaf-1441 word fixtures by scripts/qiraat/build_rulings.py — never hand-typed.
 */
export interface QiraatRulingAttribution {
  /** Reader (Q0N) or narrator (Q0N-R0M) — whichever level the source actually used. */
  authorityId: string
  /** What this authority does here: إمالة / تقليل / ترقيق / إدغام … One word can carry two
   * different actions by different groups (﴿بِٱلْهُدَىٰ﴾: إمالة for حمزة, تقليل for ورش). */
  action: string
  /** "وقفًا" / "وصلًا" / "بخلف عنه" — the source's own qualifier, verbatim. */
  condition?: string
}

export interface QiraatRulingReading {
  readingId: ReadingId
  action: string
  /** false when this is the second of two valid وجهان («بخلف عنه») for that Riwayah. */
  isDefault: boolean
}

export interface QiraatRuling {
  id: string
  pageNumber: number
  /** Stable category code (IMALAH_TAQLIL, IDGHAM_KABIR, TARQIQ_RA …). */
  category: string
  categoryAr: string
  /** The one colour for this usul family. Same colour for إمالة and تقليل, for both إدغام kinds,
   * for ترقيق and تغليظ, and so on — the grouping the reader asked for. */
  color: string
  wordAnchored: boolean
  surah: number
  ayah: number
  startToken: number
  endToken: number
  endAyah: number
  /** Taken verbatim from the Mushaf-1441 fixture, never hand-typed. */
  baseText: string
  verificationStatus: VerificationStatus
  attribution: QiraatRulingAttribution[]
  readings: QiraatRulingReading[]
  /** True when some Riwayah has two valid وجهان here — the word is marked ذو وجهين. */
  hasAlternate: boolean
  text?: string
  condition?: string
  /** عد الآي only: ayah-counting schools, a taxonomy unrelated to the ten readers. */
  countSchools?: string[]
  notes?: string
  /** Exact source refinements kept separately so additive imports never rewrite prior notes. */
  sourceNotes?: string[]
  createdAt: string
  updatedAt: string
}
