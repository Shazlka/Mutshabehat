import assert from 'node:assert/strict'
import test, { describe, it } from 'node:test'
import {
  calculateProportionalAyahs,
  calculateResumeElapsed,
  calculateRemainingDwellSeconds,
} from '../../packages/reading-core/dwell'
import {
  calculateKhatmaPercent,
  classifyReadingProgressTier,
  classifyDailyHeatLevel,
  calculateChartPoints,
  calculateChartSummary,
  formatChartMetricValue,
  getChartMetricTitle,
  getChartRangeTitle,
  PAGES_PER_JUZ,
  AYAHS_PER_JUZ,
} from '../../packages/reading-core/khatma'
import { calculateReadingStreaks } from '../../packages/reading-core/streak'
import {
  createSurahReadingProgress,
  type ReadingDayRecord,
  type DailyReadingChartPoint,
} from '../../packages/reading-core/types'

describe('ReadingTests (Pure logic)', () => {
  // MARK: - 1. Proportional Page Dwell Tests

  it('testProportionalPageDwellCalculation', () => {
    const totalAyahsOnPage = 6

    // Less than 1 second (flick/swipe): 0 ayahs
    assert.equal(calculateProportionalAyahs(totalAyahsOnPage, 0.5), 0)

    // User's exact example: 6 ayahs on page, 12 seconds stayed -> 2 ayahs completed
    assert.equal(calculateProportionalAyahs(totalAyahsOnPage, 12.0), 2)

    // 15 seconds: 3 ayahs completed
    assert.equal(calculateProportionalAyahs(totalAyahsOnPage, 15.0), 3)

    // 30 seconds: all 6 ayahs completed
    assert.equal(calculateProportionalAyahs(totalAyahsOnPage, 30.0), 6)

    // Greater than 30 seconds (e.g. 45s): capped at 6 ayahs
    assert.equal(calculateProportionalAyahs(totalAyahsOnPage, 45.0), 6)

    // Edge cases: total 0
    assert.equal(calculateProportionalAyahs(0, 15.0), 0)

    // Resume elapsed
    assert.equal(calculateResumeElapsed(2, 6), 10.0) // 30 * (2 / 6) = 10s
    assert.equal(calculateRemainingDwellSeconds(2, 6), 20.0) // 30 - 10 = 20s
  })

  // MARK: - 2. Khatma Progress Tests

  it('testKhatmaProgressCountsPagesNotAyahs', () => {
    assert.equal(calculateKhatmaPercent(0, false), 0)
    assert.ok(Math.abs(calculateKhatmaPercent(302, false) - 50.0) < 0.001)
    assert.equal(calculateKhatmaPercent(604, true), 100)
    // Every page touched but ayahs still unread: caps at 99
    assert.equal(calculateKhatmaPercent(604, false), 99)
    assert.equal(calculateKhatmaPercent(9999, false), 99)
    assert.equal(calculateKhatmaPercent(-3, false), 0)
  })

  // MARK: - 3. Progress Tier Classification Tests

  it('testReadingProgressTierClassification', () => {
    const tier0 = classifyReadingProgressTier(0.0)
    assert.equal(tier0.tier, 'low')
    assert.equal(tier0.colorName, 'danger')

    const tier20 = classifyReadingProgressTier(20.0)
    assert.equal(tier20.tier, 'low')
    assert.equal(tier20.colorName, 'danger')

    const tier34 = classifyReadingProgressTier(34.0)
    assert.equal(tier34.tier, 'medium')
    assert.equal(tier34.colorName, 'caution')

    const tier60 = classifyReadingProgressTier(60.0)
    assert.equal(tier60.tier, 'medium')
    assert.equal(tier60.colorName, 'caution')

    const tier75 = classifyReadingProgressTier(75.0)
    assert.equal(tier75.tier, 'high')
    assert.equal(tier75.colorName, 'progress')

    const tier100 = classifyReadingProgressTier(100.0)
    assert.equal(tier100.tier, 'high')
    assert.equal(tier100.colorName, 'progress')
  })

  // MARK: - 4. Daily Heat Level Tests

  it('testDailyHeatLevelProgression', () => {
    const heatNone = classifyDailyHeatLevel(0, false)
    assert.equal(heatNone.level, 'none')
    assert.equal(heatNone.fillColorName, 'clear')

    const heatLight = classifyDailyHeatLevel(300, true)
    assert.equal(heatLight.level, 'light')
    assert.equal(heatLight.textColorName, 'primary')

    const heatMedium = classifyDailyHeatLevel(1200, true)
    assert.equal(heatMedium.level, 'medium')
    assert.equal(heatMedium.textColorName, 'white')

    const heatHigh = classifyDailyHeatLevel(2400, true)
    assert.equal(heatHigh.level, 'high')
    assert.equal(heatHigh.textColorName, 'white')

    const heatDeep = classifyDailyHeatLevel(4000, true)
    assert.equal(heatDeep.level, 'deep')
    assert.equal(heatDeep.textColorName, 'white')
  })

  // MARK: - 5. Chart Metrics and Range Titles Tests

  it('testChartMetricFormatsValuesWithUnits', () => {
    assert.equal(formatChartMetricValue(201, 'ayahs', true), '٢٠١ آية')
    assert.equal(formatChartMetricValue(201, 'ayahs', false), '201 ayahs')
    assert.equal(formatChartMetricValue(32, 'pages', true), '٣٢ صفحة')
    assert.equal(formatChartMetricValue(4.57, 'pages', false), '4.6 pages')
    assert.equal(formatChartMetricValue(1.6, 'juz', true), '١٫٦ جزء')
    assert.equal(formatChartMetricValue(1.6, 'juz', false), '1.6 juz’')
    // A value that rounds to a whole number shows no decimal
    assert.equal(formatChartMetricValue(1.96, 'juz', false), '2 juz’')
    assert.equal(formatChartMetricValue(0, 'juz', true), '٠ جزء')
  })

  it('testChartMetricAndRangeTitles', () => {
    const metrics = ['ayahs', 'pages', 'juz'] as const
    assert.deepEqual(
      metrics.map((m) => getChartMetricTitle(m, true)),
      ['الآيات', 'الصفحات', 'الأجزاء'],
    )
    assert.deepEqual(
      metrics.map((m) => getChartMetricTitle(m, false)),
      ['Ayahs', 'Pages', 'Juz’'],
    )

    const ranges = [7, 14, 30] as const
    assert.deepEqual(
      ranges.map((r) => getChartRangeTitle(r, true)),
      ['٧ أيام', '١٤ يومًا', '٣٠ يومًا'],
    )
    assert.deepEqual(
      ranges.map((r) => getChartRangeTitle(r, false)),
      ['7 Days', '14 Days', '30 Days'],
    )
  })

  // MARK: - 6. Chart Points and Juz Tests

  it('testChartPointsCoverEveryDayOfTheRangeEndingToday', () => {
    const records: ReadingDayRecord[] = [
      {
        dateString: '2026-11-13',
        ayahsRead: 201,
        pagesRead: 32,
        secondsRead: 2640,
        lastReadAt: '2026-11-13T15:00:00.000Z',
      },
      {
        dateString: '2026-11-10',
        ayahsRead: 50,
        pagesRead: 0,
        secondsRead: 0,
        lastReadAt: '2026-11-10T10:00:00.000Z',
      },
      // Outside the 7-day window
      {
        dateString: '2026-11-01',
        ayahsRead: 999,
        pagesRead: 99,
        secondsRead: 9,
        lastReadAt: '2026-11-01T10:00:00.000Z',
      },
    ]

    const points = calculateChartPoints(records, 7, '2026-11-13T15:00:00.000Z', 'UTC')

    assert.deepEqual(
      points.map((p) => p.dateString),
      [
        '2026-11-07',
        '2026-11-08',
        '2026-11-09',
        '2026-11-10',
        '2026-11-11',
        '2026-11-12',
        '2026-11-13',
      ],
    )
    assert.deepEqual(
      points.map((p) => p.ayahs),
      [0, 0, 0, 50, 0, 0, 201],
    )
    assert.deepEqual(
      points.map((p) => p.pages),
      [0, 0, 0, 0, 0, 0, 32],
    )
    assert.equal(points[points.length - 1].seconds, 2640)

    const points30 = calculateChartPoints(records, 30, '2026-11-13', 'UTC')
    assert.equal(points30.length, 30)
  })

  it('testChartJuzComesFromPagesAndFallsBackToAyahs', () => {
    function makePoint(ayahs: number, pages: number): DailyReadingChartPoint {
      let juz = 0
      if (pages > 0) {
        juz = pages / PAGES_PER_JUZ
      } else if (ayahs > 0) {
        juz = ayahs / AYAHS_PER_JUZ
      }
      return {
        date: '2026-11-13T00:00:00.000Z',
        dateString: '2026-11-13',
        ayahs,
        pages,
        seconds: 0,
        juz,
      }
    }

    // The whole Mushaf is exactly 30 juz’ by either measure
    assert.ok(Math.abs(makePoint(0, 604).juz - 30) < 0.0001)
    assert.ok(Math.abs(makePoint(6236, 0).juz - 30) < 0.0001)
    // Pages win when both are logged: 302 pages is half (15 juz)
    assert.ok(Math.abs(makePoint(6236, 302).juz - 15) < 0.0001)
    assert.equal(makePoint(0, 0).juz, 0)
  })

  it('testChartSummaryTotalsAverageAndAxis', () => {
    const records: ReadingDayRecord[] = [
      {
        dateString: '2026-11-13',
        ayahsRead: 100,
        pagesRead: 20,
        secondsRead: 1000,
        lastReadAt: '2026-11-13T00:00:00.000Z',
      },
      {
        dateString: '2026-11-12',
        ayahsRead: 40,
        pagesRead: 8,
        secondsRead: 500,
        lastReadAt: '2026-11-12T00:00:00.000Z',
      },
    ]
    const points = calculateChartPoints(records, 7, '2026-11-13', 'UTC')

    const pages = calculateChartSummary(points, 'pages')
    assert.equal(pages.total, 28)
    assert.ok(Math.abs(pages.average - 4) < 0.0001)
    assert.equal(pages.peak, 20)
    assert.equal(pages.axisMaximum, 23)

    const emptyPoints = calculateChartPoints([], 7, '2026-11-13', 'UTC')
    const empty = calculateChartSummary(emptyPoints, 'juz')
    assert.equal(empty.total, 0)
    assert.equal(empty.axisMaximum, 1)
    assert.equal(calculateChartSummary([], 'ayahs').average, 0)
  })

  // MARK: - 7. Streak Tests

  it('testStreaksConsecutiveDays', () => {
    const days = ['2026-11-11', '2026-11-12', '2026-11-13']
    const streaks = calculateReadingStreaks(days, '2026-11-13', 'UTC')
    assert.equal(streaks.currentStreak, 3)
    assert.equal(streaks.longestStreak, 3)
    assert.equal(streaks.totalReadingDays, 3)
  })

  it('testStreakResetOnMissedDayPreservingLongestAndTotal', () => {
    // 4 days ago, 3 days ago, 2 days ago: 2026-11-09, 2026-11-10, 2026-11-11
    // Yesterday (2026-11-12) was missed! Today user reads: 2026-11-13
    const days = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-13']
    const streaks = calculateReadingStreaks(days, '2026-11-13', 'UTC')

    // Current streak reset to 1 (started anew today)
    assert.equal(streaks.currentStreak, 1)
    // Longest streak preserved at 3
    assert.equal(streaks.longestStreak, 3)
    // Total reading days incremented to 4
    assert.equal(streaks.totalReadingDays, 4)
  })

  // MARK: - 8. Surah Progress Filter Tests

  it('testSurahProgressCalculationsAndFilters', () => {
    const fatiha = createSurahReadingProgress(1, 'الفاتحة', 7, 7, 1)
    assert.equal(fatiha.percentage, 100.0)
    assert.equal(fatiha.isCompleted, true)
    assert.equal(fatiha.isStarted, false)
    assert.equal(fatiha.remainingAyahsCount, 0)

    const baqarah = createSurahReadingProgress(2, 'البقرة', 10, 286, 2)
    assert.ok(Math.abs(Math.round(baqarah.percentage * 10) / 10 - 3.5) < 0.001)
    assert.equal(baqarah.isCompleted, false)
    assert.equal(baqarah.isStarted, true)
    assert.equal(baqarah.remainingAyahsCount, 276)

    const aalImran = createSurahReadingProgress(3, 'آل عمران', 0, 200, 50)
    assert.equal(aalImran.percentage, 0)
    assert.equal(aalImran.isCompleted, false)
    assert.equal(aalImran.isStarted, false)
    assert.equal(aalImran.remainingAyahsCount, 200)

    const all = [fatiha, baqarah, aalImran]

    // Remaining filter must EXCLUDE completed Al-Fatiha and INCLUDE Al-Baqarah & Aal-Imran
    const remaining = all.filter((s) => !s.isCompleted)
    assert.equal(remaining.length, 2)
    assert.ok(remaining.some((s) => s.surahNumber === 2))
    assert.ok(remaining.some((s) => s.surahNumber === 3))
    assert.ok(!remaining.some((s) => s.surahNumber === 1))

    // Completed filter must contain only Al-Fatiha
    const completed = all.filter((s) => s.isCompleted)
    assert.equal(completed.length, 1)
    assert.equal(completed[0].surahNumber, 1)

    // Started filter must contain only Al-Baqarah
    const started = all.filter((s) => s.isStarted)
    assert.equal(started.length, 1)
    assert.equal(started[0].surahNumber, 2)
  })
})
