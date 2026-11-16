import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { MUSHAF_PAGE_COUNT, type AyahKey, compareAyahKeys, makeAyahKey } from './types'
import { QuranIndex, type AyahLayoutFile, type AyahLayoutRow } from './quranIndex'

// Node-only loaders (tests, scripts). Browser code must use `QuranIndex.fromLayout(...)` with
// `public/quran/ayah-layout.json` instead: this file reads from disk.

let defaultIndexInstance: QuranIndex | null = null
let defaultSurahNames: Record<number, string> | null = null

export function loadDefaultQuranIndex(): QuranIndex {
  if (defaultIndexInstance) {
    return defaultIndexInstance
  }

  const fixturesDir = findFixturesDir()
  const metadataPath = join(fixturesDir, 'page-metadata.json')
  const metadataRaw = JSON.parse(readFileSync(metadataPath, 'utf8'))

  const pageJuz: Record<number, number> = {}
  for (const page of metadataRaw.pages) {
    pageJuz[page.pageNumber] = page.juzNumber
  }

  const wordsDir = join(fixturesDir, 'page-words')
  const rowsMap = new Map<string, { key: AyahKey; page: number; wordCount: number }>()

  for (let p = 1; p <= MUSHAF_PAGE_COUNT; p += 1) {
    const padded = String(p).padStart(3, '0')
    const filePath = join(wordsDir, `page-${padded}.json`)
    const pageData = JSON.parse(readFileSync(filePath, 'utf8'))

    for (const line of pageData.lines) {
      for (const word of line.words) {
        const isWord = word.charTypeName === 'word' || (!word.charTypeName && word.textUthmani)
        const kStr = `${word.surahNumber}:${word.ayahNumber}`
        let entry = rowsMap.get(kStr)
        if (!entry) {
          entry = {
            key: makeAyahKey(word.surahNumber, word.ayahNumber),
            page: word.pageNumber ?? p,
            wordCount: 0,
          }
          rowsMap.set(kStr, entry)
        } else {
          entry.page = Math.min(entry.page, word.pageNumber ?? p)
        }
        if (isWord) {
          entry.wordCount += 1
        }
      }
    }
  }

  const rows: AyahLayoutRow[] = Array.from(rowsMap.values()).sort((a, b) =>
    compareAyahKeys(a.key, b.key),
  )

  defaultIndexInstance = new QuranIndex(rows, pageJuz)
  return defaultIndexInstance
}

export function loadSurahNames(): Record<number, string> {
  if (defaultSurahNames) {
    return defaultSurahNames
  }

  const candidatePaths = [
    resolve(process.cwd(), 'public/quran/surah-names.json'),
    resolve(__dirname, '../../../public/quran/surah-names.json'),
    resolve(__dirname, '../../public/quran/surah-names.json'),
  ]

  for (const p of candidatePaths) {
    if (existsSync(p)) {
      const raw = JSON.parse(readFileSync(p, 'utf8'))
      const result: Record<number, string> = {}
      for (const [k, v] of Object.entries(raw)) {
        result[Number(k)] = String(v)
      }
      defaultSurahNames = result
      return result
    }
  }

  // Fallback names if file not found
  throw new Error('surah-names.json could not be located')
}

/** The compact layout the browser loads; built from the same fixtures as `loadDefaultQuranIndex`. */
export function buildAyahLayoutFile(): AyahLayoutFile {
  const index = loadDefaultQuranIndex()
  const rows: Array<[number, number, number, number]> = []
  for (const key of index.ayahKeys) {
    rows.push([key.surah, key.ayah, index.page(key) ?? 1, index.wordCount(key)])
  }
  const pageJuz: Record<string, number> = {}
  for (const page of index.pageNumbers) {
    const juz = index.juzOfPage(page)
    if (juz !== undefined) pageJuz[String(page)] = juz
  }
  return { rows, pageJuz }
}

function findFixturesDir(): string {
  const candidatePaths = [
    resolve(process.cwd(), 'packages/quran-data/mushaf1441/fixtures'),
    resolve(__dirname, '../quran-data/mushaf1441/fixtures'),
    resolve(__dirname, '../../quran-data/mushaf1441/fixtures'),
    resolve(__dirname, '../../../packages/quran-data/mushaf1441/fixtures'),
  ]

  for (const p of candidatePaths) {
    if (existsSync(p)) {
      return p
    }
  }

  throw new Error('mushaf1441 fixtures directory could not be located')
}
