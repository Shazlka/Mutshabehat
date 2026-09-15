import { MUSHAF_1441_LINES_PER_PAGE, MUSHAF_1441_PAGE_COUNT } from './constants'
import { loadMushaf1441Page } from './pageLoader'
import type { MushafLineDecoration, MushafPage } from './types'

// A surah's ornamental header band and its basmala occupy the empty line slots directly
// above the surah's first line. When a surah starts on line 1 or 2 of a page, those slots
// are the LAST lines of the previous page, so the decorations of page N depend on the
// surah starts of pages N and N+1.
export async function loadMushaf1441PageDecorations(pageNumber: number): Promise<Record<number, MushafLineDecoration>> {
  const [page, nextPage] = await Promise.all([
    loadMushaf1441Page(pageNumber),
    pageNumber < MUSHAF_1441_PAGE_COUNT ? loadMushaf1441Page(pageNumber + 1) : Promise.resolve(null),
  ])
  if (!page) return {}
  return computeMushaf1441PageDecorations(page, nextPage)
}

export function computeMushaf1441PageDecorations(page: MushafPage, nextPage: MushafPage | null) {
  const pages = new Map<number, MushafPage>([[page.pageNumber, page]])
  if (nextPage) pages.set(nextPage.pageNumber, nextPage)

  const decorations: Record<number, MushafLineDecoration> = {}

  for (const source of [page, nextPage]) {
    if (!source) continue
    for (const line of source.lines) {
      const first = line.words[0]
      if (!first || first.ayahNumber !== 1 || first.wordIndexInAyah !== 1) continue

      // Nearest slot first. Al-Fatihah (1) and At-Tawbah (9) have no basmala line.
      const slots: Array<'basmala' | 'surahHeader'> =
        first.surahNumber === 1 || first.surahNumber === 9 ? ['surahHeader'] : ['basmala', 'surahHeader']

      let slotPage = source.pageNumber
      let slotLine = line.lineNumber - 1
      for (const kind of slots) {
        if (slotLine < 1) {
          slotPage -= 1
          slotLine = MUSHAF_1441_LINES_PER_PAGE
        }
        const slot = pages.get(slotPage)?.lines.find((candidate) => candidate.lineNumber === slotLine)
        if (!slot || slot.words.length > 0) break
        if (slotPage === page.pageNumber) {
          decorations[slotLine] = {
            ...decorations[slotLine],
            ...(kind === 'surahHeader' ? { surahHeader: first.surahNumber } : { basmala: true }),
          }
        }
        slotLine -= 1
      }
    }
  }

  return decorations
}
