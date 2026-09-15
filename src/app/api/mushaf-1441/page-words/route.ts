import { NextRequest, NextResponse } from 'next/server'
import { loadMushaf1441Page } from '../../../../../packages/quran-data/mushaf1441/pageLoader'
import { loadMushaf1441PageDecorations } from '../../../../../packages/quran-data/mushaf1441/pageDecorations'
import { getMushaf1441PageMetadata } from '../../../../../packages/quran-data/mushaf1441/pageMetadata'

export async function GET(request: NextRequest) {
  const page = Number(request.nextUrl.searchParams.get('page'))
  const metadata = getMushaf1441PageMetadata(page)
  const [mushafPage, lineDecorations] = await Promise.all([
    loadMushaf1441Page(page),
    loadMushaf1441PageDecorations(page),
  ])

  if (!mushafPage) {
    return NextResponse.json(
      { error: 'Invalid Mushaf 1441 page. Expected page 1-604.' },
      { status: 400 }
    )
  }

  return NextResponse.json(
    { ...mushafPage, lineDecorations, metadata },
    { headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400' } }
  )
}
