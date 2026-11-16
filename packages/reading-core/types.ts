/**
 * Pure domain types for Reading and Khatma tracking.
 * Framework-free, zero dependencies, deterministic.
 */

export const MUSHAF_TOTAL_PAGES = 604
export const MUSHAF_TOTAL_AYAHS = 6236
export const MUSHAF_TOTAL_JUZ = 30
export const DWELL_TARGET_SECONDS = 30.0

export type BookmarkType = 'ayah' | 'page'

export interface QuranBookmark {
  readonly id: string
  readonly type: BookmarkType
  readonly surah: number
  readonly ayah: number
  readonly page: number
  readonly note?: string | null
  readonly createdAt: string
}

export interface KhatmaRecord {
  readonly id: string
  readonly khatmaNumber: number
  readonly startedAt: string
  readonly completedAt?: string | null
  readonly status: 'active' | 'completed'
  readonly percentComplete: number
}

export interface ReadingDayRecord {
  readonly dateString: string // YYYY-MM-DD
  readonly ayahsRead: number
  readonly pagesRead: number
  readonly secondsRead: number
  readonly lastReadAt: string
}

export interface SurahReadingProgress {
  readonly surahNumber: number
  readonly surahName: string
  readonly readAyahsCount: number
  readonly totalAyahsCount: number
  readonly firstPage: number
  readonly percentage: number
  readonly isCompleted: boolean
  readonly isStarted: boolean
  readonly remainingAyahsCount: number
}

export function createSurahReadingProgress(
  surahNumber: number,
  surahName: string,
  readAyahsCount: number,
  totalAyahsCount: number,
  firstPage: number,
): SurahReadingProgress {
  const percentage = totalAyahsCount > 0 ? (readAyahsCount / totalAyahsCount) * 100.0 : 0
  const isCompleted = readAyahsCount >= totalAyahsCount && totalAyahsCount > 0
  const isStarted = readAyahsCount > 0 && !isCompleted
  const remainingAyahsCount = Math.max(0, totalAyahsCount - readAyahsCount)
  return {
    surahNumber,
    surahName,
    readAyahsCount,
    totalAyahsCount,
    firstPage,
    percentage,
    isCompleted,
    isStarted,
    remainingAyahsCount,
  }
}

export type SurahProgressFilter = 'all' | 'remaining' | 'completed' | 'started'

export interface WeeklyDayStatus {
  readonly dateString: string
  readonly dayNameAr: string
  readonly dayNumber: string
  readonly isRead: boolean
  readonly isToday: boolean
  readonly readingSeconds: number
  readonly formattedDuration: string
}

export type ReadingProgressTier = 'low' | 'medium' | 'high'
export type DailyHeatLevel = 'none' | 'light' | 'medium' | 'high' | 'deep'
export type ReadingChartMetric = 'ayahs' | 'pages' | 'juz'
export type ReadingChartRange = 7 | 14 | 30

export interface DailyReadingChartPoint {
  readonly date: string
  readonly dateString: string
  readonly ayahs: number
  readonly pages: number
  readonly seconds: number
  readonly juz: number
}

export interface ReadingChartSummary {
  readonly total: number
  readonly average: number
  readonly peak: number
  readonly axisMaximum: number
}

export interface ReadingStatsOverview {
  readonly currentKhatma: KhatmaRecord
  readonly currentStreak: number
  readonly longestStreak: number
  readonly totalReadingDays: number
  readonly completedKhatmasCount: number
  readonly totalAyahsReadInCurrentKhatma: number
  readonly totalQuranAyahs: number
  readonly totalPagesReadInCurrentKhatma: number
  readonly completedSurahsCount: number
  readonly lifetimeAyahsRead: number
  readonly lifetimeReadingSeconds: number
  readonly lifetimeHours: number
  readonly lifetimeMinutes: number
  readonly formattedLifetimeDuration: string
  readonly progressPercentage: number
  readonly remainingPages: number
}
