export interface ReadingStreakSummary {
  readonly currentStreak: number
  readonly longestStreak: number
  readonly totalReadingDays: number
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

function daysDiff(dateStr1: string, dateStr2: string): number {
  const [y1, m1, d1] = dateStr1.split('-').map(Number)
  const [y2, m2, d2] = dateStr2.split('-').map(Number)
  const utc1 = Date.UTC(y1, m1 - 1, d1)
  const utc2 = Date.UTC(y2, m2 - 1, d2)
  return Math.round((utc2 - utc1) / 86_400_000)
}

/**
 * Calculates current streak, longest streak, and total reading days.
 *
 * Rules:
 * - Streaks are counted over distinct calendar days (YYYY-MM-DD).
 * - Current streak remains active if the last recorded reading day was today or yesterday.
 * - If more than 1 day has passed since last reading, current streak resets to 0.
 * - Longest streak is preserved across resets.
 */
export function calculateReadingStreaks(
  readingDays: readonly (string | { dateString: string })[],
  asOfDate: Date | string = new Date(),
  timeZone = 'UTC',
): ReadingStreakSummary {
  const distinctDays = new Set<string>()
  for (const item of readingDays) {
    const str = typeof item === 'string' ? item : item.dateString
    if (str && /^\d{4}-\d{2}-\d{2}$/.test(str)) {
      distinctDays.add(str)
    }
  }

  if (distinctDays.size === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalReadingDays: 0,
    }
  }

  const sortedDays = Array.from(distinctDays).sort()

  let streak = 0
  let maxStreak = 0
  let prevDateStr: string | null = null

  for (const curDateStr of sortedDays) {
    if (prevDateStr !== null) {
      const diff = daysDiff(prevDateStr, curDateStr)
      if (diff === 1) {
        streak += 1
      } else if (diff > 1) {
        streak = 1
      }
    } else {
      streak = 1
    }
    maxStreak = Math.max(maxStreak, streak)
    prevDateStr = curDateStr
  }

  const asOf = asOfDate instanceof Date ? asOfDate : new Date(asOfDate)
  const todayStr = formatDateString(asOf, timeZone)
  const lastRecordedStr = sortedDays[sortedDays.length - 1]

  const diffFromToday = daysDiff(lastRecordedStr, todayStr)
  let activeStreak = 0
  if (diffFromToday <= 1) {
    activeStreak = streak
  } else {
    activeStreak = 0
  }

  return {
    currentStreak: activeStreak,
    longestStreak: maxStreak,
    totalReadingDays: distinctDays.size,
  }
}
