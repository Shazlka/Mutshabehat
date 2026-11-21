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

    @Test fun portraitPhonesAlwaysSinglePageRegardlessOfDensity() {
        // Samsung Galaxy A24 (SM-A245F): 1080x2340 px at 450 dpi = 384 x 832 dp
        val samsungWidthDp = 1080.0 / (450.0 / 160.0) // 384.0 dp
        val samsungHeightDp = 2340.0 / (450.0 / 160.0) // 832.0 dp
        assertFalse(Spread.isSpread(samsungWidthDp, samsungHeightDp))
        assertEquals(1, Spread.pageCount(samsungWidthDp, samsungHeightDp))
        assertEquals(samsungWidthDp, Spread.pageWidth(samsungWidthDp, samsungHeightDp), 0.001)

        // Pixel 6 emulator: 1080x2400 px at 420 dpi = 411.43 x 914.29 dp
        val pixelWidthDp = 1080.0 / (420.0 / 160.0) // 411.428 dp
        val pixelHeightDp = 2400.0 / (420.0 / 160.0) // 914.285 dp
        assertFalse(Spread.isSpread(pixelWidthDp, pixelHeightDp))
        assertEquals(1, Spread.pageCount(pixelWidthDp, pixelHeightDp))
        assertEquals(pixelWidthDp, Spread.pageWidth(pixelWidthDp, pixelHeightDp), 0.001)

        // Phone in landscape orientation (e.g. 832x384 dp) is still < 1024 dp, so it must not trigger spread
        assertFalse(Spread.isSpread(samsungHeightDp, samsungWidthDp))
        assertEquals(1, Spread.pageCount(samsungHeightDp, samsungWidthDp))
        assertEquals(samsungHeightDp, Spread.pageWidth(samsungHeightDp, samsungWidthDp), 0.001)
    }

    @Test fun largeTabletLandscapeEnablesTwoPageSpread() {
        // iPad / Large Tablet landscape: >= 1024 dp width and landscape orientation
        assertTrue(Spread.isSpread(1366.0, 1024.0))
        assertEquals(2, Spread.pageCount(1366.0, 1024.0))
        assertEquals(683.0, Spread.pageWidth(1366.0, 1024.0), 0.001)

        assertTrue(Spread.isSpread(1180.0, 820.0))
        assertEquals(2, Spread.pageCount(1180.0, 820.0))
        assertEquals(590.0, Spread.pageWidth(1180.0, 820.0), 0.001)

        // Tablet in portrait orientation: height > width, so single page
        assertFalse(Spread.isSpread(1024.0, 1366.0))
        assertEquals(1, Spread.pageCount(1024.0, 1366.0))
        assertEquals(1024.0, Spread.pageWidth(1024.0, 1366.0), 0.001)
    }

    @Test fun pagesClampToMushaf() {
        assertEquals(1, clampPage(-3)); assertEquals(50, clampPage(50)); assertEquals(604, clampPage(9999))
    }
}
