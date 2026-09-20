// Server-only Qiraat bulk-import admin repository.
//
// The staging tables (qiraat_import_batches/rows/row_events/mappings) carry NO RLS policy
// for anon/authenticated — default deny (see supabase/migrations/20260920120000_qiraat_
// import_staging.sql §5) — so every read/write here goes through the service-role client,
// exactly like the quiz repository's `quizAdmin()` (src/lib/quiz/repository.ts) already does
// for its own admin-only tables. This is deliberate: the review UI is the only thing that can
// see staging data, and it is reached only by a signed-in user (see admin layout guard).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { resilientFetch } from '@/lib/resilient-fetch'

export class QiraatAdminError extends Error {
  constructor(message: string, public status = 503) { super(message) }
}

export function qiraatAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new QiraatAdminError('لوحة استيراد القراءات غير مهيأة بعد (SUPABASE_SERVICE_ROLE_KEY).')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: resilientFetch } })
}

function check(error: { message: string; code?: string } | null) {
  if (!error) return
  console.error('[qiraat admin]', error.code, error.message)
  throw new QiraatAdminError('تعذّر الوصول إلى بيانات الاستيراد. حاول مرة أخرى.')
}

export type ImportBatch = {
  id: string
  source_dir: string
  status: string
  files_count: number
  sheets_count: number
  rows_total: number
  rows_valid: number
  rows_warning: number
  rows_error: number
  rows_duplicate: number
  rows_unresolved: number
  rows_needs_mapping: number
  rows_approved: number
  rows_rejected: number
  rows_published: number
  created_at: string
  published_at: string | null
}

export type ImportRow = {
  id: number
  batch_id: string
  source_file: string
  source_sheet: string
  source_row: number
  raw_row: Record<string, unknown>
  normalized: Record<string, unknown>
  validation_status: 'valid' | 'warning' | 'error'
  validation_messages: { level: string; code: string; detail: string }[]
  duplicate_status: string
  review_status: string
  unresolved_authorities: string[]
  mapping_status: string
  reviewer_note: string | null
  published_locus_id: string | null
  published_entry_id: string | null
  production_conflict: Record<string, unknown> | null
}

export async function listBatches(): Promise<ImportBatch[]> {
  const { data, error } = await qiraatAdmin()
    .from('qiraat_import_batches')
    .select('*')
    .order('created_at', { ascending: false })
  check(error)
  return data ?? []
}

export async function getBatch(batchId: string): Promise<ImportBatch | null> {
  const { data, error } = await qiraatAdmin()
    .from('qiraat_import_batches')
    .select('*')
    .eq('id', batchId)
    .maybeSingle()
  check(error)
  return data
}

export type RowFilters = {
  validation_status?: string
  review_status?: string
  duplicate_status?: string
  page?: number
  surah?: number
  search?: string
  limit?: number
  offset?: number
}

export async function listRows(batchId: string, filters: RowFilters = {}) {
  let q = qiraatAdmin()
    .from('qiraat_import_rows')
    .select('*', { count: 'exact' })
    .eq('batch_id', batchId)
    .order('id', { ascending: true })

  if (filters.validation_status) q = q.eq('validation_status', filters.validation_status)
  if (filters.review_status) q = q.eq('review_status', filters.review_status)
  if (filters.duplicate_status) q = q.eq('duplicate_status', filters.duplicate_status)
  if (filters.page) q = q.eq('normalized->>mushaf_page', String(filters.page))
  if (filters.surah) q = q.eq('normalized->>surah_number', String(filters.surah))
  if (filters.search) q = q.ilike('normalized->>base_text_raw', `%${filters.search}%`)

  const limit = filters.limit ?? 50
  const offset = filters.offset ?? 0
  q = q.range(offset, offset + limit - 1)

  const { data, error, count } = await q
  check(error)
  return { rows: (data ?? []) as ImportRow[], total: count ?? 0 }
}

