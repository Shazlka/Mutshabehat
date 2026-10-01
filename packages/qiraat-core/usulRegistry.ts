/**
 * Canonical, source-preserving registry for the أصول families currently present
 * in the Qiraat fixture corpus.  Database/source labels stay verbatim on each
 * record (`categoryAr`, `text`, and attribution `action`); this registry is the
 * one controlled place where a stable machine code is associated with them.
 *
 * Do not add a rule here from expectation alone. Add it only with a source
 * record and a regression test. Unknown labels are intentionally returned as
 * `undefined` so the audit can surface them instead of silently rendering them
 * as a nearest-looking rule.
 */
export interface UsulRuleDefinition {
  canonicalType: string
  rawCategories: readonly string[]
  rawLabels: readonly string[]
  family: string
  contextual: boolean
}

export const USUL_RULE_REGISTRY: readonly UsulRuleDefinition[] = [
  { canonicalType: 'AYAH_COUNT', rawCategories: ['AYAH_COUNT'], rawLabels: ['عد الآي'], family: 'AYAH_COUNT', contextual: false },
  { canonicalType: 'HA_KINAYA_SILAH', rawCategories: ['SILAT_HA'], rawLabels: ['صلة هاء الكناية'], family: 'HA_KINAYA', contextual: true },
  { canonicalType: 'MIM_JAM_SILAH', rawCategories: ['MEEM_JAM'], rawLabels: ['صلة ميم الجمع'], family: 'MIM_JAM', contextual: true },
  { canonicalType: 'RA_TARQIQ', rawCategories: ['TARQIQ_RA'], rawLabels: ['ترقيق الراءات'], family: 'RA', contextual: false },
  { canonicalType: 'LAM_TAGHLIZ', rawCategories: ['TAGHLIZ_LAM'], rawLabels: ['تغليظ اللامات'], family: 'LAM', contextual: false },
  { canonicalType: 'MADD_BADAL', rawCategories: ['MADD_BADAL'], rawLabels: ['مد البدل'], family: 'MADD', contextual: false },
  { canonicalType: 'MADD_LIN', rawCategories: ['MADD_LIN'], rawLabels: ['مد اللين المهموز'], family: 'MADD', contextual: false },
  { canonicalType: 'MADD_QABL_IDGHAM', rawCategories: ['MADD_QABL_IDGHAM'], rawLabels: ['المد قبل الإدغام'], family: 'MADD', contextual: true },
  { canonicalType: 'IMALAH_TAQLIL', rawCategories: ['IMALAH_TAQLIL'], rawLabels: ['الممال والمقلل'], family: 'IMALAH', contextual: false },
  { canonicalType: 'IDGHAM_SAGHIR', rawCategories: ['IDGHAM_SAGHIR'], rawLabels: ['المدغم الصغير'], family: 'IDGHAM', contextual: true },
  { canonicalType: 'IDGHAM_KABIR', rawCategories: ['IDGHAM_KABIR'], rawLabels: ['المدغم الكبير'], family: 'IDGHAM', contextual: true },
  { canonicalType: 'HAMZ_CHANGE', rawCategories: ['TAGHYIR_HAMZ'], rawLabels: ['تغيير الهمز'], family: 'HAMZ', contextual: true },
  { canonicalType: 'HAMZATAN_ONE_WORD', rawCategories: ['HAMZATAN_KALIMA'], rawLabels: ['الهمزتان من كلمة'], family: 'HAMZ', contextual: false },
  { canonicalType: 'HAMZATAN_TWO_WORDS', rawCategories: ['HAMZATAN_KALIMATAYN'], rawLabels: ['الهمزتان من كلمتين'], family: 'HAMZ', contextual: true },
  { canonicalType: 'TARK_GHUNNA', rawCategories: ['TARK_GHUNNA'], rawLabels: ['ترك الغنة'], family: 'GHUNNA', contextual: true },
  { canonicalType: 'IKHFA', rawCategories: ['IKHFA'], rawLabels: ['الإخفاء'], family: 'GHUNNA', contextual: true },
  { canonicalType: 'SAKT', rawCategories: ['SAKT'], rawLabels: ['السكت'], family: 'SAKT', contextual: true },
  { canonicalType: 'WAQF_HAMZA', rawCategories: ['WAQF_HAMZA'], rawLabels: ['وقف حمزة'], family: 'WAQF', contextual: false },
  { canonicalType: 'WAQF_RASM', rawCategories: ['WAQF_RASM'], rawLabels: ['الوقف على مرسوم الخط'], family: 'WAQF', contextual: false },
  { canonicalType: 'YAAT_IDAFA', rawCategories: ['YAAT_IDAFA'], rawLabels: ['ياءات الإضافة'], family: 'YAA', contextual: true },
  { canonicalType: 'YAAT_ZAWAID', rawCategories: ['YAAT_ZAWAID'], rawLabels: ['ياءات الزوائد'], family: 'YAA', contextual: false },
  { canonicalType: 'BAYN_SURATAYN', rawCategories: ['BAYN_SURATAYN'], rawLabels: ['الأوجه بين السورتين'], family: 'WASL_WAQF', contextual: true },
] as const

const byRawCategory = new Map(USUL_RULE_REGISTRY.flatMap((rule) => rule.rawCategories.map((raw) => [raw, rule])))
const byRawLabel = new Map(USUL_RULE_REGISTRY.flatMap((rule) => rule.rawLabels.map((raw) => [raw, rule])))

export function usulRuleForRawValue(value: string): UsulRuleDefinition | undefined {
  return byRawCategory.get(value) ?? byRawLabel.get(value)
}
