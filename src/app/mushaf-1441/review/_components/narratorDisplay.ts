// Pure, dependency-free helpers that turn a list of narrators recorded on a face into a
// reader-colored, narrator-collapsed display: when BOTH of a reader's two narrators are present
// they collapse into one item naming the reader (his own color), and when only one of the two is
// present it is shown by its own name but still colored with its parent reader's color -- this
// codebase only assigns colors to readers (`CANONICAL_READERS`), never to individual narrators.
// Used by facesSummary.ts, ReviewEditorPane.tsx and MobileReviewEditorView.tsx so every "recorded
// faces" summary/list in the review editor names/colors readers the same way.

import { CANONICAL_READERS } from './ReaderNarratorSelector'

export type NarratorDisplayItem = { key: string; label: string; color: string }

type NarratorLike = { id: string; nameAr: string }

export function describeNarratorGroup(narrators: NarratorLike[]): NarratorDisplayItem[] {
  const items: NarratorDisplayItem[] = []
  const emittedReaderIds = new Set<string>()

  for (const narrator of narrators) {
    const reader = CANONICAL_READERS.find((r) => r.narrators.some((n) => n.id === narrator.id))
    if (!reader) {
      // Defensive fallback -- should not normally happen; an unrecognized id is still shown
      // rather than silently dropped.
      items.push({ key: narrator.id, label: narrator.nameAr || narrator.id, color: '#888' })
      continue
    }

    if (emittedReaderIds.has(reader.id)) continue

    const bothPresent = reader.narrators.every((n) => narrators.some((input) => input.id === n.id))
    if (bothPresent) {
      emittedReaderIds.add(reader.id)
      items.push({ key: reader.id, label: reader.nameAr, color: reader.color })
    } else {
      items.push({ key: narrator.id, label: narrator.nameAr, color: reader.color })
    }
  }

  return items
}

export function describeNarratorGroupText(narrators: NarratorLike[]): string {
  return describeNarratorGroup(narrators)
    .map((i) => i.label)
    .join('، ')
}
