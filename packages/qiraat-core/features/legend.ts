// Colour key «مفتاح الألوان» (iOS QiraatLegendSheet): the marks the page draws, every reader and narrator in its
// own colour, and every أصول باب, each with a real word of the Mushaf when the loaded pages carry one.
import { QIRAAT_NARRATORS } from '../narrators'
import { QIRAAT_READERS, getReader } from '../readers'
import { narratorColor, readerColor } from '../colors'
import { USUL_RULE_REGISTRY } from '../usulRegistry'
import type { QiraatRuling, QiraatVariant } from '../types'
import { narratorLabel } from './readerPicker'

export interface LegendRow {
  key: string
  label: string
  color: string
  explanation?: string
  /** A Mushaf word only this authority / باب shows, and the page it is on. */
  sampleWord?: { text: string; page: number }
}

export interface LegendRows {
  marks: LegendRow[]
  readers: LegendRow[]
  narrators: LegendRow[]
  abwab: LegendRow[]
}

const MARK_COLOR = '#475569'

/** The marks the page draws (titles and explanations as in the iOS key). */
const MARKS: LegendRow[] = [
  { key: 'mark-solid', label: 'خط متصل تحت الكلمة', explanation: 'قارئ أو راوٍ واحد على الكلمة. الألوان في القسم التالي.' },
  { key: 'mark-segmented', label: 'خط مقسَّم', explanation: 'أكثر من إمام على الكلمة: قطعة متساوية لكل إمام بترتيب القرّاء، والنص بلون مشترك.' },
  { key: 'mark-performance', label: 'خط بلون الأداء', explanation: 'الاختلاف في طريقة القراءة فقط، والرسم كما هو في المصحف.' },
  { key: 'mark-unresolved', label: 'خط رمادي', explanation: 'القارئ غير معروف بعد في بيانات الكلمة، فلا يُنسب الخط إلى أحد.' },
  { key: 'mark-dotted', label: 'خط منقّط تحت الكلمة', explanation: 'ذو وجهين: لبعض القرّاء وجه ثانٍ جائز («بخلف عنه»)، بلون الباب.' },
  { key: 'mark-family', label: 'نقطة أعلى يسار الكلمة', explanation: 'أكثر من باب من أبواب الأصول على الكلمة، بلون أول حكم عليها.' },
  { key: 'mark-imalah', label: 'نقطة مملوءة أسفل يسار الكلمة', explanation: 'إمالة في باب الممال والمقلل، بلون هذا الباب.' },
  { key: 'mark-taqlil', label: 'حلقة أسفل يسار الكلمة', explanation: 'تقليل بلا إمالة في باب الممال والمقلل، بلون هذا الباب.' },
  { key: 'mark-ruling-word', label: 'كلمة بلون الباب', explanation: 'حكم من أبواب الأصول بلا اختلاف في الرسم: يلوّن نص الكلمة بلا خط تحتها.' },
].map((row) => ({ ...row, color: MARK_COLOR }))

function pagesAscending<T>(byPage: Record<number, T[]>): [number, T[]][] {
  return Object.entries(byPage).map(([page, list]) => [Number(page), list] as [number, T[]]).sort((a, b) => a[0] - b[0])
}

export function legendRows(
  variantsByPage: Record<number, readonly QiraatVariant[]>,
  rulingsByPage: Record<number, readonly QiraatRuling[]>,
): LegendRows {
  const variantPages = pagesAscending(variantsByPage as Record<number, QiraatVariant[]>)

  // The first word (lowest page, then data order) that only `owns` reads.
  const sampleFor = (owns: (readingIds: string[]) => boolean): LegendRow['sampleWord'] => {
    for (const [page, list] of variantPages) {
      const hit = list.find((v) => v.readingIds.length > 0 && owns(v.readingIds))
      if (hit) return { text: hit.uthmaniText ?? hit.variantText, page }
    }
    return undefined
  }

  const readers: LegendRow[] = QIRAAT_READERS.map((reader) => ({
    key: reader.id,
    label: reader.nameAr,
    color: readerColor(reader.id),
    sampleWord: sampleFor((ids) => ids.every((id) => QIRAAT_NARRATORS.find((n) => n.id === id)?.readerId === reader.id)),
  }))
  const narrators: LegendRow[] = QIRAAT_NARRATORS.map((narrator) => ({
    key: narrator.id,
    label: narratorLabel(narrator.id),
    color: narratorColor(narrator.id),
    explanation: getReader(narrator.readerId).nameAr,
    sampleWord: sampleFor((ids) => ids.length === 1 && ids[0] === narrator.id),
  }))

  const found = new Map<string, LegendRow>()
  for (const [page, list] of pagesAscending(rulingsByPage as Record<number, QiraatRuling[]>)) {
    for (const ruling of list) {
      if (!found.has(ruling.category)) {
        found.set(ruling.category, {
          key: ruling.category,
          label: ruling.categoryAr,
          color: ruling.color,
          sampleWord: ruling.baseText ? { text: ruling.baseText, page } : undefined,
        })
      }
    }
  }
  const order = USUL_RULE_REGISTRY.map((rule) => rule.rawCategories[0])
  const abwab = Array.from(found.values()).sort((a, b) => {
    const ia = order.indexOf(a.key)
    const ib = order.indexOf(b.key)
    return (ia === -1 ? order.length : ia) - (ib === -1 ? order.length : ib) || a.key.localeCompare(b.key)
  })

  return { marks: MARKS, readers, narrators, abwab }
}
