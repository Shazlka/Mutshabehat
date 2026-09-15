import { NextResponse, type NextRequest } from 'next/server'
import { getAyah, getSurahAyahs, getSurahNames, getSurahNumberByName, searchAyahs } from '@/lib/quran'

// The Quran corpus is static, so every response here is immutable for a given
// query. Cache aggressively at the CDN/edge so repeat requests (e.g. the surah
// list, fetched by several components) never re-invoke the function.
//   s-maxage → shared CDN cache (Vercel) ; max-age → browser ; immutable → no revalidation
const IMMUTABLE = 'public, max-age=3600, s-maxage=31536000, immutable'
const SEARCH_CACHE = 'public, max-age=300, s-maxage=86400'

function json(body: unknown, cacheControl: string, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl } })
}

// GET /api/quran
//   ?surah=النمل&ayah=24  → single ayah text
//   ?surah=27&ayah=24     → single ayah text (numeric)
//   ?surah=27             → all ayahs in surah
//   ?names                → all surah names
//   ?search=الرجفة        → search ayahs (limit 50)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  // List all surah names
  if (searchParams.has('names')) {
    return json({ surahs: getSurahNames() }, IMMUTABLE)
  }

  // Full-text search across all ayahs (uses the pre-normalized index)
  const search = searchParams.get('search')
  if (search) {
    const results = searchAyahs(search, 50)
    return json({ query: search, results }, SEARCH_CACHE)
  }

  // Specific surah/ayah lookup
  const surahParam = searchParams.get('surah')
  const ayahParam  = searchParams.get('ayah')
  if (!surahParam) {
    return NextResponse.json({ error: 'surah parameter required' }, { status: 400 })
  }

  // Resolve surah name → number
  const surahNo = /^\d+$/.test(surahParam)
    ? parseInt(surahParam, 10)
    : getSurahNumberByName(surahParam)

  if (!surahNo) {
    return NextResponse.json({ error: `surah not found: ${surahParam}` }, { status: 404 })
  }

  // Single ayah
  if (ayahParam) {
    const text = getAyah(surahNo, ayahParam)
    if (text === null) return NextResponse.json({ error: 'ayah not found' }, { status: 404 })
    return json({ surah: surahNo, ayah: parseInt(ayahParam, 10), text }, IMMUTABLE)
  }

  // Whole surah
  const sAyahs = getSurahAyahs(surahNo)
  if (!sAyahs) return NextResponse.json({ error: 'surah not found' }, { status: 404 })
  return json({ surah: surahNo, ayahs: sAyahs }, IMMUTABLE)
}
