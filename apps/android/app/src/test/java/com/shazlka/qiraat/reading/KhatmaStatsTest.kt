package com.shazlka.qiraat.reading

import org.junit.Assert.assertEquals
import org.junit.Test

/** The khatma percentage is counted in Mushaf pages like the iOS app, not taken from the stored column. */
class KhatmaStatsTest {
    @Test
    fun percentIsPagesOutOfSixHundredFour() {
        assertEquals(0.0, khatmaPercent(0, false), 0.0)
        assertEquals(50.0, khatmaPercent(302, false), 1e-9)
        assertEquals(31.788, khatmaPercent(192, false), 1e-3)
    }

    @Test
    fun staysBelowOneHundredUntilEveryAyahIsRead() {
        assertEquals(99.0, khatmaPercent(604, false), 0.0)
        assertEquals(100.0, khatmaPercent(604, true), 0.0)
        assertEquals(100.0, khatmaPercent(10, true), 0.0)
    }

    @Test
    fun ignoresOutOfRangePageCounts() {
        assertEquals(0.0, khatmaPercent(-5, false), 0.0)
        assertEquals(99.0, khatmaPercent(9999, false), 0.0)
    }

    @Test
    fun formatsContiguousAyahRangesAndCalculatesJuz() {
        assertEquals("١–٥، ٨، ١٠–١٢", khatmaStatsFormatRanges(listOf(12, 1, 2, 3, 4, 5, 8, 10, 11, 2)))
        assertEquals("", khatmaStatsFormatRanges(emptyList()))
        assertEquals(15.0, khatmaStatsDayJuz(0, 302), 1e-6)
        assertEquals(1.0, khatmaStatsDayJuz(6236 / 30, 0), 0.05)
    }
}
