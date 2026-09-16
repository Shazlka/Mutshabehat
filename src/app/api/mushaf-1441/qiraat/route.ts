import { NextRequest, NextResponse } from 'next/server'
import { defaultQiraatRepository } from '../../../../../packages/qiraat-core/repository'
import { isValidMushaf1441PageNumber } from '../../../../../packages/quran-data/mushaf1441/pageLoader'

// GET /api/mushaf-1441/qiraat?page=N[&debug=1]
//
// Reference data, not user data: unlike /mutshabehat and /annotations this route needs no
// session/auth — Qiraat variants are shared, not per-user. `debug=1` additionally surfaces
// REVIEWED/MAPPED/EXTRACTED records (Part 38, admin/debug view only — never the default).
export async function GET(request: NextRequest) {
  const page = Number(request.nextUrl.searchParams.get('page'))
  if (!isValidMushaf1441PageNumber(page)) {
    return NextResponse.json(
      { error: 'Invalid Mushaf 1441 page. Expected page 1-604.' },
      { status: 400 }
    )
  }

  const includeUnpublished = request.nextUrl.searchParams.get('debug') === '1'
  const variants = await defaultQiraatRepository.getVariantsForPage(page, { includeUnpublished })

  return NextResponse.json(
    { pageNumber: page, variants },
    // Same long-lived cache as page-words: this is reference data, not per-user state. Debug
    // responses are not cached at the shared layer (still fine to cache in the browser).
    { headers: { 'Cache-Control': includeUnpublished ? 'private, max-age=60' : 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400' } }
  )
}
