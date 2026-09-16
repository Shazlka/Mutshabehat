import { NextRequest, NextResponse } from 'next/server'
import { getQiraatByPage, getQiraatByWordId, getQiraatByAyahWord } from '@/lib/qiraat-service'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const pageParam = searchParams.get('page')
  const wordIdParam = searchParams.get('wordId')
  const surahParam = searchParams.get('surah')
  const ayahParam = searchParams.get('ayah')
  const wordIndexParam = searchParams.get('wordIndex')

  if (wordIdParam) {
    const locus = await getQiraatByWordId(wordIdParam)
    if (!locus) {
      return NextResponse.json({ error: 'No Qiraat locus found for word' }, { status: 404 })
    }
    return NextResponse.json({ locus }, {
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' }
    })
  }

  if (surahParam && ayahParam && wordIndexParam) {
    const surah = Number(surahParam)
    const ayah = Number(ayahParam)
    const wordIndex = Number(wordIndexParam)
    if (isNaN(surah) || isNaN(ayah) || isNaN(wordIndex)) {
      return NextResponse.json({ error: 'Invalid surah, ayah, or wordIndex parameters' }, { status: 400 })
    }
    const locus = await getQiraatByAyahWord(surah, ayah, wordIndex)
    if (!locus) {
      return NextResponse.json({ error: 'No Qiraat locus found for word coordinates' }, { status: 404 })
    }
    return NextResponse.json({ locus }, {
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' }
    })
  }

  if (pageParam) {
    const page = Number(pageParam)
    if (isNaN(page) || page < 1 || page > 604) {
      return NextResponse.json({ error: 'Invalid page number. Expected 1-604.' }, { status: 400 })
    }
    const data = await getQiraatByPage(page)
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' }
    })
  }

  return NextResponse.json({ error: 'Missing parameter: page, wordId, or surah/ayah/wordIndex' }, { status: 400 })
}
