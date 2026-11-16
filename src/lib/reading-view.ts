/**
 * Pure view-model helpers for Reading Statistics, Khatma, and Bookmarks.
 * Zero DOM dependencies; fully testable under Node.js.
 */

import {
  MUSHAF_TOTAL_AYAHS,
  MUSHAF_TOTAL_PAGES,
  formatArabicDigits,
  type DailyReadingChartPoint,
  type KhatmaRecord,
  type QuranBookmark,
  type ReadingChartMetric,
  type ReadingChartRange,
  type ReadingChartSummary,
  type ReadingDayRecord,
  type ReadingStatsOverview,
  type ReadingStreakSummary,
  type WeeklyDayStatus,
  calculateChartPoints,
  calculateChartSummary,
  classifyDailyHeatLevel,
  classifyReadingProgressTier,
} from '../../packages/reading-core'
import {
  MUSHAF_1441_SURAH_OPTIONS,
  getMushaf1441PageForAyahKey,
  getMushaf1441SurahOption,
} from '../../packages/quran-data/mushaf1441/pageMetadata'
import type { ReadAyahInput } from './storage/reading-db'

export {
  calculateChartPoints,
  calculateChartSummary,
  classifyDailyHeatLevel,
  classifyReadingProgressTier,
  formatArabicDigits,
}

export const ARABIC_WEEKDAYS = [
  'الأحد',
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
] as const

export const ARABIC_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
] as const

/**
 * Converts numbers or Latin digit strings to Arabic-Indic digits (٠-٩).
 */
export function toArabicDigits(value: number | string): string {
  return formatArabicDigits(value)
}

/**
 * Formats a reading duration in seconds into Arabic compact string.
 * e.g. 900s -> "١٥ د", 3600s -> "١ س", 4500s -> "١ س ١٥ د"
 */
export function formatReadingDuration(seconds: number): string {
  if (seconds <= 0) return '—'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    if (minutes > 0) {
      return `${toArabicDigits(hours)} س ${toArabicDigits(minutes)} د`
    }
    return `${toArabicDigits(hours)} س`
  }
  return `${toArabicDigits(Math.max(1, minutes))} د`
}

/**
 * Formats lifetime reading duration for overview card.
 * e.g. 4500s -> "١ س و ١٥ د", 3600s -> "١ ساعة", 1200s -> "٢٠ دقيقة"
 */
export function formatLifetimeDuration(seconds: number): string {
  if (seconds <= 0) return `٠ دقيقة`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    if (minutes > 0) {
      return `${toArabicDigits(hours)} س و ${toArabicDigits(minutes)} د`
    }
    return `${toArabicDigits(hours)} ساعة`
  }
  return `${toArabicDigits(Math.max(1, minutes))} دقيقة`
}

/**
 * Calculates days elapsed for a khatma (1-indexed, minimum 1).
 */
export function calculateKhatmaDaysElapsed(
  startedAt: string,
  completedAt?: string | null,
  asOfDate: Date | string = new Date(),
): number {
  const start = new Date(startedAt).getTime()
  const end = completedAt
    ? new Date(completedAt).getTime()
    : asOfDate instanceof Date
      ? asOfDate.getTime()
      : new Date(asOfDate).getTime()
  if (Number.isNaN(start) || Number.isNaN(end)) return 1
  const diffDays = Math.floor((end - start) / 86_400_000)
  return Math.max(1, diffDays + 1)
}

function formatDateToYMD(date: Date, timeZone = 'UTC'): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(date)
}

