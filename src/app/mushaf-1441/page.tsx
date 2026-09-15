import type { Metadata } from 'next'
import Mushaf1441Viewer from './_components/Mushaf1441Viewer'
import { loadMushaf1441Page } from '../../../packages/quran-data/mushaf1441/pageLoader'
import {
  getMushaf1441PageMetadata,
  MUSHAF_1441_SURAH_OPTIONS,
} from '../../../packages/quran-data/mushaf1441/pageMetadata'

export const metadata: Metadata = {
  title: 'مصحف المدينة ١٤٤١ — Preview',
  description: 'Standalone preview module for future Mushaf Al-Madinah 1441 page rendering.',
}

export default async function Mushaf1441Page() {
  const initialPage = await loadMushaf1441Page(1)
  const initialPageMetadata = getMushaf1441PageMetadata(1)

  if (!initialPage) {
    throw new Error('Missing Mushaf 1441 page-word fixture')
  }

  if (!initialPageMetadata) {
    throw new Error('Missing Mushaf 1441 page metadata fixture')
  }

  return (
    <Mushaf1441Viewer
      initialPage={initialPage}
      initialPageMetadata={initialPageMetadata}
      surahOptions={MUSHAF_1441_SURAH_OPTIONS}
    />
  )
}
