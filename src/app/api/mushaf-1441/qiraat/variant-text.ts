/**
 * The stored Uthmani text of a farsh variant is meant to be the reading written in the Uthmani script.
 * Entries made in the review editor started with the Hafs word copied into it, and editing «نص الكلمة
 * المقروء به» afterwards changed only the reading text, so the copy stayed behind: the card showed
 * «يعملون» while the editor said «تعملون». A copy that is still exactly the Hafs word, on a reading that
 * is not the Hafs word, is that stale copy and is dropped, so the card falls back to the reading text.
 */
export function consistentUthmaniText(
  hafsText: string | null | undefined,
  readingText: string | null | undefined,
  uthmaniText: string | null | undefined,
): string | undefined {
  const uthmani = uthmaniText?.trim()
  if (!uthmani) return undefined
  const hafs = hafsText?.trim()
  const reading = readingText?.trim()
  if (hafs && reading && uthmani === hafs && reading !== hafs) return undefined
  return uthmani
}
