import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isValidMushaf1441PageNumber } from '../../../../../packages/quran-data/mushaf1441/pageLoader'

// Page-level flattened annotation projection. Normal Mushaf reads use this bulk endpoint;
// hierarchy resolution is performed by the write-time cache, never once per word.
export async function GET(request: NextRequest) {
  const page = Number(request.nextUrl.searchParams.get('page'))
  if (!isValidMushaf1441PageNumber(page)) return NextResponse.json({ error: 'Invalid Mushaf page.' }, { status: 400 })
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.from('resolved_qiraat_cache').select('canonical_word_key,page_number,target_authority_id,framework_id,resolved_annotation_id,resolved_face_count,has_multiple_faces,resolved_color,reading_context,source_version').eq('page_number', page)
  if (error) return NextResponse.json({ error: 'Unable to load resolved Qiraat annotations.' }, { status: 503 })
  return NextResponse.json({ pageNumber: page, annotations: data ?? [] }, { headers: { 'Cache-Control': 'private, max-age=15' } })
}
