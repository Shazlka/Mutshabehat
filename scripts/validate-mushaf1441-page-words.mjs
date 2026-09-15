import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const MANIFEST_PATH = join(ROOT, 'packages/quran-data/mushaf1441/fixtures/page-words-manifest.json')
const PAGE_WORDS_DIR = join(ROOT, 'packages/quran-data/mushaf1441/fixtures/page-words')
const VIEWER_PATH = join(ROOT, 'src/app/mushaf-1441/_components/Mushaf1441Viewer.tsx')
const LOADER_PATH = join(ROOT, 'packages/quran-data/mushaf1441/pageLoader.ts')
const INDEX_PATH = join(ROOT, 'packages/quran-data/mushaf1441/pageWordsIndex.ts')

function fail(message) {
  console.error(`Mushaf 1441 page-word validation failed: ${message}`)
  process.exit(1)
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    fail(`Cannot read ${path}: ${error.message}`)
  }
}

const manifest = readJson(MANIFEST_PATH)

if (manifest?.source?.name !== 'Quran.com API v4 verses by page words') {
  fail('fixture source name must be Quran.com API v4 verses by page words')
}

if (manifest.pageCount !== 604 || !Array.isArray(manifest.pages) || manifest.pages.length !== 604) {
  fail(`expected 604 manifest pages, found ${manifest.pages?.length ?? 'none'}`)
}

const seenIds = new Set()
let totalTokens = 0
let pagesWithFifteenLines = 0

for (let pageNumber = 1; pageNumber <= 604; pageNumber += 1) {
  const paddedPage = String(pageNumber).padStart(3, '0')
  const page = readJson(join(PAGE_WORDS_DIR, `page-${paddedPage}.json`))

  if (!Number.isInteger(page.pageNumber) || page.pageNumber < 1 || page.pageNumber > 604) {
    fail(`invalid page number ${page.pageNumber}`)
  }
  if (page.pageNumber !== pageNumber) {
    fail(`page file ${paddedPage} contains page ${page.pageNumber}`)
  }

  if (!Array.isArray(page.lines) || page.lines.length === 0) {
    fail(`page ${page.pageNumber} has no lines`)
  }

  const lineNumbers = page.lines.map((line) => line.lineNumber)
  const uniqueLineNumbers = new Set(lineNumbers)
  if (uniqueLineNumbers.size !== lineNumbers.length) {
    fail(`page ${page.pageNumber} has duplicate line numbers`)
  }

  if (lineNumbers.some((lineNumber) => !Number.isInteger(lineNumber) || lineNumber < 1 || lineNumber > 15)) {
    fail(`page ${page.pageNumber} has a line outside 1-15`)
  }

  if (uniqueLineNumbers.size === 15) pagesWithFifteenLines += 1

  for (const line of page.lines) {
    if (line.pageNumber !== page.pageNumber) {
      fail(`line ${line.lineNumber} on page ${page.pageNumber} has mismatched pageNumber`)
    }

    if (!Array.isArray(line.words) || line.words.length === 0) {
      continue
    }

    let previousIndex = 0
    for (const word of line.words) {
      totalTokens += 1

      if (typeof word.id !== 'string' || word.id.length === 0) {
        fail(`page ${page.pageNumber} line ${line.lineNumber} has a word without id`)
      }
      if (seenIds.has(word.id)) {
        fail(`duplicate word id ${word.id}`)
      }
      seenIds.add(word.id)

      if (word.pageNumber !== page.pageNumber || word.lineNumber !== line.lineNumber) {
        fail(`word ${word.id} has mismatched page/line numbers`)
      }
      if (!Number.isInteger(word.wordIndexInLine) || word.wordIndexInLine <= previousIndex) {
        fail(`word order is unstable on page ${page.pageNumber} line ${line.lineNumber}`)
      }
      previousIndex = word.wordIndexInLine

      if (!Number.isInteger(word.surahNumber) || !Number.isInteger(word.ayahNumber)) {
        fail(`word ${word.id} is missing surahNumber or ayahNumber`)
      }
      if (word.ayahKey !== `${word.surahNumber}:${word.ayahNumber}`) {
        fail(`word ${word.id} has invalid ayahKey ${word.ayahKey}`)
      }
      if (!Number.isInteger(word.wordIndexInAyah) || word.wordIndexInAyah < 1) {
        fail(`word ${word.id} has invalid wordIndexInAyah`)
      }
      if (typeof word.textUthmani !== 'string' || word.textUthmani.length === 0) {
        fail(`word ${word.id} is missing textUthmani`)
      }
      if (typeof word.glyph !== 'string' || word.glyph.length === 0) {
        fail(`word ${word.id} is missing QCF glyph`)
      }
    }
  }
}

