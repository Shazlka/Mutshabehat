import ayahLayout from '../../public/quran/ayah-layout.json'
import { QuranIndex, type AyahLayoutFile } from '../../packages/memorization-core/quranIndex'
import pageMetadataFixture from '../../packages/quran-data/mushaf1441/fixtures/page-metadata.json'
import {
  type AyahKey,
  type BatchPlan,
  makeAyahKey,
  MemorizationStatus,
  TOTAL_QURAN_AYAHS,
  MUSHAF_PAGE_COUNT,
} from '../../packages/memorization-core/types'
import {
  type MemorizationSelection,
  makeSurahSelection,
  makeAyahRangeSelection,
  makePageRangeSelection,
  makeJuzSelection,
  makeAyatSelection,
} from '../../packages/memorization-core/selection'
import type { Milestone } from '../../packages/memorization-core/planner'
import type { PeriodGains } from '../../packages/memorization-core/statistics'

// --- 1. Arabic Status Labels & Shapes ---

export const MEMORIZATION_STATUS_LABELS: Readonly<Record<MemorizationStatus, string>> = {
  [MemorizationStatus.mastered]: 'متقن',
  [MemorizationStatus.memorizedWithErrors]: 'محفوظ مع أخطاء',
  [MemorizationStatus.needsMushaf]: 'يحتاج المصحف',
  [MemorizationStatus.notMemorized]: 'غير محفوظ',
}

export const MEMORIZATION_STATUS_SHORT_LABELS: Readonly<Record<MemorizationStatus, string>> = {
  [MemorizationStatus.mastered]: 'متقن',
  [MemorizationStatus.memorizedWithErrors]: 'مع أخطاء',
  [MemorizationStatus.needsMushaf]: 'يحتاج المصحف',
  [MemorizationStatus.notMemorized]: 'غير محفوظ',
}

export const MEMORIZATION_STATUS_SHAPES: Readonly<Record<MemorizationStatus, string>> = {
  [MemorizationStatus.mastered]: '✓✓',
  [MemorizationStatus.memorizedWithErrors]: '!',
  [MemorizationStatus.needsMushaf]: '◐',
  [MemorizationStatus.notMemorized]: '○',
}

export function getStatusLabel(status: MemorizationStatus, short = false): string {
  return short
    ? MEMORIZATION_STATUS_SHORT_LABELS[status] ?? 'غير محفوظ'
    : MEMORIZATION_STATUS_LABELS[status] ?? 'غير محفوظ'
}

export function getStatusShape(status: MemorizationStatus): string {
  return MEMORIZATION_STATUS_SHAPES[status] ?? '○'
}

// --- 2. Number & Percentage Formatting (Latin digits per web chrome rules) ---

export function formatPercent(value: number): string {
  const clamped = Math.min(100, Math.max(0, value))
  return `${clamped.toFixed(1)}%`
}

export function formatNumber(value: number): string {
  return value.toLocaleString('en-US')
}

export function formatDecimal(value: number): string {
  return value.toFixed(1)
}

// --- 3. Surah Metadata & Names ---

export interface SurahMeta {
  readonly surahNumber: number
  readonly name: string
  readonly ayahCount: number
  readonly firstPage: number | null
  readonly lastPage: number | null
}

interface PageMetadataJson {
  pages: Array<{
    pageNumber: number
    juzNumber: number
    firstAyahKey: string
    lastAyahKey: string
    surahNumbers: number[]
    surahNames: string[]
  }>
  ayahToPage: Record<string, number>
  surahs: SurahMeta[]
}

const typedFixture = pageMetadataFixture as PageMetadataJson

const SURAH_NAME_MAP: Readonly<Record<number, string>> = Object.freeze(
  typedFixture.surahs.reduce<Record<number, string>>((acc, s) => {
    acc[s.surahNumber] = s.name
    return acc
  }, {}),
)

export function getSurahName(surah: number): string {
  return SURAH_NAME_MAP[surah] ?? String(surah)
}

export function getAllSurahNames(): Readonly<Record<number, string>> {
  return SURAH_NAME_MAP
}

export function getAllSurahMetas(): readonly SurahMeta[] {
  return typedFixture.surahs
}

// --- 4. Browser QuranIndex (the core class, built from the precomputed layout) ---

export type { PageRange } from '../../packages/memorization-core/quranIndex'
/** The tested core index; in the browser it is built from `public/quran/ayah-layout.json` (no node:fs). */
export type BrowserQuranIndex = QuranIndex

let browserIndexSingleton: QuranIndex | null = null

export function getBrowserQuranIndex(): QuranIndex {
  if (!browserIndexSingleton) {
    browserIndexSingleton = QuranIndex.fromLayout(ayahLayout as unknown as AyahLayoutFile)
  }
  return browserIndexSingleton
}

// --- 5. Selection Form State & Mapping ---

export type UpdateSelectionMode = 'surah' | 'ayat' | 'pages' | 'juz' | 'custom'

export interface UpdateFormValues {
  mode: UpdateSelectionMode
  surah: number
  fromAyah: number
  toAyah: number
  fromPage: number
  toPage: number
  juz: number
  customSelection?: MemorizationSelection
}

export const DEFAULT_FORM_VALUES: UpdateFormValues = {
  mode: 'surah',
  surah: 1,
  fromAyah: 1,
  toAyah: 7,
  fromPage: 1,
  toPage: 1,
  juz: 1,
}

