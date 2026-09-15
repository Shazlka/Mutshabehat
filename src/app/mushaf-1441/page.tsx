import type { Metadata } from 'next'
import Mushaf1441Viewer from './_components/Mushaf1441Viewer'
import {
  isValidMushaf1441PageNumber,
  loadMushaf1441Page,
} from '../../../packages/quran-data/mushaf1441/pageLoader'
import { loadMushaf1441PageDecorations } from '../../../packages/quran-data/mushaf1441/pageDecorations'
import {
  getMushaf1441PageMetadata,
  MUSHAF_1441_SURAH_OPTIONS,
} from '../../../packages/quran-data/mushaf1441/pageMetadata'

export const metadata: Metadata = {
  title: 'مصحف المدينة ١٤٤١',
  description: 'Mushaf Al-Madinah 1441 page reader with highlights, notes and mutashabihat links.',
}

type SP = Promise<{ page?: string }>

export default async function Mushaf1441Page({ searchParams }: { searchParams: SP }) {
  const { page } = await searchParams
  const requestedPage = Number.parseInt(page ?? '1', 10)
  const initialPageNumber = isValidMushaf1441PageNumber(requestedPage) ? requestedPage : 1

  const [initialPage, lineDecorations] = await Promise.all([
    loadMushaf1441Page(initialPageNumber),
    loadMushaf1441PageDecorations(initialPageNumber),
  ])
  const initialPageMetadata = getMushaf1441PageMetadata(initialPageNumber)

  if (!initialPage) {
    throw new Error('Missing Mushaf 1441 page-word fixture')
  }

  if (!initialPageMetadata) {
    throw new Error('Missing Mushaf 1441 page metadata fixture')
  }

  return (
    <Mushaf1441Viewer
      initialPage={{ ...initialPage, lineDecorations }}
      initialPageMetadata={initialPageMetadata}
      surahOptions={MUSHAF_1441_SURAH_OPTIONS}
    />
  )
}
