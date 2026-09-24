import type {
  DifferenceType,
  QiraatRuling,
  QiraatRulingAttribution,
  QiraatRulingReading,
  QiraatVariant,
  ReadingId,
  VariantOperation,
  VerificationStatus,
} from '../../packages/qiraat-core/types'
import type { ReviewRow } from '@/app/mushaf-1441/review/_lib/types'

// Usul category to (Arabic Label, Color, WordAnchored) mapping
export const USUL_CATEGORY_META: Record<string, { label: string; color: string; wordAnchored: boolean }> = {
  AYAH_COUNT: { label: 'عد الآي', color: '#64748B', wordAnchored: false },
  SILAT_HA: { label: 'صلة هاء الكناية', color: '#0D9488', wordAnchored: true },
  MEEM_JAM: { label: 'صلة ميم الجمع', color: '#DB2777', wordAnchored: true },
  TARQIQ_RA: { label: 'ترقيق الراءات', color: '#B45309', wordAnchored: true },
  TAGHLIZ_LAM: { label: 'تغليظ اللامات', color: '#B45309', wordAnchored: true },
  MADD_BADAL: { label: 'مد البدل', color: '#2563EB', wordAnchored: true },
  MADD_LIN: { label: 'مد اللين المهموز', color: '#2563EB', wordAnchored: true },
  MADD_QABL_IDGHAM: { label: 'المد قبل الإدغام', color: '#2563EB', wordAnchored: true },
  IMALAH_TAQLIL: { label: 'الممال والمقلل', color: '#C026D3', wordAnchored: true },
  IDGHAM_SAGHIR: { label: 'المدغم الصغير', color: '#15803D', wordAnchored: true },
  IDGHAM_KABIR: { label: 'المدغم الكبير', color: '#15803D', wordAnchored: true },
  TAGHYIR_HAMZ: { label: 'تغيير الهمز', color: '#DC2626', wordAnchored: true },
  HAMZATAN_KALIMA: { label: 'الهمزتان من كلمة', color: '#DC2626', wordAnchored: true },
  HAMZATAN_KALIMATAYN: { label: 'الهمزتان من كلمتين', color: '#DC2626', wordAnchored: true },
  TARK_GHUNNA: { label: 'ترك الغنة', color: '#0891B2', wordAnchored: true },
  IKHFA: { label: 'الإخفاء', color: '#0891B2', wordAnchored: true },
  SAKT: { label: 'السكت', color: '#7C3AED', wordAnchored: true },
  WAQF_HAMZA: { label: 'وقف حمزة', color: '#EA580C', wordAnchored: true },
  WAQF_RASM: { label: 'الوقف على مرسوم الخط', color: '#EA580C', wordAnchored: true },
  YAAT_IDAFA: { label: 'ياءات الإضافة', color: '#CA8A04', wordAnchored: true },
  YAAT_ZAWAID: { label: 'ياءات الزوائد', color: '#CA8A04', wordAnchored: true },
  BAYN_SURATAYN: { label: 'الأوجه بين السورتين', color: '#64748B', wordAnchored: false },
  USUL_MADD: { label: 'أصول المد', color: '#2563EB', wordAnchored: false },
  USUL_MIM_JAM: { label: 'ميم الجمع', color: '#DB2777', wordAnchored: false },
  USUL_NAQL: { label: 'النقل', color: '#7C3AED', wordAnchored: false },
  USUL_SAKT: { label: 'السكت', color: '#7C3AED', wordAnchored: false },
}

const DIFF_TYPE_MAP: Record<string, DifferenceType> = {
  orthography: 'ORTHOGRAPHY',
  vowel: 'HARAKAH',
  consonant: 'LETTER',
  hamza: 'HAMZ',
  madd: 'MADD',
  idgham: 'IDGHAM',
  ishmam: 'HARAKAH',
  imalah: 'IMALAH',
  taqlil: 'IMALAH',
  sakt: 'WAQF',
  naql: 'NAQL',
  ikhfa: 'OTHER',
  ghunnah: 'OTHER',
  pronoun: 'HARAKAH',
  grammar: 'HARAKAH',
  addition: 'ADDITION',
  omission: 'OMISSION',
  word_form: 'LETTER',
  other: 'OTHER',
  // Arabic values mapped from review UI chips
  تشكيل: 'HARAKAH',
  حرف: 'LETTER',
  زيادة: 'ADDITION',
  حذف: 'OMISSION',
  مد: 'MADD',
  همز: 'HAMZ',
  إمالة: 'IMALAH',
  إدغام: 'IDGHAM',
  وقف: 'WAQF',
  نقل: 'NAQL',
  صلة: 'SILAH',
  رسم: 'ORTHOGRAPHY',
  أخرى: 'OTHER',
}

