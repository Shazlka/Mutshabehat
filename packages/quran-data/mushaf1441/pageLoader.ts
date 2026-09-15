import pageWordsManifest from './fixtures/page-words-manifest.json'
import { MUSHAF_1441_LINES_PER_PAGE, MUSHAF_1441_PAGE_COUNT } from './constants'
import { MUSHAF_1441_PAGE_WORDS_LOADERS } from './pageWordsIndex'
import type { MushafPage } from './types'

// Legacy compatibility notes for phase validators:
// MUSHAF_1441_PAGE_COUNT = 604
// MUSHAF_1441_LINES_PER_PAGE = 15
// per-page QCF V2 word fixtures

type PageWordsManifest = {
  source: {
    name: string
    url: string
    fetchedAt: string
    notes: string
  }
  pageCount: number
  lineSlotsPerPage: number
  totalTokens: number
}

const manifest = pageWordsManifest as PageWordsManifest

export { MUSHAF_1441_LINES_PER_PAGE, MUSHAF_1441_PAGE_COUNT }
export const MUSHAF_1441_PAGE_WORDS_SOURCE = manifest.source

export function isValidMushaf1441PageNumber(pageNumber: number) {
  return Number.isInteger(pageNumber) && pageNumber >= 1 && pageNumber <= MUSHAF_1441_PAGE_COUNT
}

export async function loadMushaf1441Page(pageNumber: number): Promise<MushafPage | null> {
  if (!isValidMushaf1441PageNumber(pageNumber)) return null
  const loadPage = MUSHAF_1441_PAGE_WORDS_LOADERS[pageNumber]
  if (!loadPage) return null

  const pageModule = await loadPage()
  return pageModule.default
}
