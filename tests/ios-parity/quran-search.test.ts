import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import {
  canonicalizeForSearch,
  getSearchMatchRanges,
  MAX_SEARCH_RESULTS,
  parseAyahReference,
  searchQuran,
  toLatinDigits,
} from '../../src/lib/quran-search'

// Load real Quran data for integration assertions
const ayahsPath = path.resolve(process.cwd(), 'public/quran/ayahs.json')
const ayahs = JSON.parse(fs.readFileSync(ayahsPath, 'utf-8')) as Record<string, Record<string, string>>

test('toLatinDigits converts Arabic-Indic digits to Latin digits', () => {
  assert.equal(toLatinDigits('١٢٣٤٥٦٧٨٩٠'), '1234567890')
  assert.equal(toLatinDigits('سورة ٢ آية ٢٥٥'), 'سورة 2 آية 255')
  assert.equal(toLatinDigits('2:255'), '2:255')
})

test('parseAyahReference parses numeric and text ayah references correctly', () => {
  // Numeric references
  const r1 = parseAyahReference('2:255')
  assert.ok(r1)
  assert.equal(r1.surah, 2)
  assert.equal(r1.ayah, 255)
  assert.equal(r1.surahName, 'البقرة')
  assert.equal(r1.page, 42)

  // Arabic Indic digits
  const r2 = parseAyahReference('٢:٢٥٥')
  assert.ok(r2)
  assert.equal(r2.surah, 2)
  assert.equal(r2.ayah, 255)

  // Surah name + number
  const r3 = parseAyahReference('البقرة 255')
  assert.ok(r3)
  assert.equal(r3.surah, 2)
  assert.equal(r3.ayah, 255)

  // With prefix "سورة" and colon
  const r4 = parseAyahReference('سورة البقرة: 255')
  assert.ok(r4)
  assert.equal(r4.surah, 2)
  assert.equal(r4.ayah, 255)

  // First surah / ayah
  const r5 = parseAyahReference('الفاتحة 1')
  assert.ok(r5)
  assert.equal(r5.surah, 1)
  assert.equal(r5.ayah, 1)
  assert.equal(r5.page, 1)

  // Invalid references should return null
  assert.equal(parseAyahReference('2:300'), null) // Al-Baqarah only has 286 ayahs
  assert.equal(parseAyahReference('0:1'), null)
  assert.equal(parseAyahReference('115:1'), null)
  assert.equal(parseAyahReference('الحمد لله'), null)
  assert.equal(parseAyahReference(''), null)
})

test('canonicalizeForSearch folds diacritics, wasla, and Uthmani orthography', () => {
  // Tashkeel stripping and wasla folding
  assert.equal(canonicalizeForSearch('ٱلۡحَمۡدُ لِلَّهِ'), 'الحمد لله')
  assert.equal(canonicalizeForSearch('ٱهۡدِنَا ٱلصِّرَٰطَ'), 'اهدنا الصراط')

  // Waw with dagger alef (الصلوة -> الصلاة / الصلاه)
  assert.equal(canonicalizeForSearch('ٱلصَّلَوٰةَ'), 'الصلاه')
  assert.equal(canonicalizeForSearch('الصلاة'), 'الصلاه')

  // Az-Zakah
  assert.equal(canonicalizeForSearch('ٱلزَّكَوٰةَ'), 'الزكاه')
  assert.equal(canonicalizeForSearch('الزكاة'), 'الزكاه')

  // Al-Hayah
  assert.equal(canonicalizeForSearch('ٱلۡحَيَوٰةِ'), 'الحياه')

  // Ya ayyuha
  assert.equal(canonicalizeForSearch('يَـٰٓأَيُّهَا'), 'يايها')
  assert.equal(canonicalizeForSearch('يا أيها'), 'يايها')

  // Dagger-alef folding: ilah / ar-rahman
  assert.equal(canonicalizeForSearch('إِلَٰهَ'), 'اله')
  assert.equal(canonicalizeForSearch('إله'), 'اله')
  assert.equal(canonicalizeForSearch('ٱلرَّحۡمَٰنِ'), 'الرحمن')
  assert.equal(
    canonicalizeForSearch('ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ ٱلۡحَيُّ ٱلۡقَيُّومُ'),
    'الله لا اله الا هو الحي القيوم'
  )
})

