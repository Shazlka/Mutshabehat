// Port of apps/ios Sources/Qiraat/QiraatClassification.swift: the «الفئة › الفرعي › التفصيل» line of a card.
import { DIFFERENCE_TYPE_LABELS_AR, type DifferenceType, type QiraatRuling, type QiraatVariant } from '../types'

export const FARSH_TITLE = 'فرش الحروف'
export const USUL_TITLE = 'أصول القراءات'

export interface ClassificationSegment {
  label: string
  kind: 'title' | 'category' | 'sub'
  /** Ruling family colour for the باب segment; the label stays as text, so colour is never the only cue. */
  color?: string
}

/** Sub-category of a farsh variant from its difference type; a type nobody chose yet reads «غير مصنَّف». */
export function subCategoryForDifference(type: string | null | undefined): string {
  const raw = (type ?? '').trim().toUpperCase()
  const key = (raw === 'REORDER' ? 'WORD_FORM' : raw) as DifferenceType
  return DIFFERENCE_TYPE_LABELS_AR[key] ?? DIFFERENCE_TYPE_LABELS_AR.OTHER
}

function stripForCompare(value: string): string {
  return Array.from(value)
    .map((c) => c.codePointAt(0)!)
    .filter((c) => !(c >= 0x064b && c <= 0x065f) && c !== 0x0670 && c !== 0x0640)
    .map((c) => (c === 0x0622 || c === 0x0623 || c === 0x0625 || c === 0x0671 ? 0x0627 : c))
    .map((c) => String.fromCodePoint(c))
    .join('')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
}

/** Whether an action text adds detail beyond repeating the ruling's category. */
export function actionAddsInformation(action: string, categoryAr: string): boolean {
  const a = stripForCompare(action)
  return a.length > 0 && a !== stripForCompare(categoryAr)
}

/** Distinct non-empty action texts, from the attribution rows, else the readings. */
export function distinctActions(ruling: QiraatRuling): string[] {
  const seen: string[] = []
  const push = (raw: string | undefined) => {
    const action = raw?.trim() ?? ''
    if (action && !seen.includes(action)) seen.push(action)
  }
  ruling.attribution.forEach((a) => push(a.action))
  if (seen.length === 0) ruling.readings.forEach((r) => push(r.action))
  return seen
}

/** A short action label (≤ 24 characters) that is the only informative action; longer or several are not repeated. */
export function subDetail(ruling: QiraatRuling): string | null {
  const informative = distinctActions(ruling).filter((a) => actionAddsInformation(a, ruling.categoryAr))
  if (informative.length !== 1) return null
  const only = informative[0]
  return Array.from(only).length <= 24 ? only : null
}

/** The database sub-category when assigned; otherwise the short action stands in. */
export function usulSubCategory(ruling: QiraatRuling): string | null {
  const label = ruling.subCategory?.trim()
  return label ? label : subDetail(ruling)
}

export function classificationSegments(item: QiraatVariant | QiraatRuling): ClassificationSegment[] {
  if ('categoryAr' in item) {
    const segments: ClassificationSegment[] = [
      { label: USUL_TITLE, kind: 'title' },
      { label: item.categoryAr, kind: 'category', color: item.color },
    ]
    const detail = usulSubCategory(item)
    if (detail) segments.push({ label: detail, kind: 'sub' })
    return segments
  }
  return [
    { label: FARSH_TITLE, kind: 'title' },
    { label: subCategoryForDifference(item.differenceType), kind: 'sub' },
  ]
}
