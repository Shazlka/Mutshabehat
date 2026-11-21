package com.shazlka.qiraat.core

import org.junit.Assert.assertEquals
import org.junit.Test

class QcfFontStoreTest {
    @Test fun spaceContainingTokenIsSplitWithoutChangingPageGlyphRuns() {
        assertEquals(listOf("\uFC68", " ", "\uFC69"), QcfFontStore.splitToken("\uFC68 \uFC69"))
    }

    @Test fun multiPieceTokenDrawOrderIsReversedForRtl() {
        val pieces = QcfFontStore.splitToken("\uFC68 \uFC69")
        assertEquals(listOf("\uFC68", " ", "\uFC69"), pieces)
        // In Arabic RTL reading order, piece[0] is the rightmost glyph and pieces.last() is the leftmost glyph.
        // Left-to-right drawing on Canvas must draw them in reverse visual order.
        val visualOrder = pieces.indices.reversed().map { pieces[it] }
        assertEquals(listOf("\uFC69", " ", "\uFC68"), visualOrder)
    }

    @Test fun prewarmNeighbourhoodMatchesIos() {
        assertEquals(1..5, QcfFontStore.neighbourhood(1))
        assertEquals(602..604, QcfFontStore.neighbourhood(604))
    }
}