function addDaysYMD(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d + days))
  const year = utc.getUTCFullYear()
  const month = String(utc.getUTCMonth() + 1).padStart(2, '0')
  const day = String(utc.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Computes 7-day status pills ending at asOfDate.
 */
export function computeWeeklyDays(
  readingDays: readonly ReadingDayRecord[],
  asOfDate: Date | string = new Date(),
  timeZone = 'UTC',
): WeeklyDayStatus[] {
  const asOf = asOfDate instanceof Date ? asOfDate : new Date(asOfDate)
  const todayStr = formatDateToYMD(asOf, timeZone)

  const readingDayMap = new Map<string, ReadingDayRecord>()
  for (const r of readingDays) {
    if (!readingDayMap.has(r.dateString)) {
      readingDayMap.set(r.dateString, r)
    }
  }

  const result: WeeklyDayStatus[] = []
  for (let offset = 6; offset >= 0; offset -= 1) {
    const dateStr = addDaysYMD(todayStr, -offset)
    const [y, m, d] = dateStr.split('-').map(Number)
    const dayDate = new Date(Date.UTC(y, m - 1, d))
    const weekdayIdx = dayDate.getUTCDay()
    const dayNameAr = ARABIC_WEEKDAYS[weekdayIdx]
    const dayNumber = String(d)

    const rec = readingDayMap.get(dateStr)
    const readingSeconds = rec?.secondsRead ?? 0
    const isRead = Boolean(rec && (rec.secondsRead > 0 || rec.ayahsRead > 0 || rec.pagesRead > 0))
    const isToday = dateStr === todayStr

    result.push({
      dateString: dateStr,
      dayNameAr,
      dayNumber,
      isRead,
      isToday,
      readingSeconds,
      formattedDuration: isRead ? formatReadingDuration(readingSeconds) : '—',
    })
  }

  return result
}

/**
 * Formats date into readable Arabic.
 */
export function formatArabicDate(
  dateValue: Date | string | number,
  options: { includeWeekday?: boolean; short?: boolean } = {},
): string {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue)
  if (Number.isNaN(date.getTime())) return String(dateValue)

  const day = date.getDate()
  const month = date.getMonth()
  const year = date.getFullYear()
  const weekday = ARABIC_WEEKDAYS[date.getDay()]
  const monthName = ARABIC_MONTHS[month] ?? ''

  if (options.short) {
    return `${day} ${monthName}`
  }

  if (options.includeWeekday) {
    return `${weekday}، ${day} ${monthName}`
  }

  return `${day} ${monthName} ${year}`
}

/**
 * Filters bookmarks by type and query.
 */
export function filterBookmarks(
  bookmarks: readonly QuranBookmark[],
  filter: 'all' | 'ayah' | 'page',
  query: string,
  surahNames?: Record<number, string>,
): QuranBookmark[] {
  const cleanQ = query.trim().toLowerCase()
  return bookmarks.filter((b) => {
    if (filter !== 'all' && b.type !== filter) return false
    if (!cleanQ) return true

    const surahName = (
      surahNames?.[b.surah] ??
      getMushaf1441SurahOption(b.surah)?.name ??
      ''
    ).toLowerCase()
    const note = (b.note ?? '').toLowerCase()
    const surahNum = String(b.surah)
    const ayahNum = String(b.ayah)
    const pageNum = String(b.page)

    return (
      surahName.includes(cleanQ) ||
      note.includes(cleanQ) ||
      surahNum === cleanQ ||
      ayahNum === cleanQ ||
      pageNum === cleanQ
    )
  })
}

let ALL_QURAN_AYAHS_CACHE: ReadAyahInput[] | null = null

export function getAllQuranAyahs(): ReadAyahInput[] {
  if (ALL_QURAN_AYAHS_CACHE) return ALL_QURAN_AYAHS_CACHE
  const result: ReadAyahInput[] = []
  for (const surah of MUSHAF_1441_SURAH_OPTIONS) {
    for (let a = 1; a <= surah.ayahCount; a += 1) {
      const page = getMushaf1441PageForAyahKey(`${surah.surahNumber}:${a}`) ?? surah.firstPage ?? 1
      result.push({ surah: surah.surahNumber, ayah: a, page })
    }
  }
  ALL_QURAN_AYAHS_CACHE = result
  return result
}

export function getAyahsForSurah(surahNumber: number): ReadAyahInput[] {
  return getAllQuranAyahs().filter((item) => item.surah === surahNumber)
}

export function getAyahsForPageRange(startPage: number, endPage: number): ReadAyahInput[] {
  const minP = Math.min(startPage, endPage)
  const maxP = Math.max(startPage, endPage)
  return getAllQuranAyahs().filter((item) => item.page >= minP && item.page <= maxP)
}

export function getAyahsForAyahRange(
  fromSurah: number,
  fromAyah: number,
  toSurah: number,
  toAyah: number,
): ReadAyahInput[] {
  const all = getAllQuranAyahs()
  const startIdx = all.findIndex((item) => item.surah === fromSurah && item.ayah === fromAyah)
  const endIdx = all.findIndex((item) => item.surah === toSurah && item.ayah === toAyah)
  if (startIdx === -1 || endIdx === -1) return []
  const [first, last] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx]
  return all.slice(first, last + 1)
}

