import { epochMs } from './types'

export interface StreakSummary {
  readonly current: number
  readonly longest: number
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
 * Calculates current and longest streaks across unique calendar days.
 * Consecutive calendar days are determined in the specified timeZone (defaulting to UTC).
 * Matches iOS `StreakCalculator`.
 */
export function calculateStreakSummary(
  qualifyingDays: Iterable<Date | string | number>,
  now: Date | string | number,
  timeZone = 'UTC',
): StreakSummary {
  const uniqueDays = new Set<string>()
  for (const item of qualifyingDays) {
    const d = new Date(epochMs(item))
    uniqueDays.add(formatDateString(d, timeZone))
  }

  if (uniqueDays.size === 0) {
    return { current: 0, longest: 0 }
  }

  const sortedDays = Array.from(uniqueDays).sort()

  let longest = 0
  let run = 0
  let previous: string | null = null

  for (const day of sortedDays) {
    if (previous !== null && addCalendarDays(previous, 1) === day) {
      run += 1
    } else {
      run = 1
    }
    longest = Math.max(longest, run)
    previous = day
  }

  const todayStr = formatDateString(new Date(epochMs(now)), timeZone)
  const yesterdayStr = addCalendarDays(todayStr, -1)

  let cursor: string | null = null
  if (uniqueDays.has(todayStr)) {
    cursor = todayStr
  } else if (uniqueDays.has(yesterdayStr)) {
    cursor = yesterdayStr
  }

  let current = 0
  while (cursor !== null && uniqueDays.has(cursor)) {
    current += 1
    cursor = addCalendarDays(cursor, -1)
  }

  return { current, longest }
}
