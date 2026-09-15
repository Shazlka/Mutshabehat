import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const ROOT = process.cwd()
const PAGE_WORDS_DIR = join(ROOT, 'packages/quran-data/mushaf1441/fixtures/page-words')
const MANIFEST_PATH = join(ROOT, 'packages/quran-data/mushaf1441/fixtures/page-words-manifest.json')
const INDEX_PATH = join(ROOT, 'packages/quran-data/mushaf1441/pageWordsIndex.ts')
const REPORT_PATH = join(ROOT, 'packages/quran-data/mushaf1441/page-words-report.json')
const PAGE_COUNT = 604
const LINES_PER_PAGE = 15
const CONCURRENCY = 8
const SOURCE_BASE_URL = 'https://api.quran.com/api/v4/verses/by_page'

function buildUrl(pageNumber) {
  const url = new URL(`${SOURCE_BASE_URL}/${pageNumber}`)
  url.searchParams.set('language', 'en')
  url.searchParams.set('words', 'true')
  url.searchParams.set('word_fields', 'code_v2,text_qpc_hafs,text_uthmani,page_number,line_number')
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
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`)
      }
      return await response.json()
    } catch (error) {
      lastError = error
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 500))
      }
    }
  }
  throw lastError
}

function createEmptyLines(pageNumber) {
  return Array.from({ length: LINES_PER_PAGE }, (_, index) => ({
    pageNumber,
    lineNumber: index + 1,
    words: [],
  }))
}

function normalizeWord(rawWord, verse, pageNumber, line) {
  const glyph = rawWord.code_v2 ?? rawWord.text
  const textUthmani = rawWord.text_uthmani ?? rawWord.text_qpc_hafs ?? rawWord.text

  return {
    id: `qurancom-word-${rawWord.id}`,
    pageNumber,
    lineNumber: line.lineNumber,
    wordIndexInLine: line.words.length + 1,
    surahNumber: verse.chapter_id,
    ayahNumber: verse.verse_number,
    wordIndexInAyah: rawWord.position,
    ayahKey: verse.verse_key,
    textUthmani,
    glyph,
    textQpcHafs: rawWord.text_qpc_hafs,
    charTypeName: rawWord.char_type_name,
    qcfVersion: 'v2',
  }
}

// `verses/by_page/{n}` returns every verse that STARTS on page n, including the words of
// that verse which spill onto page n+1. Each word carries its own `page_number` and
// `line_number`, and QCF V2 glyph codes are only valid with the font of the word's own
// page. So words must be placed by their own page_number, never by the requested page
// (doing the latter produced out-of-order lines, missing header slots and wrong glyphs).
async function fetchPageVerses(pageNumber) {
  const url = buildUrl(pageNumber)
  const data = await fetchJsonWithRetry(url)
  if (!Array.isArray(data.verses)) {
    throw new Error(`Page ${pageNumber} response has no verses array`)
  }
  return { pageNumber, verses: data.verses, sourceUrl: url.toString() }
}

const wordKey = (word) => word.surahNumber * 1e6 + word.ayahNumber * 1e3 + word.wordIndexInAyah
const pageLines = new Map()
const sourceUrlByPage = new Map()
const seenWordIds = new Set()

function linesForPage(pageNumber) {
  if (!pageLines.has(pageNumber)) pageLines.set(pageNumber, createEmptyLines(pageNumber))
  return pageLines.get(pageNumber)
}

for (let index = 1; index <= PAGE_COUNT; index += CONCURRENCY) {
  const pageNumbers = Array.from(
    { length: Math.min(CONCURRENCY, PAGE_COUNT - index + 1) },
    (_, offset) => index + offset
  )
  const fetched = await Promise.all(pageNumbers.map((pageNumber) => fetchPageVerses(pageNumber)))
  for (const { pageNumber, verses, sourceUrl } of fetched) {
    sourceUrlByPage.set(pageNumber, sourceUrl)
    for (const verse of verses) {
      if (!Array.isArray(verse.words)) continue
      for (const rawWord of verse.words) {
        if (seenWordIds.has(rawWord.id)) continue
        seenWordIds.add(rawWord.id)
        const wordPage = rawWord.page_number ?? pageNumber
        const lines = linesForPage(wordPage)
        const line = lines[rawWord.line_number - 1]
        if (!line || wordPage < 1 || wordPage > PAGE_COUNT) {
          throw new Error(`Word ${rawWord.id} (${verse.verse_key}) has invalid page/line ${wordPage}/${rawWord.line_number}`)
        }
        line.words.push(normalizeWord(rawWord, verse, wordPage, line))
      }
    }
  }
  process.stdout.write(`Fetched verses through page ${Math.min(index + CONCURRENCY - 1, PAGE_COUNT)}\r`)
}

// Source quirk: an ayah-end marker occasionally carries a line_number BEFORE the ayah's
// last words (e.g. 84:21 on page 589). The marker always belongs right after the ayah's
// final word, so move it to the last line that holds a word of the same ayah on its page.
for (const lines of pageLines.values()) {
  for (const line of lines) {
    for (const marker of [...line.words]) {
      if (marker.charTypeName !== 'end') continue
      const lastLine = [...lines].reverse().find((candidate) =>
        candidate.words.some((word) => word.ayahKey === marker.ayahKey && word.charTypeName !== 'end'))
      if (!lastLine || lastLine.lineNumber <= line.lineNumber) continue
      line.words.splice(line.words.indexOf(marker), 1)
      marker.lineNumber = lastLine.lineNumber
      lastLine.words.push(marker)
    }
  }
}

const pages = []
const reportPages = []
for (let pageNumber = 1; pageNumber <= PAGE_COUNT; pageNumber += 1) {
  const lines = linesForPage(pageNumber)
  const ayahKeys = []
  let tokenCount = 0
  for (const line of lines) {
    line.words.sort((a, b) => wordKey(a) - wordKey(b))
    line.words.forEach((word, i) => { word.wordIndexInLine = i + 1 })
    for (const word of line.words) {
      if (ayahKeys[ayahKeys.length - 1] !== word.ayahKey && !ayahKeys.includes(word.ayahKey)) ayahKeys.push(word.ayahKey)
    }
    tokenCount += line.words.length
  }
  pages.push({ pageNumber, lines })
  reportPages.push({ pageNumber, tokenCount, ayahKeys, sourceUrl: sourceUrlByPage.get(pageNumber) })
}

const totalTokens = reportPages.reduce((sum, page) => sum + page.tokenCount, 0)
const fetchedAt = new Date().toISOString()
const source = {
  name: 'Quran.com API v4 verses by page words',
  url: `${SOURCE_BASE_URL}/{page}?words=true&word_fields=code_v2,text_qpc_hafs,text_uthmani&mushaf=1`,
  fetchedAt,
  notes: 'Verified source fixture for Mushaf page -> line -> word/token rendering. Uses QCF V2 glyph codes; words are placed by their own Quran.com page_number + line_number (a verse can span pages); empty line slots are preserved to keep 15-line page architecture.',
}
const manifest = {
  source,
  pageCount: pages.length,
  lineSlotsPerPage: LINES_PER_PAGE,
  totalTokens,
  pages: reportPages.map((page) => ({
    pageNumber: page.pageNumber,
    tokenCount: page.tokenCount,
    ayahKeys: page.ayahKeys,
  })),
}

const indexLines = [
  "import type { MushafPage } from './types'",
  '',
  'type PageWordsModule = { default: MushafPage }',
  'type PageWordsLoader = () => Promise<PageWordsModule>',
  '',
  'export const MUSHAF_1441_PAGE_WORDS_LOADERS: Record<number, PageWordsLoader> = {',
]

mkdirSync(PAGE_WORDS_DIR, { recursive: true })
for (const page of pages) {
  const paddedPage = String(page.pageNumber).padStart(3, '0')
  writeFileSync(join(PAGE_WORDS_DIR, `page-${paddedPage}.json`), `${JSON.stringify(page, null, 2)}\n`)
  indexLines.push(
    `  ${page.pageNumber}: () => import('./fixtures/page-words/page-${paddedPage}.json') as Promise<PageWordsModule>,`
  )
}
indexLines.push('}')
indexLines.push('')

const report = {
  generatedAt: fetchedAt,
  source,
  pageCount: pages.length,
  lineSlotsPerPage: LINES_PER_PAGE,
  totalTokens,
  pages: reportPages,
}

mkdirSync(dirname(MANIFEST_PATH), { recursive: true })
writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`)
writeFileSync(INDEX_PATH, `${indexLines.join('\n')}`)
writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`)

console.log(`\nImported ${totalTokens} word/end-marker tokens across ${pages.length} pages.`)
console.log(`Manifest: ${MANIFEST_PATH}`)
console.log(`Page fixtures: ${PAGE_WORDS_DIR}`)
console.log(`Index: ${INDEX_PATH}`)
console.log(`Report: ${REPORT_PATH}`)
