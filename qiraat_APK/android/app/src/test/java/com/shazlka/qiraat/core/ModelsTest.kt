package com.shazlka.qiraat.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ModelsTest {
    @Test fun ayahKeyParsingMatchesIos() {
        assertEquals(AyahKey(2, 255), AyahKey.parse("2:255"))
        assertNull(AyahKey.parse("115:1"))
        assertNull(AyahKey.parse("2:0"))
        assertNull(AyahKey.parse("hello"))
    }

    @Test fun rubWithinHizbWrapsEveryFourQuarters() {
        assertEquals(1, metadata(1).rubInHizb)
        assertEquals(4, metadata(4).rubInHizb)
        assertEquals(1, metadata(5).rubInHizb)
        assertEquals(4, metadata(8).rubInHizb)
    }

    private fun metadata(rub: Int) = PageMetadata(1, AyahKey(1, 1), AyahKey(1, 7), listOf("الفاتحة"), 1, 1, rub)
}
