import type { MushafAnnotation } from '../../../../../packages/quran-data/mushaf1441/types'
import type { IndexBookmark } from '../../_features/index/IndexSheet'

export function indexBookmarksFromAnnotations(
  annotations: ReadonlyArray<MushafAnnotation>,
): IndexBookmark[] {
  return annotations.flatMap((annotation) => {
    if (annotation.annotationType !== 'bookmark') return []
    const [surahPart, ayahPart] = annotation.ayahKey.split(':')
    const surah = Number(surahPart)
    const ayah = Number(ayahPart)
    if (!Number.isInteger(surah) || !Number.isInteger(ayah)) return []

    return [{
      id: annotation.id,
      type: 'ayah' as const,
      surah,
      ayah,
      page: annotation.pageNumber,
      note: annotation.title || annotation.body || undefined,
      createdAt: annotation.createdAt,
    }]
  })
}
