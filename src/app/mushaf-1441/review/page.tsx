import type { Metadata } from 'next'
import { renderMushafPage } from '../page'

export const metadata: Metadata = { title: 'مراجعة القراءات — مصحف ١٤٤١' }

export default async function MushafReviewPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  return renderMushafPage(searchParams, true)
}
