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
  url.searchParams.set('word_fields', 'code_v2,text_qpc_hafs,text_uthmani')
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

async function importPage(pageNumber) {
  const url = buildUrl(pageNumber)
  const data = await fetchJsonWithRetry(url)
  const lines = createEmptyLines(pageNumber)
  const linesByNumber = new Map(lines.map((line) => [line.lineNumber, line]))
  let tokenCount = 0

  if (!Array.isArray(data.verses)) {
    throw new Error(`Page ${pageNumber} response has no verses array`)
  }

  for (const verse of data.verses) {
    if (!Array.isArray(verse.words)) continue

    for (const rawWord of verse.words) {
      const lineNumber = rawWord.line_number
      const line = linesByNumber.get(lineNumber)
      if (!line) {
        throw new Error(`Page ${pageNumber} word ${rawWord.id} has invalid line ${lineNumber}`)
      }

      line.words.push(normalizeWord(rawWord, verse, pageNumber, line))
      tokenCount += 1
    }
  }

  return {
    pageNumber,
    lines,
    tokenCount,
    ayahKeys: data.verses.map((verse) => verse.verse_key),
    sourceUrl: url.toString(),
  }
}

async function importBatch(pageNumbers) {
  return Promise.all(pageNumbers.map((pageNumber) => importPage(pageNumber)))
}

const pages = []
const reportPages = []

for (let index = 1; index <= PAGE_COUNT; index += CONCURRENCY) {
  const pageNumbers = Array.from(
    { length: Math.min(CONCURRENCY, PAGE_COUNT - index + 1) },
    (_, offset) => index + offset
  )
  const imported = await importBatch(pageNumbers)
  for (const page of imported) {
    pages.push({
      pageNumber: page.pageNumber,
      lines: page.lines,
    })
    reportPages.push({
      pageNumber: page.pageNumber,
      tokenCount: page.tokenCount,
      ayahKeys: page.ayahKeys,
      sourceUrl: page.sourceUrl,
    })
  }
  process.stdout.write(`Imported word lines through page ${Math.min(index + CONCURRENCY - 1, PAGE_COUNT)}\r`)
}

pages.sort((a, b) => a.pageNumber - b.pageNumber)
reportPages.sort((a, b) => a.pageNumber - b.pageNumber)

const totalTokens = reportPages.reduce((sum, page) => sum + page.tokenCount, 0)
const fetchedAt = new Date().toISOString()
const source = {
  name: 'Quran.com API v4 verses by page words',
  url: `${SOURCE_BASE_URL}/{page}?words=true&word_fields=code_v2,text_qpc_hafs,text_uthmani&mushaf=1`,
  fetchedAt,
  notes: 'Verified source fixture for Mushaf page -> line -> word/token rendering. Uses QCF V2 glyph codes and Quran.com line_number values; empty line slots are preserved to keep 15-line page architecture.',
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
