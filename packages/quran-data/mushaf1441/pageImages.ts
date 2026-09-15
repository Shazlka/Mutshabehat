import { isValidMushaf1441PageNumber } from './pageLoader'

export const MUSHAF_1441_ARCHIVE_IDENTIFIER = 'MushafMadinaHafsGreen1441'
export const MUSHAF_1441_ARCHIVE_LEAF_OFFSET = 2
export const MUSHAF_1441_ARCHIVE_PAGE_WIDTH = 1200

export function getMushaf1441ArchiveLeaf(pageNumber: number) {
  if (!isValidMushaf1441PageNumber(pageNumber)) return null
  return pageNumber + MUSHAF_1441_ARCHIVE_LEAF_OFFSET
}

export function getMushaf1441PageImageUrl(
  pageNumber: number,
  width = MUSHAF_1441_ARCHIVE_PAGE_WIDTH,
) {
  const leafNumber = getMushaf1441ArchiveLeaf(pageNumber)
  if (!leafNumber) return null

  return `https://archive.org/download/${MUSHAF_1441_ARCHIVE_IDENTIFIER}/page/n${leafNumber}_w${width}.jpg`
}
