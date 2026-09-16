// Qira'at (القراءات العشر) Types

export type QiraatPersonType = 'imam' | 'rawi'
export type QiraatRole = 'imam' | 'rawi' | 'tariq'
export type QiraatLocusStatus = 'extracted' | 'reviewed' | 'verified' | 'disputed'

export interface QiraatSource {
  id: string
  title: string
  edition?: string | null
  source_type: string
  file_name?: string | null
  total_pages?: number | null
  notes?: string | null
}

export interface QiraatPerson {
  id: string
  canonical_name: string
  display_name: string
  person_type: QiraatPersonType
  parent_person_id?: string | null
  order_index: number
  alias?: string | null
  notes?: string | null
}

export interface QiraatTarget {
  id: string
  locus_id: string
  quran_word_id: string
  surah: number
  ayah: number
  word_index: number
  mushaf_page: number
  line_number: number
  word_index_in_line: number
  base_text_uthmani: string
  normalized_text: string
}

export interface QiraatAttribution {
  id: string
  variant_id: string
  person_id: string
  attribution_raw: string
  role: QiraatRole
  parent_person_id?: string | null
  sort_order: number
  person?: QiraatPerson | null
}

export interface QiraatVariant {
  id: string
  locus_id: string
  variant_index: number
  display_text: string
  normalized_text: string
  performance_type?: string | null
  performance_text?: string | null
  source_line_raw: string
  sort_order: number
  attributions: QiraatAttribution[]
}

export interface QiraatLocus {
  id: string
  source_id: string
  locus_key?: string | null
  mushaf_page: number
  surah: number
  ayah: number
  source_marker: string
  marker_display: string
  source_heading_raw: string
  source_word_raw: string
  mushaf_base_word: string
  pdf_page: number
  printed_page: number
  status: QiraatLocusStatus
  requires_manual_review: boolean
  notes?: string | null
  targets: QiraatTarget[]
  variants: QiraatVariant[]
  source?: QiraatSource | null
}

export interface QiraatPagePayload {
  mushaf_page: number
  loci: QiraatLocus[]
  word_targets_map: Record<string, {
    locus_id: string
    source_marker: string
    marker_display: string
    base_text_uthmani: string
    variants_count: number
  }>
}
