import { NextRequest, NextResponse } from 'next/server'
import { defaultQiraatRepository } from '../../../../../packages/qiraat-core/repository'
import { isValidMushaf1441PageNumber } from '../../../../../packages/quran-data/mushaf1441/pageLoader'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { transformReviewRows } from '@/lib/qiraat-transformer'
import type { ReviewRow } from '@/app/mushaf-1441/review/_lib/types'

export const dynamic = 'force-dynamic'

// GET /api/mushaf-1441/qiraat?page=N[&debug=1]
// Serves live reviewed Qiraat data from PostgreSQL first, with seamless fallback
// to static repository fixtures if DB is unavailable.
export async function GET(request: NextRequest) {
  const page = Number(request.nextUrl.searchParams.get('page'))
  if (!isValidMushaf1441PageNumber(page)) {
    return NextResponse.json(
      { error: 'Invalid Mushaf 1441 page. Expected page 1-604.' },
      { status: 400 }
    )
  }

  const includeUnpublished = request.nextUrl.searchParams.get('debug') === '1'

  try {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase.rpc('qiraat_review_page', {
      p_page: page,
      p_include_deleted: false,
    })

    if (!error && data?.rows && Array.isArray(data.rows)) {
      const { variants, rulings } = transformReviewRows(data.rows as ReviewRow[])
      const rules = await defaultQiraatRepository.getRulesForPage(page, { includeUnpublished })

      return NextResponse.json(
        { pageNumber: page, variants, rules, rulings, source: 'database' },
        {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
          },
        }
      )
    }
  } catch (err) {
    console.error(`Failed to load live qiraat for page ${page} from database:`, err)
  }

  // Graceful fallback to static repository
  const [variants, rules, rulings] = await Promise.all([
    defaultQiraatRepository.getVariantsForPage(page, { includeUnpublished }),
    defaultQiraatRepository.getRulesForPage(page, { includeUnpublished }),
    defaultQiraatRepository.getRulingsForPage(page, { includeUnpublished }),
  ])

  return NextResponse.json(
    { pageNumber: page, variants, rules, rulings, source: 'fixture' },
    {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    }
  )
}
