// Data-integrity check for the 604 page-word fixtures: catches the "corrupted page" class of
// bugs (words placed on the page where their verse starts instead of their own page, lines
// out of order, surah headers/basmalas without an empty slot, misplaced ayah-end markers).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const DIR = join(ROOT, 'packages/quran-data/mushaf1441/fixtures/page-words')
const PAGE_COUNT = 604
const LINES = 15

function fail(message) {
  console.error(`Mushaf 1441 page-order validation failed: ${message}`)
  process.exit(1)
}

const pages = new Map()
for (let pageNumber = 1; pageNumber <= PAGE_COUNT; pageNumber += 1) {
  const file = join(DIR, `page-${String(pageNumber).padStart(3, '0')}.json`)
  pages.set(pageNumber, JSON.parse(readFileSync(file, 'utf8')))
}

const order = (word) => word.surahNumber * 1e6 + word.ayahNumber * 1e3 + word.wordIndexInAyah
let previous = null
let tokens = 0

for (const [pageNumber, page] of pages) {
  if (page.lines.length !== LINES) fail(`page ${pageNumber} has ${page.lines.length} lines`)
  for (const line of page.lines) {
    for (const word of line.words) {
      tokens += 1
      if (word.pageNumber !== pageNumber || word.lineNumber !== line.lineNumber) {
        fail(`word ${word.id} fields say ${word.pageNumber}:${word.lineNumber} but sits on ${pageNumber}:${line.lineNumber}`)
      }
      if (previous && order(word) <= order(previous)) {
        fail(`reading order breaks on page ${pageNumber} line ${line.lineNumber}: ${previous.ayahKey}#${previous.wordIndexInAyah} → ${word.ayahKey}#${word.wordIndexInAyah}`)
      }
      previous = word
    }
  }
}

// Every surah start needs empty slots above it (header, plus basmala except surahs 1 and 9),
// possibly continuing onto the previous page; every empty line must be such a slot.
const usedSlots = new Set()
for (const [pageNumber, page] of pages) {
  for (const line of page.lines) {
    const first = line.words[0]
    if (!first || first.ayahNumber !== 1 || first.wordIndexInAyah !== 1) continue
    const needed = first.surahNumber === 1 || first.surahNumber === 9 ? 1 : 2
    let slotPage = pageNumber
    let slotLine = line.lineNumber - 1
    for (let i = 0; i < needed; i += 1) {
      if (slotLine < 1) { slotPage -= 1; slotLine = LINES }
      const slot = pages.get(slotPage)?.lines[slotLine - 1]
      if (!slot || slot.words.length > 0) fail(`surah ${first.surahNumber} (page ${pageNumber}) has no empty slot for its header/basmala`)
      usedSlots.add(`${slotPage}:${slotLine}`)
      slotLine -= 1
    }
  }
}
for (const [pageNumber, page] of pages) {
  if (pageNumber <= 2) continue // Al-Fatihah / Al-Baqarah opening pages are short centred blocks
  for (const line of page.lines) {
    if (line.words.length === 0 && !usedSlots.has(`${pageNumber}:${line.lineNumber}`)) {
      fail(`page ${pageNumber} line ${line.lineNumber} is empty but is not a surah header/basmala slot`)
    }
  }
}

if (tokens < 83000) fail(`expected ~83.6k tokens, found ${tokens}`)
console.log(`Mushaf 1441 page-order validation passed (${tokens} tokens, ${usedSlots.size} header/basmala slots).`)
