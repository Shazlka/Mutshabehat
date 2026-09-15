import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const OUT_PATH = join(ROOT, 'packages/quran-data/mushaf1441/fixtures/page-metadata.json')
const PAGE_COUNT = 604
const SOURCE_BASE_URL = 'https://api.quran.com/api/v4/verses/by_page'
const surahNames = JSON.parse(readFileSync(join(ROOT, 'public/quran/surah-names.json'), 'utf8'))
const ayahs = JSON.parse(readFileSync(join(ROOT, 'public/quran/ayahs.json'), 'utf8'))

function buildUrl(pageNumber) {
  const url = new URL(`${SOURCE_BASE_URL}/${pageNumber}`)
  url.searchParams.set('language', 'en')
  url.searchParams.set('words', 'false')
  url.searchParams.set('fields', 'text_uthmani,chapter_id,verse_number,page_number')
  url.searchParams.set('per_page', '50')
  url.searchParams.set('mushaf', '1')
  return url
}

async function fetchJsonWithRetry(url, attempts = 3) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`)
      return await response.json()
    } catch (error) {
      lastError = error
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 400))
    }
  }
  throw lastError
}

const pages = []
const ayahToPage = {}
const surahPages = new Map()

for (let pageNumber = 1; pageNumber <= PAGE_COUNT; pageNumber += 1) {
  const data = await fetchJsonWithRetry(buildUrl(pageNumber))
  if (!Array.isArray(data.verses) || data.verses.length === 0) {
    throw new Error(`Page ${pageNumber} has no verses`)
  }

  const first = data.verses[0]
  const last = data.verses[data.verses.length - 1]
  const surahNumbers = [...new Set(data.verses.map((verse) => verse.chapter_id))]
  const juzNumbers = [...new Set(data.verses.map((verse) => verse.juz_number))]
  const rubNumbers = [...new Set(data.verses.map((verse) => verse.rub_el_hizb_number))]
  const hizbNumbers = [...new Set(data.verses.map((verse) => verse.hizb_number))]

  for (const verse of data.verses) {
    ayahToPage[verse.verse_key] = pageNumber
    if (!surahPages.has(verse.chapter_id)) {
      surahPages.set(verse.chapter_id, { firstPage: pageNumber, lastPage: pageNumber })
    } else {
      surahPages.get(verse.chapter_id).lastPage = pageNumber
    }
  }

  pages.push({
    pageNumber,
    firstAyahKey: first.verse_key,
    lastAyahKey: last.verse_key,
    surahNumbers,
    surahNames: surahNumbers.map((surahNumber) => surahNames[String(surahNumber)]),
    juzNumber: juzNumbers[0],
    hizbNumber: hizbNumbers[0],
    rubElHizbNumber: rubNumbers[0],
    rubInJuz: ((rubNumbers[0] - 1) % 8) + 1,
  })

  process.stdout.write(`Imported metadata through page ${pageNumber}\r`)
}

const surahs = Object.entries(surahNames).map(([surahNumberText, name]) => {
  const surahNumber = Number(surahNumberText)
  const pageRange = surahPages.get(surahNumber)
  return {
    surahNumber,
    name,
    ayahCount: Object.keys(ayahs[surahNumberText] ?? {}).length,
    firstPage: pageRange?.firstPage ?? null,
    lastPage: pageRange?.lastPage ?? null,
  }
})

const fixture = {
  source: {
    name: 'Quran.com API v4 verses by page metadata',
    url: `${SOURCE_BASE_URL}/{page}?words=false&mushaf=1`,
    fetchedAt: new Date().toISOString(),
    notes: 'Compact metadata for Mushaf 1441 page headers, surah/ayah navigation, juz, hizb, and rub el hizb display.',
  },
  pages,
  ayahToPage,
  surahs,
}

writeFileSync(OUT_PATH, `${JSON.stringify(fixture, null, 2)}\n`)
console.log(`\nWrote ${OUT_PATH}`)
