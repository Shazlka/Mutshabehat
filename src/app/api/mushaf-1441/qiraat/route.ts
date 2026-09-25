import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { defaultQiraatRepository } from '../../../../../packages/qiraat-core/repository'
import { isValidMushaf1441PageNumber } from '../../../../../packages/quran-data/mushaf1441/pageLoader'
import type {
  DifferenceType,
  QiraatRulingAttribution,
  QiraatRulingReading,
  QiraatRuling,
  QiraatVariant,
  ReadingId,
  VariantOperation,
  VerificationStatus,
} from '../../../../../packages/qiraat-core/types'

const CATEGORY_COLORS: Record<string, string> = {
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
}

function mapDifferenceType(variantType?: string | null): DifferenceType {
  if (!variantType) return 'OTHER'
  const upper = variantType.toUpperCase()
  switch (upper) {
    case 'HARAKAH': return 'HARAKAH'
    case 'LETTER': return 'LETTER'
    case 'ADDITION': return 'ADDITION'
    case 'OMISSION': return 'OMISSION'
    case 'MADD': return 'MADD'
    case 'HAMZ': return 'HAMZ'
    case 'IMALAH': return 'IMALAH'
    case 'IDGHAM': return 'IDGHAM'
    case 'WAQF': return 'WAQF'
    case 'NAQL': return 'NAQL'
    case 'SILAH': return 'SILAH'
    case 'ORTHOGRAPHY': return 'ORTHOGRAPHY'
    default: return 'OTHER'
  }
}

interface ExportLocus {
  id: string
  surah: number
  startAyah: number
  startWord: number
  endAyah: number
  endWord: number
  baseText: string
  occurrence?: string
  mapping?: string
}

interface ExportVariantDetail {
  readingText?: string
  uthmaniText?: string
  description?: string
  variantType?: string
  isBaseline?: boolean
  performanceNote?: string
}

interface ExportRulingDetail {
  category: string
  categoryAr: string
  ruleId?: string
  text?: string
  options?: string[]
  wordAnchored?: boolean
}

interface ExportAttribution {
  authorityId: string
  action?: string
  condition?: string
  isException?: boolean
  isDefault?: boolean
}

interface ExportEntry {
  id: string
  kind: 'variant' | 'ruling'
  order: number
  status: VerificationStatus
  notes?: string
  locus: ExportLocus
  variant?: ExportVariantDetail
  ruling?: ExportRulingDetail
  attribution?: ExportAttribution[]
  readingIds?: string[]
  alternates?: string[]
  countSchools?: string[]
}

interface ExportPagePayload {
  mushafPage: number
  sourcePage?: number
  surah?: number
  ayahFrom?: number
  ayahTo?: number
  entries?: ExportEntry[]
  pageNotes?: Array<{ type: string; text: string }>
}

function mapExportVariant(entry: ExportEntry): QiraatVariant {
  const isMulti =
    entry.locus.endWord > entry.locus.startWord ||
    entry.locus.endAyah > entry.locus.startAyah
  const isPerf =
    Boolean(entry.variant?.performanceNote) &&
    (!entry.variant?.readingText ||
      entry.variant?.readingText === entry.locus.baseText)

  const diffType = mapDifferenceType(entry.variant?.variantType)
  const op: VariantOperation =
    entry.variant?.readingText &&
    entry.variant.readingText !== entry.locus.baseText
      ? 'REPLACE'
      : 'KEEP'

  return {
    id: entry.id,
    surah: entry.locus.surah,
    ayah: entry.locus.startAyah,
    startToken: entry.locus.startWord,
    endToken: entry.locus.endWord ?? entry.locus.startWord,
    operation: op,
    hafsText: entry.locus.baseText,
    variantText: entry.variant?.readingText ?? entry.locus.baseText,
    description: entry.variant?.description ?? undefined,
    uthmaniText: entry.variant?.uthmaniText ?? undefined,
    performanceNote: entry.variant?.performanceNote ?? undefined,
    differenceType: diffType,
    notes: entry.notes ?? undefined,
    verificationStatus: entry.status,
    createdAt: '2026-09-17T12:00:00.000Z',
    updatedAt: '2026-09-17T12:00:00.000Z',
    readingIds: (entry.readingIds ?? []) as ReadingId[],
    locusId: entry.locus.id,
    locusType: isPerf
      ? 'performance_variant'
      : isMulti
        ? 'multi_word_variant'
        : 'word_variant',
  }
}

