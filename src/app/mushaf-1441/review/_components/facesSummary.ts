// Pure, dependency-free helpers for a live one-line summary of the faces/entries currently
// recorded for a selected Mushaf word ("٣. الأوجه المسجلة"). Rendered above that section in
// both the desktop editor pane (ReviewEditorPane.tsx) and the mobile editor view
// (MobileReviewEditorView.tsx). Never fetches anything -- pure derived render over
// `activeRowsForWord`, so it updates immediately after every add/edit/delete.

import type { ReviewRow } from '../_lib/types'

function labelForRow(row: ReviewRow): string {
  if (row.kind === 'usul') {
    return row.categoryNameAr?.trim() || 'أصل'
  }
  return row.readingText?.trim() || row.hafsText?.trim() || 'فرش'
}

function narratorNamesForRow(row: ReviewRow): string {
  return row.narrators
    .map((n) => n.nameAr)
    .filter(Boolean)
    .join('، ')
}

/**
 * "٣ أوجه: تحقيق (نافع)، تسهيل (أبو عمرو، ورش)، إدغام كبير مع الكلمة التالية"
 */
export function summarizeActiveRows(rows: ReviewRow[]): string {
  const active = rows.filter((r) => !r.deleted)
  if (active.length === 0) return ''

  const parts = active.map((row) => {
    const label = labelForRow(row)
    const names = narratorNamesForRow(row)
    const spansNextWord = row.endKey !== row.startKey
    const spanNote = spansNextWord ? ' مع الكلمة التالية' : ''
    return names ? `${label} (${names})${spanNote}` : `${label}${spanNote}`
  })

  const count = active.length
  const noun = count === 1 ? 'وجه واحد' : count === 2 ? 'وجهان' : `${count} أوجه`
  return `${noun}: ${parts.join('، ')}`
}
