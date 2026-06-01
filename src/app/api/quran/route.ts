import { NextResponse, type NextRequest } from 'next/server'
import { getAyah, getSurahAyahs, getSurahNames, getSurahNumberByName } from '@/lib/quran'
import { normalizeArabic } from '@/lib/arabic'

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
    return NextResponse.json({ surahs: getSurahNames() })
  }

  // Full-text search across all ayahs
  const search = searchParams.get('search')
  if (search) {
    const qNorm = normalizeArabic(search)
    const results: { surah: number; ayah: number; text: string }[] = []
    const ayahs = getSurahNames()
    for (const [surahNum] of Object.entries(ayahs)) {
      const sAyahs = getSurahAyahs(surahNum)
      if (!sAyahs) continue
      for (const [ayahNum, text] of Object.entries(sAyahs)) {
        if (normalizeArabic(text).includes(qNorm)) {
          results.push({ surah: parseInt(surahNum, 10), ayah: parseInt(ayahNum, 10), text })
          if (results.length >= 50) break
        }
      }
      if (results.length >= 50) break
    }
    return NextResponse.json({ query: search, results })
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
    return NextResponse.json({ surah: surahNo, ayah: parseInt(ayahParam, 10), text })
  }

  // Whole surah
  const sAyahs = getSurahAyahs(surahNo)
  if (!sAyahs) return NextResponse.json({ error: 'surah not found' }, { status: 404 })
  return NextResponse.json({ surah: surahNo, ayahs: sAyahs })
}
