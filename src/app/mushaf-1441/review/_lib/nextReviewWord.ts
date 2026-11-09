// Which word «اعتماد» (and mobile «حفظ والتالي») moves to next. Pure so it can be tested.
import type { ReviewPage, ReviewRow } from './types'
import type { WordMeta } from '../_components/ReviewEditorPane'
import { approvalKind, filterReviewRows, type CategoryFilter, type KindFilter, type StatusFilter } from '../_components/statusMeta'

// A face is done only once a person approved it. «معتمد آليًا» (auto-approved by the import) still
// has to be approved by hand, so it counts as still to review, like unreviewed and flagged ones.
export const needsManualApproval = (r: ReviewRow) => !r.deleted && approvalKind(r) !== 'manual'

export type ReviewFilters = { status: StatusFilter; kind: KindFilter; category: CategoryFilter }

// `filters` are the ones the reviewer has on (status, فرش/أصول, أصول category): the next word is
// always one that has a row they can see under them. With no filter on, any word may follow.
export function findNextReviewWord(
  page: ReviewPage | null,
  currentWordKey: string | null,
  filters?: ReviewFilters
): { key: string; meta: WordMeta } | null {
  if (!page || page.words.length === 0) return null

  const filtered = !!filters && (filters.status !== 'all' || filters.kind !== 'all')
  const visibleRows = filters
    ? filterReviewRows(page.rows, filters.status, filters.kind, filters.category)
    : page.rows.filter((r) => !r.deleted)

  // 1. Build a set of keys for rows needing review (unreviewed or flagged)
  const rowsNeedingReview = visibleRows.filter(needsManualApproval)

  const wordsNeedingReview = page.words.filter((w) =>
    rowsNeedingReview.some((r) => r.startKey <= w.key && w.key <= r.endKey)
  )

  if (wordsNeedingReview.length > 0) {
    if (currentWordKey) {
      const after = wordsNeedingReview.find((w) => w.key > currentWordKey)
      if (after) {
        return {
          key: after.key,
          meta: { surah: after.surah, ayah: after.ayah, word: after.word, text: after.text, page: page.page },
        }
      }
      const first = wordsNeedingReview[0]
      if (first.key !== currentWordKey) {
        return {
          key: first.key,
          meta: { surah: first.surah, ayah: first.ayah, word: first.word, text: first.text, page: page.page },
        }
      }
    } else {
      const first = wordsNeedingReview[0]
      return {
        key: first.key,
        meta: { surah: first.surah, ayah: first.ayah, word: first.word, text: first.text, page: page.page },
      }
    }
  }

  // 2. Fallback: find any word with existing variants
  const activeRows = visibleRows.filter((r) => !r.deleted)
  const wordsWithVariants = page.words.filter((w) =>
    activeRows.some((r) => r.startKey <= w.key && w.key <= r.endKey)
  )
  if (wordsWithVariants.length > 0) {
    if (currentWordKey) {
      const after = wordsWithVariants.find((w) => w.key > currentWordKey)
      if (after) {
        return {
          key: after.key,
          meta: { surah: after.surah, ayah: after.ayah, word: after.word, text: after.text, page: page.page },
        }
      }
    }
    const first = wordsWithVariants[0]
    if (first.key !== currentWordKey) {
      return {
        key: first.key,
        meta: { surah: first.surah, ayah: first.ayah, word: first.word, text: first.text, page: page.page },
      }
    }
  }

  // 3. Fallback: next word in sequence — only when no filter is on, since an arbitrary word would
  // fall outside what the reviewer asked to see.
  if (currentWordKey && !filtered) {
    const currentIndex = page.words.findIndex((w) => w.key === currentWordKey)
    if (currentIndex >= 0 && currentIndex < page.words.length - 1) {
      const nextWord = page.words[currentIndex + 1]
      return {
        key: nextWord.key,
        meta: { surah: nextWord.surah, ayah: nextWord.ayah, word: nextWord.word, text: nextWord.text, page: page.page },
      }
    }
  }

  return null
}

// The next وجه of the SAME word that still needs a manual approval (unreviewed, flagged or
// auto-approved), among the faces
// the filter shows: the ones after the approved face first, then any before it. null when every
// other face of the word is done, which is the cue to move on to the next word. Faces still being
// saved (placeholder ids) are not offered.
export function findNextReviewFace(
  page: ReviewPage | null,
  wordKey: string | null,
  approvedEntryId: string,
  filters?: ReviewFilters,
  isPending: (row: ReviewRow) => boolean = () => false
): ReviewRow | null {
  if (!page || !wordKey) return null
  const covering = page.rows.filter((r) => !r.deleted && r.startKey <= wordKey && wordKey <= r.endKey)
  const faces = filters ? filterReviewRows(covering, filters.status, filters.kind, filters.category) : covering
  const at = faces.findIndex((r) => r.entryId === approvedEntryId)
  const ordered = at >= 0 ? [...faces.slice(at + 1), ...faces.slice(0, at)] : faces
  return (
    ordered.find(
      (r) =>
        r.entryId !== approvedEntryId &&
        !isPending(r) &&
        needsManualApproval(r)
    ) ?? null
  )
}
