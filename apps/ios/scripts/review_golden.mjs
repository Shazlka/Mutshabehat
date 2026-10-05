// Golden data for the Swift ports of the web review editor's reference logic. It runs the web's own
// TypeScript (through tsx) over the real Mushaf words and reference data and writes what it returned to
// Generated/Review/golden/*.json; the Swift tests assert the ports give the same answers.
//
// Usage (from the repo root, with node_modules available):
//   npx tsx apps/ios/scripts/review_golden.mjs . apps/ios/Generated/Review/golden [section ...]

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const [repoArg, outArg, ...only] = process.argv.slice(2)
if (!repoArg || !outArg) {
  console.error('usage: review_golden.mjs REPO OUT_DIR [section ...]')
  process.exit(1)
}
const repo = path.resolve(repoArg)
const out = path.resolve(outArg)
fs.mkdirSync(out, { recursive: true })

const webImport = (rel) => import(pathToFileURL(path.join(repo, rel)).href)
const reviewLib = 'src/app/mushaf-1441/review/_lib/'
const reviewUi = 'src/app/mushaf-1441/review/_components/'
const referenceDir = path.join(repo, reviewLib, 'reference')
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const wants = (name) => only.length === 0 || only.includes(name)

/** Real Mushaf words per page (type "word" only), exactly as the review page lists them. */
function loadPages() {
  const dir = path.join(repo, 'packages/quran-data/mushaf1441/fixtures/page-words')
  const pages = []
  for (let page = 1; page <= 604; page += 1) {
    const file = path.join(dir, `page-${String(page).padStart(3, '0')}.json`)
    const words = []
    for (const line of readJson(file).lines) {
      for (const w of line.words) {
        if (w.charTypeName !== 'word') continue
        words.push({ surah: w.surahNumber, ayah: w.ayahNumber, word: w.wordIndexInAyah, text: w.textUthmani })
      }
    }
    pages.push({ page, words })
  }
  return pages
}

/** Deterministic sample: every word of a few surahs, every 7th word elsewhere. */
function sampleWords(pages) {
  const dense = new Set([1, 2, 36, 112, 113, 114])
  const samples = []
  let counter = 0
  for (const { page, words } of pages) {
    for (const w of words) {
      counter += 1
      if (dense.has(w.surah) || counter % 7 === 0) samples.push({ page, ...w })
    }
  }
  return samples
}

function ayahContext(pageWords, surah, ayah, word) {
  const ayahWords = pageWords
    .filter((w) => w.surah === surah && w.ayah === ayah)
    .map((w) => ({ word: w.word, text: w.text }))
    .sort((a, b) => a.word - b.word)
  return { wordIndex: word, ayahWords }
}

async function nquran(pages) {
  const m = await webImport(`${reviewLib}nquranReference.ts`)
  const readers = await webImport(`${reviewUi}ReaderNarratorSelector.tsx`)
  const byPage = new Map(pages.map((p) => [p.page, p.words]))
  const entryCache = new Map()
  const entriesFor = (surah) => {
    if (!entryCache.has(surah)) {
      entryCache.set(surah, readJson(path.join(referenceDir, 'nquran', `surah-${String(surah).padStart(3, '0')}.json`)))
    }
    return entryCache.get(surah)
  }

  const samples = []
  for (const s of sampleWords(pages)) {
    const entry = m.findNquranEntryForAyah(entriesFor(s.surah), s.ayah)
    if (!entry) { samples.push([s.page, s.surah, s.ayah, s.word, []]); continue }
    const found = m.findNquranDifferencesForWord(entry.differences, s.text, ayahContext(byPage.get(s.page), s.surah, s.ayah, s.word))
    samples.push([s.page, s.surah, s.ayah, s.word, found.map((d) => entry.differences.indexOf(d))])
  }

  const labels = {}
  const groups = {}
  for (let surah = 1; surah <= 114; surah += 1) {
    for (const entry of entriesFor(surah)) {
      entry.differences.forEach((difference, index) => {
        for (const group of difference.groups) for (const label of group.readers) {
          if (!(label in labels)) labels[label] = m.resolveNquranReaderLabel(label)
        }
        groups[`${surah}:${entry.ayah}:${index}`] = m.resolveDifferenceGroups(difference)
          .map((r) => `${r.narratorIds.join(',')}~${r.unresolvedLabels.join(',')}`).join('|')
      })
    }
  }
  fs.writeFileSync(path.join(out, 'nquran.json'), JSON.stringify({
    samples, labels, groups,
    canonical: readers.CANONICAL_READERS, hafsId: readers.HAFS_ID,
    allNarratorIds: m.ALL_NARRATOR_IDS,
  }))
  console.log(`nquran: ${samples.length} samples, ${Object.keys(labels).length} labels, ${Object.keys(groups).length} differences`)
}

const pages = loadPages()
if (wants('nquran')) await nquran(pages)