function mapExportRuling(entry: ExportEntry, pageNumber: number): QiraatRuling {
  const category = entry.ruling?.category ?? 'OTHER'
  const categoryAr = entry.ruling?.categoryAr ?? category
  const color = CATEGORY_COLORS[category] ?? '#64748B'
  const wordAnchored = entry.ruling?.wordAnchored ?? true

  const attribution: QiraatRulingAttribution[] = (entry.attribution ?? []).map(
    (a) => ({
      authorityId: a.authorityId,
      action: a.action ?? categoryAr,
      condition: a.condition ?? undefined,
    })
  )

  const alternatesSet = new Set(entry.alternates ?? [])
  const readings: QiraatRulingReading[] = (entry.readingIds ?? []).map(
    (rId) => ({
      readingId: rId as ReadingId,
      action:
        entry.attribution?.find((a) => a.authorityId === rId)?.action ??
        categoryAr,
      isDefault: !alternatesSet.has(rId),
    })
  )

  return {
    id: entry.id,
    pageNumber,
    category,
    categoryAr,
    color,
    wordAnchored,
    surah: entry.locus.surah,
    ayah: entry.locus.startAyah,
    startToken: entry.locus.startWord,
    endToken: entry.locus.endWord ?? entry.locus.startWord,
    endAyah: entry.locus.endAyah ?? entry.locus.startAyah,
    baseText: entry.locus.baseText,
    verificationStatus: entry.status,
    attribution,
    readings,
    hasAlternate: (entry.alternates ?? []).length > 0,
    text: entry.ruling?.text ?? undefined,
    condition: entry.attribution?.[0]?.condition ?? undefined,
    countSchools: entry.countSchools ?? undefined,
    notes: entry.notes ?? undefined,
    createdAt: '2026-09-17T12:00:00.000Z',
    updatedAt: '2026-09-17T12:00:00.000Z',
  }
}

// GET /api/mushaf-1441/qiraat?page=N[&debug=1]
export async function GET(request: NextRequest) {
  const page = Number(request.nextUrl.searchParams.get('page'))
  if (!isValidMushaf1441PageNumber(page)) {
    return NextResponse.json(
      { error: 'Invalid Mushaf 1441 page. Expected page 1-604.' },
      { status: 400 }
    )
  }

  const includeUnpublished = request.nextUrl.searchParams.get('debug') !== '0'

  // Attempt live load from database first to reflect real-time editor modifications
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey)
      const { data, error } = await supabase.rpc('qiraat_export_page', {
        p_mushaf_page: page,
        p_include_unpublished: includeUnpublished,
      })

    if (
      !error &&
      data &&
      Array.isArray((data as ExportPagePayload).entries) &&
      (data as ExportPagePayload).entries!.length > 0
    ) {
      const payload = data as ExportPagePayload
      const variants = payload
        .entries!.filter((e) => e.kind === 'variant')
        .map(mapExportVariant)
      const rulings = payload
        .entries!.filter((e) => e.kind === 'ruling')
        .map((e) => mapExportRuling(e, page))
      const rules = await defaultQiraatRepository.getRulesForPage(page, {
        includeUnpublished,
      })

      return NextResponse.json(
        { pageNumber: page, variants, rules, rulings },
        {
          headers: {
            'Cache-Control': 'private, no-cache, no-store, must-revalidate',
          },
        }
      )
    }
  }
} catch (err) {
  console.error(
    `[qiraat-api] live db query failed for page ${page}, falling back to static fixtures:`,
    err
  )
}

  // Graceful fallback to static fixtures
  const [variants, rules, rulings] = await Promise.all([
    defaultQiraatRepository.getVariantsForPage(page, { includeUnpublished }),
    defaultQiraatRepository.getRulesForPage(page, { includeUnpublished }),
    defaultQiraatRepository.getRulingsForPage(page, { includeUnpublished }),
  ])

  return NextResponse.json(
    { pageNumber: page, variants, rules, rulings },
    {
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    }
  )
}
