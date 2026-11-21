package com.shazlka.qiraat.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.abs

class PageLayoutTest {
    @Test fun justifiedLineRunsRightToLeftEdgeToEdge() {
        val words = (1..5).map(::fakeWord)
        val rect = Rect(28.8f, 100f, 371.2f, 130f)
        val (boxes, gaps) = PageLayout.placeWords(words, rect, 17.4f, false) { _, _ -> 40f }
        assertEquals(1, boxes.first().word.indexInLine)
        assertTrue(abs(boxes.first().frame.right - rect.right) < .001f)
        assertTrue(abs(boxes.last().frame.left - rect.left) < .001f)
        assertTrue(boxes.zipWithNext().all { (right, left) -> right.frame.left > left.frame.left })
        assertEquals(4, gaps.size)
        assertTrue(gaps.map { (it.width * 1000).toInt() }.distinct().size == 1)
    }

    @Test fun centredLineUsesFixedGapsAroundTheMiddle() {
        val (boxes, gaps) = PageLayout.placeWords((1..3).map(::fakeWord), Rect(0f, 0f, 300f, 30f), 20f, true) { _, _ -> 30f }
        assertTrue(gaps.all { abs(it.width - 2.4f) < .001f })
        assertTrue(abs((boxes.last().frame.left + boxes.first().frame.right) / 2 - 150f) < .001f)
    }

    @Test fun overlongLineIsCondensedNeverClipped() {
        val rect = Rect(10f, 0f, 210f, 30f)
        val (boxes, gaps) = PageLayout.placeWords((1..10).map(::fakeWord), rect, 20f, false) { _, _ -> 50f }
        assertTrue(boxes.last().frame.left >= rect.left - .001f)
        assertTrue(boxes.first().frame.right <= rect.right + .001f)
        assertTrue(gaps.all { it.width >= 20 * PageLayoutConstants.MINIMUM_GAP_EM - .001f })
    }

    @Test fun tallPhoneStretchesAtMostEighteenPercent() {
        val area = Rect(0f, 62f, 440f, 922f)
        val rect = PageLayoutConstants.fittedPageRect(area, true)
        assertEquals(440f, rect.width, .001f)
        assertEquals(440 / PageLayoutConstants.PAGE_ASPECT * 1.18f, rect.height, .001f)
        assertEquals(area.centerY, rect.centerY, .001f)
    }

    private fun fakeWord(index: Int) = MushafWord(
        "2:1:$index", 2, 1, index, AyahKey(2, 1), index, CharType.WORD, "\uFC41", "word",
    )
}
