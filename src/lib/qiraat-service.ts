import { createClient } from '@supabase/supabase-js'
import { resilientFetch } from '@/lib/resilient-fetch'
import type { QiraatLocus, QiraatPagePayload } from '@/types/qiraat'
import verifiedPage001 from '../../data/qiraat/verified/page-001.json'

function getPublicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    global: { fetch: resilientFetch },
    auth: { persistSession: false },
  })
}

const SELECT_LOCI_QUERY = `
  *,
  targets:qiraat_targets(*),
  variants:qiraat_variants(
    *,
    attributions:qiraat_attributions(
      *,
      person:qiraat_persons!qiraat_attributions_person_id_fkey(*)
    )
  ),
  source:qiraat_sources(*)
`

function buildFallbackPage1(): QiraatPagePayload {
  const personsMap = new Map((verifiedPage001.persons as any[]).map(p => [p.id, p]))

  const loci: QiraatLocus[] = (verifiedPage001.loci as any[]).map((loc, lIdx) => ({
    id: `locus-${loc.surah}-${loc.ayah}-${loc.source_marker}`,
    source_id: verifiedPage001.source.id,
    locus_key: loc.locus_key,
    mushaf_page: loc.mushaf_page,
    surah: loc.surah,
    ayah: loc.ayah,
    source_marker: loc.source_marker,
    marker_display: loc.marker_display,
    source_heading_raw: loc.source_heading_raw,
    source_word_raw: loc.source_word_raw,
    mushaf_base_word: loc.mushaf_base_word,
    pdf_page: loc.pdf_page,
    printed_page: loc.printed_page,
    status: loc.status,
    requires_manual_review: loc.requires_manual_review,
    notes: loc.notes,
    targets: (loc.targets as any[]).map((t, tIdx) => ({
      id: `target-${lIdx}-${tIdx}`,
      locus_id: `locus-${loc.surah}-${loc.ayah}-${loc.source_marker}`,
      quran_word_id: t.quran_word_id,
      surah: t.surah,
      ayah: t.ayah,
      word_index: t.word_index,
      mushaf_page: t.mushaf_page,
      line_number: t.line_number,
      word_index_in_line: t.word_index_in_line,
      base_text_uthmani: t.base_text_uthmani,
      normalized_text: t.normalized_text,
    })),
    variants: (loc.variants as any[]).map((v, vIdx) => ({
      id: `variant-${lIdx}-${vIdx}`,
      locus_id: `locus-${loc.surah}-${loc.ayah}-${loc.source_marker}`,
      variant_index: v.variant_index,
      display_text: v.display_text,
      normalized_text: v.normalized_text,
      performance_type: v.performance_type,
      performance_text: v.performance_text,
      source_line_raw: v.source_line_raw,
      sort_order: v.sort_order,
      attributions: (v.attributions as any[]).map((a, aIdx) => ({
        id: `attrib-${lIdx}-${vIdx}-${aIdx}`,
        variant_id: `variant-${lIdx}-${vIdx}`,
        person_id: a.person_id,
        attribution_raw: a.attribution_raw,
        role: a.role,
        parent_person_id: a.parent_person_id,
        sort_order: aIdx + 1,
        person: personsMap.get(a.person_id) || null,
      })),
    })),
    source: verifiedPage001.source as any,
  }))

  const wordTargetsMap: QiraatPagePayload['word_targets_map'] = {}
  for (const locus of loci) {
    for (const t of locus.targets) {
      wordTargetsMap[t.quran_word_id] = {
        locus_id: locus.id,
        source_marker: locus.source_marker,
        marker_display: locus.marker_display,
        base_text_uthmani: t.base_text_uthmani,
        variants_count: locus.variants.length,
      }
    }
  }

  return {
    mushaf_page: 1,
    loci,
    word_targets_map: wordTargetsMap,
  }
}