test('searchQuran in Smart mode parses ayah reference directly', () => {
  const results = searchQuran({ query: '2:255', mode: 'smart', ayahs })
  assert.equal(results.length, 1)
  assert.equal(results[0].surah, 2)
  assert.equal(results[0].ayah, 255)
  assert.equal(results[0].matchType, 'reference')
  assert.ok(results[0].text.includes('ٱلۡحَيُّ ٱلۡقَيُّومُ'))
  assert.ok(canonicalizeForSearch(results[0].text).includes('الحي القيوم'))
})

test('searchQuran matches diacritics-insensitive and folds ٱ to ا', () => {
  // Query plain Arabic text without diacritics
  const results = searchQuran({ query: 'الحمد لله رب العالمين', mode: 'smart', ayahs })
  assert.ok(results.length >= 1)
  const fatiha = results.find((r) => r.surah === 1 && r.ayah === 2)
  assert.ok(fatiha, 'Should match Al-Fatiha ayah 2')

  // Wasla folding: "اهدنا الصراط" matches "ٱهۡدِنَا ٱلصِّرَٰطَ"
  const r2 = searchQuran({ query: 'اهدنا الصراط', mode: 'smart', ayahs })
  assert.ok(r2.length >= 1)
  const sirat = r2.find((r) => r.surah === 1 && r.ayah === 6)
  assert.ok(sirat, 'Should match Al-Fatiha ayah 6')
})

test('searchQuran matches Uthmani orthography (الصلاة / الزكاة)', () => {
  const results = searchQuran({ query: 'يقيمون الصلاة', mode: 'smart', ayahs })
  assert.ok(results.length >= 1)
  const baqarah3 = results.find((r) => r.surah === 2 && r.ayah === 3)
  assert.ok(baqarah3, 'Should find 2:3 which has يُقِيمُونَ ٱلصَّلَوٰةَ')
})

test('searchQuran Exact mode requires contiguous phrase match', () => {
  // Contiguous phrase
  const exact = searchQuran({ query: 'مالك يوم الدين', mode: 'exact', ayahs })
  assert.equal(exact.length, 1)
  assert.equal(exact[0].surah, 1)
  assert.equal(exact[0].ayah, 4)

  // Non-contiguous tokens in exact mode should NOT match
  const nonContiguous = searchQuran({ query: 'يوم الدين مالك', mode: 'exact', ayahs })
  assert.equal(nonContiguous.length, 0)
})

test('searchQuran Broad mode uses OR logic and ranks by matched token count', () => {
  const broad = searchQuran({ query: 'الحمد الرحمن الرحيم', mode: 'broad', ayahs })
  assert.ok(broad.length > 1)
  // Ayah with all three tokens (e.g. Al-Fatiha 1:1 or 1:3) or highest token count should be ranked first
  const first = broad[0]
  assert.ok(first.score >= broad[broad.length - 1].score)
  assert.equal(first.matchType, 'broad')
})

test('searchQuran Smart mode ranks contiguous phrase higher', () => {
  const results = searchQuran({ query: 'الله لا اله الا هو الحي القيوم', mode: 'smart', ayahs })
  assert.ok(results.length >= 1)
  // Ayat al-kursi (2:255) matches all tokens contiguously and should rank first
  assert.equal(results[0].surah, 2)
  assert.equal(results[0].ayah, 255)
  assert.ok(results[0].score > 100)
})

test('searchQuran respects result limit and MAX_SEARCH_RESULTS cap', () => {
  // Common word "الله" has thousands of occurrences in the Quran
  const capped = searchQuran({ query: 'الله', mode: 'smart', limit: MAX_SEARCH_RESULTS, ayahs })
  assert.equal(capped.length, MAX_SEARCH_RESULTS)

  // Custom smaller limit
  const top5 = searchQuran({ query: 'الله', mode: 'smart', limit: 5, ayahs })
  assert.equal(top5.length, 5)
})

test('getSearchMatchRanges finds correct highlighting spans', () => {
  const text = 'ٱلۡحَمۡدُ لِلَّهِ رَبِّ ٱلۡعَٰلَمِينَ'
  const ranges = getSearchMatchRanges(text, 'رب العالمين', 'exact')
  assert.ok(ranges.length > 0)
  const [start, end] = ranges[0]
  assert.ok(start >= 0 && end <= text.length)
  const sliced = text.slice(start, end)
  assert.ok(sliced.includes('رَبِّ'))
})
