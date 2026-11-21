package com.shazlka.qiraat.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NavigationTest {
    @Test fun spreadsPairOddRightWithEvenLeft() {
        assertEquals(1, Spread.rightPage(1)); assertEquals(2, Spread.leftPage(1))
        assertEquals(1, Spread.rightPage(2)); assertEquals(2, Spread.leftPage(2))
        assertEquals(603, Spread.rightPage(604)); assertEquals(604, Spread.leftPage(604))
    }

    @Test fun spreadOnlyInWideLandscape() {
        assertTrue(Spread.isSpread(1366.0, 1024.0))
        assertTrue(Spread.isSpread(1180.0, 820.0))
        assertFalse(Spread.isSpread(1024.0, 1366.0))
        assertFalse(Spread.isSpread(956.0, 440.0))
    }

    @Test fun pagesClampToMushaf() {
        assertEquals(1, clampPage(-3)); assertEquals(50, clampPage(50)); assertEquals(604, clampPage(9999))
    }
}
