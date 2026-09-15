import { NextRequest, NextResponse } from 'next/server'
import { loadMushaf1441Page } from '../../../../../packages/quran-data/mushaf1441/pageLoader'

export async function GET(request: NextRequest) {
  const page = Number(request.nextUrl.searchParams.get('page'))
  const mushafPage = await loadMushaf1441Page(page)

  if (!mushafPage) {
    return NextResponse.json(
      { error: 'Invalid Mushaf 1441 page. Expected page 1-604.' },
      { status: 400 }
    )
  }

  return NextResponse.json(mushafPage)
}
