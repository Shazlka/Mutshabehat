// The colour of each أصول category on the Mushaf and in the word card. One table, shared by the
// qiraat API (which sends it to the app) and the review screen's app-style preview.

export const CATEGORY_COLORS: Record<string, string> = {
  AYAH_COUNT: '#64748B',
  SILAT_HA: '#0D9488',
  MEEM_JAM: '#DB2777',
  TARQIQ_RA: '#B45309',
  TAGHLIZ_LAM: '#B45309',
  MADD_BADAL: '#2563EB',
  MADD_LIN: '#2563EB',
  MADD_QABL_IDGHAM: '#2563EB',
  IMALAH_TAQLIL: '#C026D3',
  IDGHAM_SAGHIR: '#15803D',
  IDGHAM_KABIR: '#15803D',
  TAGHYIR_HAMZ: '#DC2626',
  HAMZATAN_KALIMA: '#DC2626',
  HAMZATAN_KALIMATAYN: '#DC2626',
  TARK_GHUNNA: '#0891B2',
  IKHFA: '#0891B2',
  SAKT: '#7C3AED',
  WAQF_HAMZA: '#EA580C',
  WAQF_RASM: '#EA580C',
  YAAT_IDAFA: '#CA8A04',
  YAAT_ZAWAID: '#CA8A04',
  BAYN_SURATAYN: '#64748B',
  USUL_MIM_JAM: '#DB2777',
  USUL_MADD: '#2563EB',
  USUL_SAKT: '#7C3AED',
  USUL_HA_SAKT: '#7C3AED',
  USUL_NAQL: '#DC2626',
  USUL_TAHQIQ: '#DC2626',
  USUL_IBDAL: '#DC2626',
  USUL_TASHIL: '#DC2626',
}

export const DEFAULT_CATEGORY_COLOR = '#64748B'

export function categoryColor(code: string | null | undefined): string {
  return (code && CATEGORY_COLORS[code]) || DEFAULT_CATEGORY_COLOR
}
