import { NextRequest, NextResponse } from 'next/server'
import {
  getMushaf1441PageForAyahKey,
  getMushaf1441PageMetadata,
} from '../../../../../packages/quran-data/mushaf1441/pageMetadata'

export function GET(request: NextRequest) {
  const ayahKey = request.nextUrl.searchParams.get('ayahKey')
  if (ayahKey) {
    const pageNumber = getMushaf1441PageForAyahKey(ayahKey)
    if (!pageNumber) {
      return NextResponse.json(
        { error: 'Ayah key was not found in Mushaf 1441 metadata.' },
        { status: 404 }
      )
    }
    return NextResponse.json({ ayahKey, pageNumber })
  }

  const page = Number(request.nextUrl.searchParams.get('page'))
  const metadata = getMushaf1441PageMetadata(page)
  if (!metadata) {
    return NextResponse.json(
      { error: 'Invalid Mushaf 1441 page. Expected page 1-604.' },
      { status: 400 }
    )
  }

  return NextResponse.json(metadata)
}
