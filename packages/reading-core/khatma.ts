import {
  MUSHAF_TOTAL_AYAHS,
  MUSHAF_TOTAL_JUZ,
  MUSHAF_TOTAL_PAGES,
  type DailyHeatLevel,
  type DailyReadingChartPoint,
  type ReadingChartMetric,
  type ReadingChartRange,
  type ReadingChartSummary,
  type ReadingDayRecord,
  type ReadingProgressTier,
} from './types'

export const PAGES_PER_JUZ = MUSHAF_TOTAL_PAGES / MUSHAF_TOTAL_JUZ
export const AYAHS_PER_JUZ = MUSHAF_TOTAL_AYAHS / MUSHAF_TOTAL_JUZ

/**
 * Calculates Khatma completion percentage (0...100).
 *
 * Rules:
 * - Khatma progress is counted in pages (pagesRead / 604 * 100).
 * - It reaches 100% ONLY when every ayah in the Quran has been read (`allAyahsRead === true`).
 * - Before that, even if every page has been touched, the progress caps at 99%.
 */
export function calculateKhatmaPercent(pagesRead: number, allAyahsRead: boolean): number {
  if (allAyahsRead) return 100
  const pages = Math.min(Math.max(pagesRead, 0), MUSHAF_TOTAL_PAGES)
  return Math.min((pages / MUSHAF_TOTAL_PAGES) * 100, 99)
}

/**
 * Classifies Khatma percentage into visual tiers.
 */
export function classifyReadingProgressTier(
  percentage: number,
): { tier: ReadingProgressTier; colorName: string } {
  if (percentage >= 75.0) {
    return { tier: 'high', colorName: 'progress' }
  }
  if (percentage >= 34.0) {
    return { tier: 'medium', colorName: 'caution' }
  }
  return { tier: 'low', colorName: 'danger' }
}

/**
 * Classifies daily reading seconds into heat map intensity levels.
 */
export function classifyDailyHeatLevel(
  seconds: number,
  isRead: boolean,
): { level: DailyHeatLevel; fillColorName: string; textColorName: string } {
  if (!isRead) {
    return { level: 'none', fillColorName: 'clear', textColorName: 'secondary' }
  }
  if (seconds <= 600) {
    return { level: 'light', fillColorName: 'progress.light', textColorName: 'primary' }
  }
  if (seconds <= 1800) {
    return { level: 'medium', fillColorName: 'progress.medium', textColorName: 'white' }
  }
  if (seconds <= 3600) {
    return { level: 'high', fillColorName: 'progress', textColorName: 'white' }
  }
  return { level: 'deep', fillColorName: 'progressFill', textColorName: 'white' }
}

function formatDateString(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(date)
}

function addCalendarDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d + days))
  const year = utc.getUTCFullYear()
  const month = String(utc.getUTCMonth() + 1).padStart(2, '0')
  const day = String(utc.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Generates continuous daily chart points for the specified range ending at today.
 * Days without reading records are filled with zeros.
 */
export function calculateChartPoints(
  records: readonly ReadingDayRecord[],
  rangeDays: ReadingChartRange,
  today: Date | string = new Date(),
  timeZone = 'UTC',
): DailyReadingChartPoint[] {
  const todayDate = today instanceof Date ? today : new Date(today)
  const todayStr = formatDateString(todayDate, timeZone)

  const recordsByDay = new Map<string, ReadingDayRecord>()
  for (const r of records) {
    if (!recordsByDay.has(r.dateString)) {
      recordsByDay.set(r.dateString, r)
    }
  }

  const points: DailyReadingChartPoint[] = []
  for (let daysAgo = rangeDays - 1; daysAgo >= 0; daysAgo -= 1) {
    const dateStr = addCalendarDays(todayStr, -daysAgo)
    const rec = recordsByDay.get(dateStr)
    const ayahs = rec?.ayahsRead ?? 0
    const pages = rec?.pagesRead ?? 0
    const seconds = rec?.secondsRead ?? 0

    let juz = 0
    if (pages > 0) {
      juz = pages / PAGES_PER_JUZ
    } else if (ayahs > 0) {
      juz = ayahs / AYAHS_PER_JUZ
    }

    const [y, m, d] = dateStr.split('-').map(Number)
    const isoDate = new Date(Date.UTC(y, m - 1, d)).toISOString()

    points.push({
      date: isoDate,
      dateString: dateStr,
      ayahs,
      pages,
      seconds,
      juz,
    })
  }

  return points
}

export function getChartMetricValue(
  point: DailyReadingChartPoint,
  metric: ReadingChartMetric,
): number {
  switch (metric) {
    case 'ayahs':
      return point.ayahs
    case 'pages':
      return point.pages
    case 'juz':
      return point.juz
  }
}

/**
 * Calculates summary metrics for chart points (total, average, peak, axisMaximum).
 */
export function calculateChartSummary(
  points: readonly DailyReadingChartPoint[],
  metric: ReadingChartMetric,
): ReadingChartSummary {
  const values = points.map((p) => getChartMetricValue(p, metric))
  const total = values.reduce((acc, v) => acc + v, 0)
  const average = values.length === 0 ? 0 : total / values.length
  const peak = values.length === 0 ? 0 : Math.max(...values)

  let axisMaximum: number
  if (peak <= 0) {
    switch (metric) {
      case 'ayahs':
        axisMaximum = 50
        break
      case 'pages':
        axisMaximum = 10
        break
      case 'juz':
        axisMaximum = 1
        break
    }
  } else {
    switch (metric) {
      case 'juz':
        axisMaximum = Math.max(1, Math.ceil(peak * 1.15 * 2) / 2)
        break
      case 'ayahs':
      case 'pages':
        axisMaximum = Math.max(5, Math.ceil(peak * 1.15))
        break
    }
  }

  return { total, average, peak, axisMaximum }
}

export function formatArabicDigits(text: string | number): string {
  const str = String(text)
  let result = ''
  for (const char of str) {
    if (char >= '0' && char <= '9') {
      result += String.fromCharCode(char.charCodeAt(0) - 0x30 + 0x0660)
    } else if (char === '.') {
      result += '٫'
    } else {
      result += char
    }
  }
  return result
}

export function formatChartMetricNumber(value: number, isArabic: boolean): string {
  const rounded = Math.round(value * 10) / 10
  const isWhole = rounded === Math.floor(rounded)
  const rawText = isWhole ? String(Math.floor(rounded)) : rounded.toFixed(1)
  return isArabic ? formatArabicDigits(rawText) : rawText
}

export function getChartMetricUnit(metric: ReadingChartMetric, isArabic: boolean): string {
  switch (metric) {
    case 'ayahs':
      return isArabic ? 'آية' : 'ayahs'
    case 'pages':
      return isArabic ? 'صفحة' : 'pages'
    case 'juz':
      return isArabic ? 'جزء' : 'juz’'
  }
}

export function formatChartMetricValue(
  value: number,
  metric: ReadingChartMetric,
  isArabic: boolean,
): string {
  return `${formatChartMetricNumber(value, isArabic)} ${getChartMetricUnit(metric, isArabic)}`
}

export function getChartMetricTitle(metric: ReadingChartMetric, isArabic: boolean): string {
  switch (metric) {
    case 'ayahs':
      return isArabic ? 'الآيات' : 'Ayahs'
    case 'pages':
      return isArabic ? 'الصفحات' : 'Pages'
    case 'juz':
      return isArabic ? 'الأجزاء' : 'Juz’'
  }
}

export function getChartRangeTitle(range: ReadingChartRange, isArabic: boolean): string {
  switch (range) {
    case 7:
      return isArabic ? '٧ أيام' : '7 Days'
    case 14:
      return isArabic ? '١٤ يومًا' : '14 Days'
    case 30:
      return isArabic ? '٣٠ يومًا' : '30 Days'
  }
}
