import { readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  MUSHAF_PAGE_COUNT,
  type AyahKey,
  ayahKeyString,
  compareAyahKeys,
  makeAyahKey,
} from './types'

export interface AyahLayoutRow {
  readonly key: AyahKey
  readonly page: number
  readonly wordCount: number
}

export interface PageRange {
  readonly start: number
  readonly end: number
}

export class QuranIndex {
  readonly ayahKeys: readonly AyahKey[]
  private readonly ordinals = new Map<string, number>()
  private readonly ayahPages = new Map<string, number>()
  private readonly pageAyatMap = new Map<number, AyahKey[]>()
  private readonly surahAyatMap = new Map<number, AyahKey[]>()
  private readonly surahPagesMap = new Map<number, PageRange>()
  private readonly pageJuzMap: Readonly<Record<number, number>>
  private readonly juzPagesMap = new Map<number, PageRange>()
  private readonly weights = new Map<string, number>()

  constructor(rows: readonly AyahLayoutRow[], pageJuz: Record<number, number>) {
    this.ayahKeys = rows.map((r) => r.key)
    this.pageJuzMap = Object.freeze({ ...pageJuz })

    const pageWords = new Map<number, number>()
    for (let ordinal = 0; ordinal < rows.length; ordinal += 1) {
      const row = rows[ordinal]
      const kStr = ayahKeyString(row.key)
      this.ordinals.set(kStr, ordinal)
      this.ayahPages.set(kStr, row.page)

      let pageAyat = this.pageAyatMap.get(row.page)
      if (!pageAyat) {
        pageAyat = []
        this.pageAyatMap.set(row.page, pageAyat)
      }
      pageAyat.push(row.key)

      let surahAyat = this.surahAyatMap.get(row.key.surah)
      if (!surahAyat) {
        surahAyat = []
        this.surahAyatMap.set(row.key.surah, surahAyat)
      }
      surahAyat.push(row.key)

      const existingSurahRange = this.surahPagesMap.get(row.key.surah)
      if (!existingSurahRange) {
        this.surahPagesMap.set(row.key.surah, { start: row.page, end: row.page })
      } else {
        this.surahPagesMap.set(row.key.surah, {
          start: Math.min(existingSurahRange.start, row.page),
          end: Math.max(existingSurahRange.end, row.page),
        })
      }

      pageWords.set(row.page, (pageWords.get(row.page) ?? 0) + row.wordCount)
    }

    for (const row of rows) {
      const totalWords = pageWords.get(row.page) ?? 0
      const weight = totalWords === 0 ? 0 : row.wordCount / totalWords
      this.weights.set(ayahKeyString(row.key), weight)
    }

    for (const [pageStr, juz] of Object.entries(pageJuz)) {
      const page = Number(pageStr)
      const existingJuzRange = this.juzPagesMap.get(juz)
      if (!existingJuzRange) {
        this.juzPagesMap.set(juz, { start: page, end: page })
      } else {
        this.juzPagesMap.set(juz, {
          start: Math.min(existingJuzRange.start, page),
          end: Math.max(existingJuzRange.end, page),
        })
      }
    }
  }

  get totalAyahs(): number {
    return this.ayahKeys.length
  }

  get surahNumbers(): number[] {
    return Array.from(this.surahAyatMap.keys()).sort((a, b) => a - b)
  }

  get juzNumbers(): number[] {
    return Array.from(this.juzPagesMap.keys()).sort((a, b) => a - b)
  }

  get pageNumbers(): number[] {
    const pages = new Set<number>([
      ...Array.from(this.pageAyatMap.keys()),
      ...Object.keys(this.pageJuzMap).map(Number),
    ])
    return Array.from(pages).sort((a, b) => a - b)
  }

  ordinal(key: AyahKey): number | undefined {
    return this.ordinals.get(ayahKeyString(key))
  }

  ayahCount(surah: number): number {
    return this.surahAyatMap.get(surah)?.length ?? 0
  }

  page(key: AyahKey): number | undefined {
    return this.ayahPages.get(ayahKeyString(key))
  }

  ayat(page: number): AyahKey[] {
    return this.pageAyatMap.get(page) ?? []
  }

  weight(key: AyahKey): number {
    return this.weights.get(ayahKeyString(key)) ?? 0
  }

  pagesOfSurah(surah: number): PageRange | undefined {
    return this.surahPagesMap.get(surah)
  }

  ayatOfSurah(surah: number): AyahKey[] {
    return this.surahAyatMap.get(surah) ?? []
  }

  juzOfPage(page: number): number | undefined {
    return this.pageJuzMap[page]
  }

  pagesOfJuz(juz: number): PageRange | undefined {
    return this.juzPagesMap.get(juz)
  }

  ayatOfJuz(juz: number): AyahKey[] {
    const range = this.juzPagesMap.get(juz)
    if (!range) return []
    const result: AyahKey[] = []
    for (let p = range.start; p <= range.end; p += 1) {
      if (this.pageJuzMap[p] === juz) {
        const pageAyat = this.pageAyatMap.get(p)
        if (pageAyat) {
          result.push(...pageAyat)
        }
      }
    }
    return result
  }

  ayatInPages(lowerBound: number, upperBound: number): AyahKey[] {
    const start = Math.min(lowerBound, upperBound)
    const end = Math.max(lowerBound, upperBound)
    const lower = Math.max(1, start)
    const upper = Math.min(MUSHAF_PAGE_COUNT, end)
    if (lower > upper) return []
    const result: AyahKey[] = []
    for (let p = lower; p <= upper; p += 1) {
      const pageAyat = this.pageAyatMap.get(p)
      if (pageAyat) {
        result.push(...pageAyat)
      }
    }
    return result
  }

  ayatBetween(first: AyahKey, last: AyahKey): AyahKey[] {
    const start = this.ordinals.get(ayahKeyString(first))
    const end = this.ordinals.get(ayahKeyString(last))
    if (start === undefined || end === undefined) return []
    const minOrd = Math.min(start, end)
    const maxOrd = Math.max(start, end)
    return this.ayahKeys.slice(minOrd, maxOrd + 1)
  }

  // --- Static loaders ---

  private static defaultIndexInstance: QuranIndex | null = null
  private static defaultSurahNames: Record<number, string> | null = null

  public static loadDefault(): QuranIndex {
    if (QuranIndex.defaultIndexInstance) {
      return QuranIndex.defaultIndexInstance
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

    QuranIndex.defaultIndexInstance = new QuranIndex(rows, pageJuz)
    return QuranIndex.defaultIndexInstance
  }

  public static getSurahNames(): Record<number, string> {
    if (QuranIndex.defaultSurahNames) {
      return QuranIndex.defaultSurahNames
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
        QuranIndex.defaultSurahNames = result
        return result
      }
    }

    // Fallback names if file not found
    throw new Error('surah-names.json could not be located')
  }
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
