// «المتون» (iOS MutoonView): الشاطبية، الدرة وطيبة النشر by book and chapter, with a search over all three. Reads the
// public snapshot `/api/public/v1/mutoon`. Pure; the verses are quotations, shown in a plain Arabic face.
import { normalizeArabic } from '../../../src/lib/arabic'
import { WORK_IDS, type Chapter, type Mutoon, type Verse, type Work, type WorkId } from '../../../src/app/mushaf-1441/mutoon-editor/data'

export type { Chapter, Verse, Work, WorkId }

/** The part of `/api/public/v1/mutoon` this view needs (the marks/symbols are not rendered here). */
export interface MutoonSnapshot {
  seq: number
  document: { mutoon: Mutoon }
}

export interface MutoonHit {
  work: WorkId
  workTitle: string
  chapterTitle: string
  farsh: boolean
  verse: Verse
}

const MAX_HITS = 100

/** The books in their fixed order, chapters in order, verses sorted by number. */
export function mutoonWorks(snapshot: MutoonSnapshot | null): Work[] {
  const works = snapshot?.document?.mutoon?.works ?? []
  return WORK_IDS.flatMap((id) => works.filter((w) => w.work === id)).map((w) => ({
    ...w,
    chapters: w.chapters.map((c) => ({ ...c, verses: [...c.verses].sort((a, b) => a.number - b.number) })),
  }))
}

/** Verses whose text contains `query` (diacritics and alef forms ignored), at most 100. */
export function searchMutoon(snapshot: MutoonSnapshot | null, query: string): MutoonHit[] {
  const needle = normalizeArabic(query).trim()
  if (!needle) return []
  const hits: MutoonHit[] = []
  for (const work of mutoonWorks(snapshot)) {
    for (const chapter of work.chapters) {
      for (const verse of chapter.verses) {
        if (normalizeArabic(verse.lines.join(' ')).includes(needle)) {
          hits.push({ work: work.work, workTitle: work.title, chapterTitle: chapter.title, farsh: chapter.farsh, verse })
          if (hits.length >= MAX_HITS) return hits
        }
      }
    }
  }
  return hits
}
