package com.shazlka.qiraat.core

import org.junit.Assert.assertEquals
import org.junit.Test

class QcfFontStoreTest {
    @Test fun spaceContainingTokenIsSplitWithoutChangingPageGlyphRuns() {
        assertEquals(listOf("\uFC68", " ", "\uFC69"), QcfFontStore.splitToken("\uFC68 \uFC69"))
    }

    @Test fun prewarmNeighbourhoodMatchesIos() {
        assertEquals(1..5, QcfFontStore.neighbourhood(1))
        assertEquals(602..604, QcfFontStore.neighbourhood(604))
    }
}
