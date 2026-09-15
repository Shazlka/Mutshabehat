import pageMetadataFixture from './fixtures/page-metadata.json'
import { isValidMushaf1441PageNumber } from './pageLoader'

export type Mushaf1441PageMetadata = {
  pageNumber: number
  firstAyahKey: string
  lastAyahKey: string
  surahNumbers: number[]
  surahNames: string[]
  juzNumber: number
  hizbNumber: number
  rubElHizbNumber: number
  rubInJuz: number
}

export type Mushaf1441SurahOption = {
  surahNumber: number
  name: string
  ayahCount: number
  firstPage: number | null
  lastPage: number | null
}

type PageMetadataFixture = {
  source: {
    name: string
    url: string
    fetchedAt: string
    notes: string
  }
  pages: Mushaf1441PageMetadata[]
  ayahToPage: Record<string, number>
  surahs: Mushaf1441SurahOption[]
}

const fixture = pageMetadataFixture as PageMetadataFixture
const metadataByPage = new Map(fixture.pages.map((page) => [page.pageNumber, page]))
const surahByNumber = new Map(fixture.surahs.map((surah) => [surah.surahNumber, surah]))

export const MUSHAF_1441_PAGE_METADATA_SOURCE = fixture.source
export const MUSHAF_1441_SURAH_OPTIONS = fixture.surahs

export function getMushaf1441PageMetadata(pageNumber: number) {
  if (!isValidMushaf1441PageNumber(pageNumber)) return null
  return metadataByPage.get(pageNumber) ?? null
}

export function getMushaf1441PageForAyahKey(ayahKey: string) {
  return fixture.ayahToPage[ayahKey] ?? null
}

export function getMushaf1441SurahOption(surahNumber: number) {
  return surahByNumber.get(surahNumber) ?? null
}

export function getMushaf1441AyahCount(surahNumber: number) {
  return getMushaf1441SurahOption(surahNumber)?.ayahCount ?? 0
}