if (totalTokens < 70000) {
  fail(`expected complete word/end-marker token data, found only ${totalTokens}`)
}

if (pagesWithFifteenLines < 550) {
  fail(`expected most pages to preserve 15 line slots, found ${pagesWithFifteenLines}`)
}

const loader = readFileSync(LOADER_PATH, 'utf8')
if (!loader.includes('pageWordsIndex') || !loader.includes('page-words-manifest.json')) {
  fail('pageLoader must use the per-page word fixture index and manifest')
}

const index = readFileSync(INDEX_PATH, 'utf8')
for (const pageNumber of [1, 2, 255, 604]) {
  const paddedPage = String(pageNumber).padStart(3, '0')
  if (!index.includes(`page-${paddedPage}.json`)) {
    fail(`pageWordsIndex is missing page-${paddedPage}.json`)
  }
}

const viewer = readFileSync(VIEWER_PATH, 'utf8')
for (const required of ['QCF V2', 'dangerouslySetInnerHTML', 'line-words', 'loadQcfFontForPage']) {
  if (!viewer.includes(required)) {
    fail(`viewer is missing ${required}`)
  }
}

for (const required of ['MUSHAF_PAGE_WIDTH', 'MUSHAF_PAGE_HEIGHT', 'MUSHAF_SPREAD_PAGE_WIDTH']) {
  if (!viewer.includes(required)) {
    fail(`viewer is missing page aspect sizing: ${required}`)
  }
}

for (const required of [
  'MUSHAF_PAGE_PRINT_PADDING_X',
  'MUSHAF_PAGE_PRINT_PADDING_Y',
  'MUSHAF_QCF_FONT_SIZE',
  'MUSHAF_QCF_LINE_HEIGHT',
  "containerType: 'inline-size'",
  "fontSize: MUSHAF_QCF_FONT_SIZE",
  "lineHeight: MUSHAF_QCF_LINE_HEIGHT",
  "fontSize: useGlyph ? '1em'",
  "lineHeight: 'inherit'",
  '[word-spacing:0]',
]) {
  if (!viewer.includes(required)) {
    fail(`viewer is missing page-bound font/layout metric: ${required}`)
  }
}

for (const forbidden of [
  "MUSHAF_PAGE_PRINT_PADDING_X = '8.5%'",
  "MUSHAF_PAGE_PRINT_PADDING_Y = '7.2%'",
  "MUSHAF_QCF_FONT_SIZE = 'calc(3.65cqw + 1.5px)'",
  'min-h-[640px]',
  'sm:min-h-[820px]',
  'border-b border-[#efe7d7]',
  'text-[1.38rem]',
  'md:text-[1.9rem]',
  'lg:text-[2.08rem]',
  'mx-[0.5px]',
  'px-[1px]',
  '[word-spacing:0.04em]',
]) {
  if (viewer.includes(forbidden)) {
    fail(`viewer still contains old compressed/outlined page styling: ${forbidden}`)
  }
}

console.log(`Mushaf 1441 page-word validation passed (${manifest.pages.length} pages, ${totalTokens} tokens).`)
