import pageAyahsFixture from './fixtures/page-ayahs.json'
import { isValidMushaf1441PageNumber } from './pageLoader'

export type MushafPageAyah = {
  id: number
  pageNumber: number
  surahNumber: number
  ayahNumber: number
  ayahKey: string
  textUthmani: string
}

export type MushafPageAyahSet = {
  pageNumber: number
  ayahs: MushafPageAyah[]
}

type PageAyahsFixture = {
  source: {
    name: string
    url: string
    fetchedAt: string
    notes: string
  }
  pages: MushafPageAyahSet[]
}

const fixture = pageAyahsFixture as PageAyahsFixture
const pageAyahsByPage = new Map(fixture.pages.map((page) => [page.pageNumber, page]))

export const MUSHAF_1441_PAGE_AYAHS_SOURCE = fixture.source

export function getMushaf1441PageAyahs(pageNumber: number): MushafPageAyahSet | null {
  if (!isValidMushaf1441PageNumber(pageNumber)) return null
  return pageAyahsByPage.get(pageNumber) ?? null
}

export function getMushaf1441AyahKeysForPage(pageNumber: number) {
  return getMushaf1441PageAyahs(pageNumber)?.ayahs.map((ayah) => ayah.ayahKey) ?? []
}