/**
 * Builds the ReadingStatsOverview object mirroring iOS ReadingStatsOverview.
 */
export function buildReadingStatsOverview(params: {
  activeKhatma: KhatmaRecord | null
  khatmas: readonly KhatmaRecord[]
  readingDays: readonly ReadingDayRecord[]
  streaks: ReadingStreakSummary
  readAyahsCount?: number
  pagesReadCount?: number
}): ReadingStatsOverview {
  const currentKhatma: KhatmaRecord = params.activeKhatma ?? {
    id: 'khatma-1',
    khatmaNumber: 1,
    startedAt: new Date().toISOString(),
    completedAt: null,
    status: 'active',
    percentComplete: 0,
  }

  const completedKhatmasCount = params.khatmas.filter((k) => k.status === 'completed').length

  const lifetimeReadingSeconds = params.readingDays.reduce(
    (acc, d) => acc + (d.secondsRead ?? 0),
    0,
  )
  const lifetimeAyahsRead = params.readingDays.reduce((acc, d) => acc + (d.ayahsRead ?? 0), 0)

  const totalPagesReadInCurrentKhatma =
    typeof params.pagesReadCount === 'number'
      ? params.pagesReadCount
      : Math.min(
          MUSHAF_TOTAL_PAGES,
          Math.round((currentKhatma.percentComplete / 100) * MUSHAF_TOTAL_PAGES),
        )

  const totalAyahsReadInCurrentKhatma =
    typeof params.readAyahsCount === 'number'
      ? params.readAyahsCount
      : Math.min(
          MUSHAF_TOTAL_AYAHS,
          Math.round((currentKhatma.percentComplete / 100) * MUSHAF_TOTAL_AYAHS),
        )

  const lifetimeHours = Math.floor(lifetimeReadingSeconds / 3600)
  const lifetimeMinutes = Math.floor((lifetimeReadingSeconds % 3600) / 60)
  const formattedLifetimeDuration = formatLifetimeDuration(lifetimeReadingSeconds)

  const progressPercentage = currentKhatma.percentComplete
  const remainingPages = Math.max(0, MUSHAF_TOTAL_PAGES - totalPagesReadInCurrentKhatma)

  return {
    currentKhatma,
    currentStreak: params.streaks.currentStreak,
    longestStreak: params.streaks.longestStreak,
    totalReadingDays: params.streaks.totalReadingDays,
    completedKhatmasCount,
    totalAyahsReadInCurrentKhatma,
    totalQuranAyahs: MUSHAF_TOTAL_AYAHS,
    totalPagesReadInCurrentKhatma,
    completedSurahsCount: 0,
    lifetimeAyahsRead,
    lifetimeReadingSeconds,
    lifetimeHours,
    lifetimeMinutes,
    formattedLifetimeDuration,
    progressPercentage,
    remainingPages,
  }
}

let ayahsDataCache: Record<string, Record<string, string>> | null = null
let ayahsFetchPromise: Promise<Record<string, Record<string, string>>> | null = null

/**
 * Lazy fetches ayah text preview from /quran/ayahs.json.
 */
export async function fetchAyahPreviewText(surah: number, ayah: number): Promise<string | null> {
  if (ayahsDataCache) {
    return ayahsDataCache[String(surah)]?.[String(ayah)] ?? null
  }
  if (typeof window === 'undefined') return null
  if (!ayahsFetchPromise) {
    ayahsFetchPromise = fetch('/quran/ayahs.json')
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => {
        ayahsDataCache = data as Record<string, Record<string, string>>
        return ayahsDataCache
      })
      .catch(() => ({}))
  }
  const cache = await ayahsFetchPromise
  return cache[String(surah)]?.[String(ayah)] ?? null
}

export function truncateAyahWords(text: string, maxWords = 10): string {
  const words = text.trim().split(/\s+/)
  if (words.length <= maxWords) return text
  return `${words.slice(0, maxWords).join(' ')}...`
}

export type {
  DailyReadingChartPoint,
  KhatmaRecord,
  QuranBookmark,
  ReadingChartMetric,
  ReadingChartRange,
  ReadingChartSummary,
  ReadingDayRecord,
  ReadingStatsOverview,
  ReadingStreakSummary,
  WeeklyDayStatus,
}
