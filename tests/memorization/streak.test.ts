import assert from 'node:assert/strict'
import test, { describe, it } from 'node:test'
import { calculateStreakSummary } from '../../packages/memorization-core/streak'

describe('MemorizationStreakTests', () => {
  const now = new Date(1_790_000_000 * 1000)
  const dayMs = 86_400 * 1000

  const streak = (offsets: number[]): { current: number; longest: number } => {
    const days = offsets.map((o) => new Date(now.getTime() + o * dayMs))
    return calculateStreakSummary(days, now, 'UTC')
  }

  it('consecutiveDaysCount', () => {
    assert.equal(streak([0, -1, -2]).current, 3)
  })

  it('yesterdayKeepsStreakAlive', () => {
    assert.equal(streak([-1, -2]).current, 2)
  })

  it('gapBreaksStreak', () => {
    assert.equal(streak([0, -3]).current, 1)
  })

  it('noDaysIsZero', () => {
    assert.equal(streak([]).current, 0)
    assert.equal(streak([]).longest, 0)
  })

  it('longestIsTracked', () => {
    const value = streak([-20, -19, -18, -10, -9, -8, -7, -6])
    assert.equal(value.longest, 5)
    assert.equal(value.current, 0)
  })

  it('futureDaysDoNotInflateCurrent', () => {
    assert.equal(streak([1, 2, 3]).current, 0)
    assert.equal(streak([1, 2, 3]).longest, 3)
    assert.equal(streak([-1, 0, 1, 2]).current, 2)
  })

  it('streakAcrossMidnightAndDST', () => {
    const tz = 'America/New_York'
    // March 8, 2026 is US Spring DST transition
    const makeDate = (day: number, hour: number, minute = 0): Date => {
      // Create local ISO string in NY time
      const pad = (n: number) => String(n).padStart(2, '0')
      // NY is UTC-5 before 2am March 8, UTC-4 after
      const offset = (day === 7 || (day === 8 && hour < 2)) ? '-05:00' : '-04:00'
      const iso = `2026-03-${pad(day)}T${pad(hour)}:${pad(minute)}:00${offset}`
      return new Date(iso)
    }

    const days = [7, 8, 9].map((d) => makeDate(d, 12))
    const nowDate = makeDate(9, 12)
    const result = calculateStreakSummary(days, nowDate, tz)
    assert.equal(result.current, 3)
    assert.equal(result.longest, 3)

    const midnightDays = [makeDate(7, 23, 30), makeDate(8, 0, 30)]
    const midnight = calculateStreakSummary(midnightDays, makeDate(8, 12), tz)
    assert.equal(midnight.current, 2)
    assert.equal(midnight.longest, 2)
  })
})
