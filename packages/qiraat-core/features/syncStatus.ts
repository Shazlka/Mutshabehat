// Port of apps/ios Sources/Qiraat/QiraatSyncStatusView.swift (status and error report). What the reader can say about a
// page's Qiraat data: when the web server last confirmed it. Pure.
export type SyncOutcome = 'updated' | 'unchanged' | 'failed' | 'skipped'
export type SyncKind = 'current' | 'confirmed' | 'localCopy'

export interface SyncStatus {
  kind: SyncKind
  offline: boolean
  title: string
  /** A glyph per state, so colour is never the only cue. */
  symbol: string
}

/** Confirmations this recent still read as «الآن». */
export const CURRENT_WINDOW_SECONDS = 60


function arabicCount(n: number, one: string, two: string, few: string, many: string): string {
  if (n === 1) return one
  if (n === 2) return two
  if (n >= 3 && n <= 10) return `${n} ${few}`
  return `${n} ${many}`
}

/** «قبل دقيقة», «قبل ٥ دقائق», «قبل ساعتين», «قبل ٣ أيام» (minutes, hours, days; Arabic plurals). */
export function agoText(elapsedSeconds: number): string {
  const minutes = Math.floor(elapsedSeconds / 60)
  if (minutes < 60) return `قبل ${arabicCount(minutes, 'دقيقة', 'دقيقتين', 'دقائق', 'دقيقة')}`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `قبل ${arabicCount(hours, 'ساعة', 'ساعتين', 'ساعات', 'ساعة')}`
  return `قبل ${arabicCount(Math.floor(hours / 24), 'يوم', 'يومين', 'أيام', 'يومًا')}`
}

/**
 * `updated` and `unchanged` mean the server answered, so the page is confirmed at `lastSuccess` (or now when the
 * time is unknown). `failed`, `skipped` and no check yet keep the last confirmed time; a page never confirmed on
 * this device is the bundled copy. Times are milliseconds.
 */
export function syncStatus(input: { outcome: SyncOutcome | null; lastSuccess: number | null; now: number; offline: boolean }): SyncStatus {
  const { outcome, lastSuccess, now, offline } = input
  const confirmedAt = outcome === 'updated' || outcome === 'unchanged' ? (lastSuccess ?? now) : lastSuccess
  if (confirmedAt === null) {
    return { kind: 'localCopy', offline, title: 'نسخة محلية', symbol: offline ? '⌀' : '▣' }
  }
  const elapsed = Math.max(0, (now - confirmedAt) / 1000)
  if (elapsed < CURRENT_WINDOW_SECONDS) return { kind: 'current', offline, title: 'محدّث الآن', symbol: offline ? '⌀' : '✓' }
  return { kind: 'confirmed', offline, title: `محدّث ${agoText(elapsed)}`, symbol: offline ? '⌀' : '◷' }
}

/** The text shared when a Qiraat entry looks wrong. Only facts the page already holds; nothing is sent anywhere. */
export function errorReportText(r: { page: number; surah: number; ayah: number; token: number; word: string; variantIds: string[]; rulingIds: string[] }): string {
  const lines = ['بلاغ عن خطأ في القراءات', `الصفحة: ${r.page}`, `الموضع: ${r.surah}:${r.ayah}:${r.token}`, `الكلمة: ${r.word}`]
  if (r.variantIds.length > 0) lines.push(`الوجوه: ${r.variantIds.join('، ')}`)
  if (r.rulingIds.length > 0) lines.push(`الأحكام: ${r.rulingIds.join('، ')}`)
  return lines.join('\n')
}