export function mapDifferenceType(val: string | null | undefined): DifferenceType {
  if (!val) return 'ORTHOGRAPHY'
  const trimmed = val.trim().toLowerCase()
  return DIFF_TYPE_MAP[trimmed] ?? DIFF_TYPE_MAP[val.trim()] ?? 'OTHER'
}

export function reviewRowToVariant(row: ReviewRow): QiraatVariant {
  const readingIds = Array.from(new Set(row.narrators.map((n) => n.id as ReadingId))).filter(Boolean)
  const isPerformance = Boolean(row.performanceNote && (!row.readingText || row.readingText === row.hafsText))
  const operation: VariantOperation = isPerformance ? 'KEEP' : 'REPLACE'

  return {
    id: row.entryId,
    surah: row.surah,
    ayah: row.ayah,
    startToken: row.startWord,
    endToken: row.endWord,
    operation,
    hafsText: row.hafsText,
    variantText: isPerformance ? row.hafsText : (row.readingText ?? row.hafsText),
    description: row.description ?? undefined,
    uthmaniText: row.uthmaniText ?? undefined,
    differenceType: mapDifferenceType(row.variantType),
    performanceNote: row.performanceNote ?? undefined,
    verificationStatus: (row.verificationStatus as VerificationStatus) || 'REVIEWED',
    notes: row.notes ?? undefined,
    createdAt: row.version,
    updatedAt: row.version,
    readingIds,
    locusId: row.locationId,
    locusType: isPerformance ? 'performance_variant' : 'word_variant',
  }
}

export function reviewRowToRuling(row: ReviewRow): QiraatRuling {
  const catMeta = (row.categoryCode && USUL_CATEGORY_META[row.categoryCode]) || {
    label: row.categoryNameAr ?? 'أصل قراءة',
    color: '#0891B2',
    wordAnchored: true,
  }

  const attribution: QiraatRulingAttribution[] = row.narrators.map((n) => ({
    authorityId: n.id,
    action: n.action ?? row.categoryNameAr ?? catMeta.label,
    condition: n.wajhNote ?? undefined,
  }))

  const readings: QiraatRulingReading[] = row.narrators.map((n) => ({
    readingId: n.id as ReadingId,
    action: n.action ?? row.categoryNameAr ?? catMeta.label,
    isDefault: n.wajhOrder === 1,
  }))

  const hasAlternate = row.narrators.some((n) => n.wajhOrder > 1)

  return {
    id: row.entryId,
    pageNumber: row.page,
    category: row.categoryCode ?? 'USUL',
    categoryAr: row.categoryNameAr ?? catMeta.label,
    color: catMeta.color,
    wordAnchored: catMeta.wordAnchored,
    surah: row.surah,
    ayah: row.ayah,
    startToken: row.startWord,
    endToken: row.endWord,
    endAyah: row.endAyah,
    baseText: row.hafsText,
    verificationStatus: (row.verificationStatus as VerificationStatus) || 'REVIEWED',
    attribution,
    readings,
    hasAlternate,
    text: row.rulingText ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.version,
    updatedAt: row.version,
  }
}

export function transformReviewRows(rows: ReviewRow[]): {
  variants: QiraatVariant[]
  rulings: QiraatRuling[]
} {
  const activeRows = rows.filter((r) => !r.deleted)
  const variants: QiraatVariant[] = []
  const rulings: QiraatRuling[] = []

  for (const row of activeRows) {
    if (row.kind === 'farsh') {
      variants.push(reviewRowToVariant(row))
    } else {
      rulings.push(reviewRowToRuling(row))
    }
  }

  return { variants, rulings }
}
