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
}
