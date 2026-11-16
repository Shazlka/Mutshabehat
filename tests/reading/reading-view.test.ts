import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildReadingStatsOverview,
  calculateKhatmaDaysElapsed,
  computeWeeklyDays,
  filterBookmarks,
  formatArabicDate,
  formatLifetimeDuration,
  formatReadingDuration,
  getAyahsForAyahRange,
  getAyahsForPageRange,
  getAyahsForSurah,
  toArabicDigits,
  truncateAyahWords,
} from '../../src/lib/reading-view'
import type { KhatmaRecord, QuranBookmark, ReadingDayRecord } from '../../packages/reading-core'

describe('reading-view pure helpers', () => {
  it('converts Latin digits to Arabic-Indic digits', () => {
    assert.equal(toArabicDigits(0), '٠')
    assert.equal(toArabicDigits(12345), '١٢٣٤٥')
    assert.equal(toArabicDigits('Page 42'), 'Page ٤٢')
    assert.equal(toArabicDigits('3.5'), '٣٫٥')
  })

  it('formats daily reading durations into compact Arabic strings', () => {
    assert.equal(formatReadingDuration(0), '—')
    assert.equal(formatReadingDuration(-10), '—')
    assert.equal(formatReadingDuration(45), '١ د')
    assert.equal(formatReadingDuration(900), '١٥ د')
    assert.equal(formatReadingDuration(3600), '١ س')
    assert.equal(formatReadingDuration(5400), '١ س ٣٠ د')
  })

  it('formats lifetime durations with full wording', () => {
    assert.equal(formatLifetimeDuration(0), '٠ دقيقة')
    assert.equal(formatLifetimeDuration(600), '١٠ دقيقة')
    assert.equal(formatLifetimeDuration(3600), '١ ساعة')
    assert.equal(formatLifetimeDuration(4500), '١ س و ١٥ د')
    assert.equal(formatLifetimeDuration(7200), '٢ ساعة')
  })

  it('calculates khatma elapsed days accurately', () => {
    const startedAt = '2026-11-10T10:00:00Z'
    const now = '2026-11-16T10:00:00Z'
    assert.equal(calculateKhatmaDaysElapsed(startedAt, null, now), 7)

    const completedAt = '2026-11-12T10:00:00Z'
    assert.equal(calculateKhatmaDaysElapsed(startedAt, completedAt, now), 3)

    // Same day is minimum 1
    assert.equal(calculateKhatmaDaysElapsed(startedAt, startedAt), 1)
  })

  it('computes 7-day weekly pills ending at today', () => {
    const readingDays: ReadingDayRecord[] = [
      {
        dateString: '2026-11-15',
        ayahsRead: 20,
        pagesRead: 2,
        secondsRead: 900,
        lastReadAt: '2026-11-15T15:00:00Z',
      },
      {
        dateString: '2026-11-16',
        ayahsRead: 40,
        pagesRead: 3,
        secondsRead: 1800,
        lastReadAt: '2026-11-16T18:00:00Z',
      },
    ]

    const pills = computeWeeklyDays(readingDays, '2026-11-16T12:00:00Z', 'UTC')
    assert.equal(pills.length, 7)

    const todayPill = pills[6]
    assert.equal(todayPill.dateString, '2026-11-16')
    assert.equal(todayPill.isToday, true)
    assert.equal(todayPill.isRead, true)
    assert.equal(todayPill.readingSeconds, 1800)
    assert.equal(todayPill.formattedDuration, '٣٠ د')

    const yesterdayPill = pills[5]
    assert.equal(yesterdayPill.dateString, '2026-11-15')
    assert.equal(yesterdayPill.isToday, false)
    assert.equal(yesterdayPill.isRead, true)
    assert.equal(yesterdayPill.formattedDuration, '١٥ د')

    const unreadPill = pills[0]
    assert.equal(unreadPill.dateString, '2026-11-10')
    assert.equal(unreadPill.isRead, false)
    assert.equal(unreadPill.formattedDuration, '—')
  })

  it('formats dates in Arabic with options', () => {
    const formatted = formatArabicDate('2026-11-16T12:00:00Z')
    assert.ok(formatted.includes('نوفمبر'))
    assert.ok(formatted.includes('2026'))

    const shortFormatted = formatArabicDate('2026-11-16T12:00:00Z', { short: true })
    assert.ok(shortFormatted.includes('نوفمبر'))
    assert.ok(!shortFormatted.includes('2026'))
  })

  it('filters bookmarks by type and query', () => {
    const bookmarks: QuranBookmark[] = [
      {
        id: 'b1',
        type: 'ayah',
        surah: 1,
        ayah: 7,
        page: 1,
        note: 'دعاء الهداية',
        createdAt: '2026-11-01T00:00:00Z',
      },
      {
        id: 'b2',
        type: 'page',
        surah: 2,
        ayah: 1,
        page: 2,
        note: 'بداية البقرة',
        createdAt: '2026-11-02T00:00:00Z',
      },
      {
        id: 'b3',
        type: 'ayah',
        surah: 2,
        ayah: 255,
        page: 42,
        note: 'آية الكرسي',
        createdAt: '2026-11-03T00:00:00Z',
      },
    ]

    const all = filterBookmarks(bookmarks, 'all', '')
    assert.equal(all.length, 3)

    const ayahsOnly = filterBookmarks(bookmarks, 'ayah', '')
    assert.equal(ayahsOnly.length, 2)

    const pagesOnly = filterBookmarks(bookmarks, 'page', '')
    assert.equal(pagesOnly.length, 1)

    const searchResult = filterBookmarks(bookmarks, 'all', 'الكرسي')
    assert.equal(searchResult.length, 1)
    assert.equal(searchResult[0].id, 'b3')

    const searchSurah = filterBookmarks(bookmarks, 'all', 'الفاتحة')
    assert.equal(searchSurah.length, 1)
    assert.equal(searchSurah[0].id, 'b1')
  })

  it('generates accurate ayah ranges from Quran index metadata', () => {
    const fatihaAyahs = getAyahsForSurah(1)
    assert.equal(fatihaAyahs.length, 7)
    assert.equal(fatihaAyahs[0].page, 1)

    const nasAyahs = getAyahsForSurah(114)
    assert.equal(nasAyahs.length, 6)
    assert.equal(nasAyahs[0].page, 604)

    const page1Ayahs = getAyahsForPageRange(1, 1)
    assert.equal(page1Ayahs.length, 7)
    assert.equal(page1Ayahs[0].surah, 1)
    assert.equal(page1Ayahs[0].ayah, 1)

    const ayahRange = getAyahsForAyahRange(1, 1, 1, 3)
    assert.equal(ayahRange.length, 3)
    assert.equal(ayahRange[0].ayah, 1)
    assert.equal(ayahRange[2].ayah, 3)
  })

  it('builds full ReadingStatsOverview', () => {
    const activeKhatma: KhatmaRecord = {
      id: 'k1',
      khatmaNumber: 2,
      startedAt: '2026-11-01T00:00:00Z',
      completedAt: null,
      status: 'active',
      percentComplete: 50,
    }
    const khatmas: KhatmaRecord[] = [
      {
        id: 'k0',
        khatmaNumber: 1,
        startedAt: '2026-10-01T00:00:00Z',
        completedAt: '2026-10-31T00:00:00Z',
        status: 'completed',
        percentComplete: 100,
      },
      activeKhatma,
    ]
    const readingDays: ReadingDayRecord[] = [
      {
        dateString: '2026-11-15',
        ayahsRead: 100,
        pagesRead: 10,
        secondsRead: 3600,
        lastReadAt: '2026-11-15T00:00:00Z',
      },
    ]
    const streaks = { currentStreak: 5, longestStreak: 10, totalReadingDays: 20 }

    const overview = buildReadingStatsOverview({
      activeKhatma,
      khatmas,
      readingDays,
      streaks,
      readAyahsCount: 3118,
      pagesReadCount: 302,
    })

    assert.equal(overview.currentKhatma.khatmaNumber, 2)
    assert.equal(overview.completedKhatmasCount, 1)
    assert.equal(overview.currentStreak, 5)
    assert.equal(overview.longestStreak, 10)
    assert.equal(overview.totalReadingDays, 20)
    assert.equal(overview.totalPagesReadInCurrentKhatma, 302)
    assert.equal(overview.totalAyahsReadInCurrentKhatma, 3118)
    assert.equal(overview.remainingPages, 302)
    assert.equal(overview.progressPercentage, 50)
    assert.equal(overview.lifetimeReadingSeconds, 3600)
    assert.equal(overview.lifetimeHours, 1)
    assert.equal(overview.lifetimeMinutes, 0)
    assert.equal(overview.formattedLifetimeDuration, '١ ساعة')
  })

  it('truncates ayah word previews properly', () => {
    const text = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ'
    const truncated = truncateAyahWords(text, 4)
    assert.equal(truncated, 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ...')
    assert.equal(truncateAyahWords('آية قصيرة', 5), 'آية قصيرة')
  })
})