export async function getRow(rowId: number): Promise<ImportRow | null> {
  const { data, error } = await qiraatAdmin()
    .from('qiraat_import_rows')
    .select('*')
    .eq('id', rowId)
    .maybeSingle()
  check(error)
  return data
}

async function logEvent(rowId: number, eventType: string, actor: string, note?: string, after?: unknown) {
  const { error } = await qiraatAdmin().from('qiraat_import_row_events').insert({
    row_id: rowId, event_type: eventType, actor, note, after_value: after ?? null,
  })
  check(error)
}

export async function setRowReviewStatus(rowId: number, status: string, actor: string, note?: string) {
  const { error } = await qiraatAdmin()
    .from('qiraat_import_rows')
    .update({ review_status: status, reviewed_by: actor, reviewed_at: new Date().toISOString(), reviewer_note: note ?? null })
    .eq('id', rowId)
  check(error)
  await logEvent(rowId, status, actor, note)
}

/** Bulk-approve every VALID, non-duplicate, pending row in a batch (optionally scoped to one page). */
export async function bulkApproveValid(batchId: string, actor: string, page?: number) {
  let q = qiraatAdmin()
    .from('qiraat_import_rows')
    .update({ review_status: 'approved', reviewed_by: actor, reviewed_at: new Date().toISOString() })
    .eq('batch_id', batchId)
    .eq('validation_status', 'valid')
    .eq('duplicate_status', 'none')
    .in('review_status', ['pending'])
  if (page) q = q.eq('normalized->>mushaf_page', String(page))
  const { data, error } = await q.select('id')
  check(error)
  return data?.length ?? 0
}

export async function editRowNormalized(rowId: number, edits: Record<string, unknown>, actor: string) {
  const row = await getRow(rowId)
  if (!row) throw new QiraatAdminError('السجل غير موجود.', 404)
  const merged = { ...row.normalized, ...edits }
  const { error } = await qiraatAdmin()
    .from('qiraat_import_rows')
    .update({ manual_edits: edits, normalized: merged })
    .eq('id', rowId)
  check(error)
  await logEvent(rowId, 'edited', actor, undefined, edits)
}

export async function batchSummaryCards(batch: ImportBatch) {
  return [
    { label: 'إجمالي الصفوف', value: batch.rows_total },
    { label: 'صحيح', value: batch.rows_valid },
    { label: 'تحذير', value: batch.rows_warning },
    { label: 'خطأ', value: batch.rows_error },
    { label: 'مكرر', value: batch.rows_duplicate },
    { label: 'عزو غير محلول', value: batch.rows_unresolved },
    { label: 'يحتاج ربطًا يدويًا', value: batch.rows_needs_mapping },
    { label: 'معتمد', value: batch.rows_approved },
    { label: 'مرفوض', value: batch.rows_rejected },
    { label: 'منشور', value: batch.rows_published },
  ]
}

// ---------------------------------------------------------------------------
// Published (V2) database browser
// ---------------------------------------------------------------------------

export async function exportPage(page: number, includeUnpublished = true) {
  const { data, error } = await qiraatAdmin().rpc('qiraat_export_page', {
    p_mushaf_page: page,
    p_include_unpublished: includeUnpublished,
  })
  check(error)
  return data as { mushafPage: number; sourcePage: number; surah: number; entries: unknown[] } | null
}

export async function qaBlocking() {
  const { data, error } = await qiraatAdmin().from('qiraat_qa_blocking').select('*')
  check(error)
  return data ?? []
}

export async function qaPartition(locusPrefix?: string) {
  let q = qiraatAdmin().from('qiraat_qa_partition').select('*')
  if (locusPrefix) q = q.ilike('locus_id', `${locusPrefix}%`)
  const { data, error } = await q
  check(error)
  return data ?? []
}

export async function pageCoverage() {
  const { data, error } = await qiraatAdmin()
    .from('qiraat_pages')
    .select('mushaf_page_number, extraction_status')
    .not('mushaf_page_number', 'is', null)
    .order('mushaf_page_number', { ascending: true })
  check(error)
  return data ?? []
}
