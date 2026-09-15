import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const root = process.cwd()
const fixturePath = resolve(root, 'packages/quran-data/mushaf1441/fixtures/page-ayahs.json')
const reportPath = resolve(root, 'packages/quran-data/mushaf1441/page-ayahs-report.json')
const pageCount = 604
const sourceBaseUrl = 'https://api.quran.com/api/v4/verses/by_page'

function ayahKeyOf(verse) {
  return verse.verse_key ?? `${verse.chapter_id}:${verse.verse_number}`
}

async function fetchPage(pageNumber) {
  const url = `${sourceBaseUrl}/${pageNumber}?language=en&words=false&fields=text_uthmani,chapter_id,verse_number,page_number`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch page ${pageNumber}: ${response.status} ${response.statusText}`)
  }

  const payload = await response.json()
  if (!Array.isArray(payload.verses)) {
    throw new Error(`Invalid Quran.com response for page ${pageNumber}: missing verses array`)
  }

  return payload.verses.map((verse) => ({
    id: verse.id,
    pageNumber,
    surahNumber: verse.chapter_id,
    ayahNumber: verse.verse_number,
    ayahKey: ayahKeyOf(verse),
    textUthmani: verse.text_uthmani,
  }))
}

const startedAt = new Date().toISOString()
const pages = []
const seenAyahKeys = new Set()
const duplicateAyahKeys = []

for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
  const ayahs = await fetchPage(pageNumber)
  for (const ayah of ayahs) {
    if (seenAyahKeys.has(ayah.ayahKey)) duplicateAyahKeys.push(ayah.ayahKey)
    seenAyahKeys.add(ayah.ayahKey)
  }
  pages.push({ pageNumber, ayahs })
}

const fixture = {
  source: {
    name: 'Quran.com API v4 verses by page',
    url: `${sourceBaseUrl}/{page}`,
    fetchedAt: startedAt,
    notes: 'Used only for page-to-ayah preview data in the isolated Mushaf 1441 module.',
  },
  pages,
}

const report = {
  generatedAt: new Date().toISOString(),
  sourceFetchedAt: startedAt,
  pageCount: pages.length,
  ayahCount: [...seenAyahKeys].length,
  duplicateAyahKeys,
  firstPage: pages[0],
  lastPage: pages[pages.length - 1],
}

mkdirSync(dirname(fixturePath), { recursive: true })
writeFileSync(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`)
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)

if (pages.length !== pageCount || seenAyahKeys.size !== 6236 || duplicateAyahKeys.length > 0) {
  console.error(`Mushaf page ayah import produced an invalid report: ${reportPath}`)
  process.exit(1)
}

console.log(`Imported ${seenAyahKeys.size} ayat across ${pages.length} pages.`)
console.log(`Fixture: ${fixturePath}`)
console.log(`Report: ${reportPath}`)