export async function getQiraatByPage(pageNumber: number): Promise<QiraatPagePayload> {
  try {
    const supabase = getPublicSupabase()
    if (!supabase) {
      if (pageNumber === 1) return buildFallbackPage1()
      return { mushaf_page: pageNumber, loci: [], word_targets_map: {} }
    }

    const { data, error } = await supabase
      .from('qiraat_loci')
      .select(SELECT_LOCI_QUERY)
      .eq('mushaf_page', pageNumber)
      .order('source_marker', { ascending: true })

    if (error || !data || data.length === 0) {
      if (pageNumber === 1) return buildFallbackPage1()
      return { mushaf_page: pageNumber, loci: [], word_targets_map: {} }
    }

    const loci = data as unknown as QiraatLocus[]
    const wordTargetsMap: QiraatPagePayload['word_targets_map'] = {}

    for (const locus of loci) {
      // Sort variants by sort_order
      if (Array.isArray(locus.variants)) {
        locus.variants.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        for (const v of locus.variants) {
          if (Array.isArray(v.attributions)) {
            v.attributions.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          }
        }
      }

      if (Array.isArray(locus.targets)) {
        for (const t of locus.targets) {
          wordTargetsMap[t.quran_word_id] = {
            locus_id: locus.id,
            source_marker: locus.source_marker,
            marker_display: locus.marker_display,
            base_text_uthmani: t.base_text_uthmani,
            variants_count: locus.variants?.length ?? 0,
          }
        }
      }
    }

    return {
      mushaf_page: pageNumber,
      loci,
      word_targets_map: wordTargetsMap,
    }
  } catch (err) {
    console.error('getQiraatByPage error:', err)
    if (pageNumber === 1) return buildFallbackPage1()
    return { mushaf_page: pageNumber, loci: [], word_targets_map: {} }
  }
}

export async function getQiraatByWordId(quranWordId: string): Promise<QiraatLocus | null> {
  try {
    const supabase = getPublicSupabase()
    if (!supabase) {
      const p1 = buildFallbackPage1()
      return p1.loci.find(l => l.targets.some(t => t.quran_word_id === quranWordId)) ?? null
    }

    const { data: targetData } = await supabase
      .from('qiraat_targets')
      .select('locus_id')
      .eq('quran_word_id', quranWordId)
      .maybeSingle()

    if (targetData?.locus_id) {
      const { data: locusData } = await supabase
        .from('qiraat_loci')
        .select(SELECT_LOCI_QUERY)
        .eq('id', targetData.locus_id)
        .maybeSingle()

      if (locusData) return locusData as unknown as QiraatLocus
    }

    // Check Page 1 fallback
    const p1 = buildFallbackPage1()
    const found = p1.loci.find(l => l.targets.some(t => t.quran_word_id === quranWordId))
    return found ?? null
  } catch {
    const p1 = buildFallbackPage1()
    const found = p1.loci.find(l => l.targets.some(t => t.quran_word_id === quranWordId))
    return found ?? null
  }
}

export async function getQiraatByAyahWord(surah: number, ayah: number, wordIndex: number): Promise<QiraatLocus | null> {
  try {
    const supabase = getPublicSupabase()
    if (!supabase) {
      const p1 = buildFallbackPage1()
      return p1.loci.find(l => l.targets.some(t => t.surah === surah && t.ayah === ayah && t.word_index === wordIndex)) ?? null
    }

    const { data: targetData } = await supabase
      .from('qiraat_targets')
      .select('locus_id')
      .eq('surah', surah)
      .eq('ayah', ayah)
      .eq('word_index', wordIndex)
      .maybeSingle()

    if (targetData?.locus_id) {
      const { data: locusData } = await supabase
        .from('qiraat_loci')
        .select(SELECT_LOCI_QUERY)
        .eq('id', targetData.locus_id)
        .maybeSingle()

      if (locusData) return locusData as unknown as QiraatLocus
    }

    // Check Page 1 fallback
    const p1 = buildFallbackPage1()
    const found = p1.loci.find(l => l.targets.some(t => t.surah === surah && t.ayah === ayah && t.word_index === wordIndex))
    return found ?? null
  } catch {
    const p1 = buildFallbackPage1()
    const found = p1.loci.find(l => l.targets.some(t => t.surah === surah && t.ayah === ayah && t.word_index === wordIndex))
    return found ?? null
  }
}