export function selectionToFormValues(
  selection: MemorizationSelection,
  index: BrowserQuranIndex = getBrowserQuranIndex(),
): UpdateFormValues {
  const values: UpdateFormValues = { ...DEFAULT_FORM_VALUES }

  switch (selection.type) {
    case 'surah':
      values.mode = 'surah'
      values.surah = selection.surah
      values.fromAyah = 1
      values.toAyah = Math.max(1, index.ayahCount(selection.surah))
      break

    case 'ayahRange':
      values.mode = 'ayat'
      values.surah = selection.surah
      values.fromAyah = Math.min(selection.from, selection.to)
      values.toAyah = Math.max(selection.from, selection.to)
      break

    case 'pageRange':
      values.mode = 'pages'
      values.fromPage = Math.min(selection.startPage, selection.endPage)
      values.toPage = Math.max(selection.startPage, selection.endPage)
      break

    case 'juz':
      values.mode = 'juz'
      values.juz = selection.juz
      break

    case 'span':
      if (selection.from.surah === selection.to.surah) {
        values.mode = 'ayat'
        values.surah = selection.from.surah
        values.fromAyah = Math.min(selection.from.ayah, selection.to.ayah)
        values.toAyah = Math.max(selection.from.ayah, selection.to.ayah)
      } else {
        values.mode = 'custom'
        values.customSelection = selection
      }
      break

    case 'ayat':
      values.mode = 'custom'
      values.customSelection = selection
      break
  }

  return values
}

export function formValuesToSelection(values: UpdateFormValues): MemorizationSelection {
  switch (values.mode) {
    case 'surah':
      return makeSurahSelection(values.surah)
    case 'ayat':
      return makeAyahRangeSelection(
        values.surah,
        Math.min(values.fromAyah, values.toAyah),
        Math.max(values.fromAyah, values.toAyah),
      )
    case 'pages':
      return makePageRangeSelection(
        Math.min(values.fromPage, values.toPage),
        Math.max(values.fromPage, values.toPage),
      )
    case 'juz':
      return makeJuzSelection(values.juz)
    case 'custom':
      return values.customSelection ?? makeAyatSelection([])
  }
}

// --- 6. Selection Label & Plan Preview Summary ---

export function getSelectionLabel(
  selection: MemorizationSelection,
  getSurahNameFn: (s: number) => string = getSurahName,
): string {
  switch (selection.type) {
    case 'surah':
      return `سورة ${getSurahNameFn(selection.surah)}`

    case 'ayahRange': {
      const name = getSurahNameFn(selection.surah)
      const low = Math.min(selection.from, selection.to)
      const high = Math.max(selection.from, selection.to)
      return `${name} ${low}–${high}`
    }

    case 'pageRange': {
      const low = Math.min(selection.startPage, selection.endPage)
      const high = Math.max(selection.startPage, selection.endPage)
      return low === high ? `صفحة ${low}` : `صفحات ${low}–${high}`
    }

    case 'juz':
      return `الجزء ${selection.juz}`

    case 'span': {
      const s1 = getSurahNameFn(selection.from.surah)
      const s2 = getSurahNameFn(selection.to.surah)
      return `${s1} ${selection.from.ayah} → ${s2} ${selection.to.ayah}`
    }

    case 'ayat':
      return `آيات محددة (${selection.keys.length})`
  }
}

export interface PlanPreviewSummary {
  readonly title: string
  readonly message: string
  readonly changedCount: number
  readonly unchangedCount: number
  readonly gainAyahs: number
  readonly statusLabel: string
  readonly scopeLabel: string
}

export function summarizePlanPreview(
  plan: BatchPlan,
  status: MemorizationStatus,
  scopeLabel: string,
): PlanPreviewSummary {
  const statusLabel = getStatusLabel(status)
  const changed = plan.changes.length
  let message = `سيتم تحديث ${changed} آية من ${scopeLabel} إلى «${statusLabel}».`
  if (plan.unchangedCount > 0) {
    message += ` (${plan.unchangedCount} منها بهذه الحالة بالفعل)`
  }

  return {
    title: 'تأكيد التحديث',
    message,
    changedCount: changed,
    unchangedCount: plan.unchangedCount,
    gainAyahs: plan.gainAyahs,
    statusLabel,
    scopeLabel,
  }
}

// --- 7. Milestone Description (Arabic & English) ---

export function describeMilestone(
  milestone: Milestone,
  language: 'arabic' | 'english' = 'arabic',
  getSurahNameFn: (s: number) => string = getSurahName,
): string {
  if (language === 'english') {
    switch (milestone.type) {
      case 'surahCompleted':
        return `You completed surah ${getSurahNameFn(milestone.surah)}`
      case 'juzCompleted':
        return `You completed juz ${milestone.juz}`
      case 'percent':
        return `You reached ${milestone.percent}% of the Quran`
      case 'quranCompleted':
        return 'You completed memorizing the Quran'
    }
  }

  switch (milestone.type) {
    case 'surahCompleted':
      return `أتممت حفظ سورة ${getSurahNameFn(milestone.surah)}`
    case 'juzCompleted':
      return `أتممت حفظ الجزء ${milestone.juz}`
    case 'percent':
      return `أتممت ${milestone.percent}٪ من القرآن`
    case 'quranCompleted':
      return 'أتممت حفظ القرآن الكريم'
  }
}

// --- 8. Period Gains Description ---

export function describePeriodGains(gains: PeriodGains): string {
  const ayat = formatNumber(gains.newAyat)
  const pages = formatDecimal(gains.pageEquivalents)
  const surahs = formatNumber(gains.surahsCompleted)
  return `+${ayat} آية · ${pages} صفحة تقريباً · ${surahs} سورة مكتملة`
}
