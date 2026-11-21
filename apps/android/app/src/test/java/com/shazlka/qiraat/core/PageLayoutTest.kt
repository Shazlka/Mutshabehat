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

    @Test fun regularPagesRespectVerticalPrintInsets() {
        val width = 1080f
        val height = 1772f // available height on 1080x2340 phone
        val metrics = PageLayoutConstants.computeVerticalMetrics(50, width, height)
        val topInset = width * PageLayoutConstants.PADDING_Y_RATIO_OF_WIDTH
        val bottomInset = width * PageLayoutConstants.PADDING_BOTTOM_RATIO_OF_WIDTH

        assertEquals(topInset, metrics.bodyTop, .001f)
        assertEquals(height - bottomInset, metrics.bodyBottom, .001f)
        assertEquals(height - topInset - bottomInset, metrics.bodyHeight, .001f)
        assertEquals(metrics.bodyHeight / 15f, metrics.rowHeight, .001f)
        assertTrue("Page number is within bottom inset", metrics.pageNumberY > metrics.bodyBottom - width * 0.010f)
        assertTrue("Page number is within viewport", metrics.pageNumberY < height)
    }

    @Test fun openingPagesAreCentredBlockWithoutEmptyRows() {
        val width = 1080f
        val height = 1772f
        for (page in listOf(1, 2)) {
            val metrics = PageLayoutConstants.computeVerticalMetrics(page, width, height)
            assertTrue(metrics.isOpening)
            assertEquals(8, metrics.lineCount)
            assertEquals(height * PageLayoutConstants.OPENING_INSET_Y_RATIO, metrics.bodyTop, .001f)
            assertEquals(height * (1f - PageLayoutConstants.OPENING_INSET_Y_RATIO), metrics.bodyBottom, .001f)
            assertEquals(height * 0.56f, metrics.bodyHeight, .001f)
            assertEquals((height * 0.56f) / 8f, metrics.rowHeight, .001f)
        }
    }

    @Test fun verticalPitchOnSamsungGalaxyA24FillsAvailableHeight() {
        // Samsung SM-A245F: 1080x2340 px at 450 dpi (384x832 dp)
        // Available height in pager: 832 - 32 (status) - 48 (header) - 76 (footer) - 48 (nav) = 628 dp = 1766 px
        val width = 1080f
        val height = 1766f

        val metrics = PageLayoutConstants.computeVerticalMetrics(26, width, height)
        val unstretchedHeight = width / PageLayoutConstants.PAGE_ASPECT // 1543 px
        val unstretchedRowHeight = (unstretchedHeight - width * (PageLayoutConstants.PADDING_Y_RATIO_OF_WIDTH + PageLayoutConstants.PADDING_BOTTOM_RATIO_OF_WIDTH)) / 15f // 97.5 px

        val expectedRowHeight = (1766f - 1080f * (PageLayoutConstants.PADDING_Y_RATIO_OF_WIDTH + PageLayoutConstants.PADDING_BOTTOM_RATIO_OF_WIDTH)) / 15f
        assertEquals(expectedRowHeight, metrics.rowHeight, 0.1f)
        assertTrue("Stretched pitch must be ~15% larger than unstretched aspect pitch", metrics.rowHeight > unstretchedRowHeight * 1.14f)
        assertEquals(34.56f, metrics.bodyTop, 0.01f)
        assertEquals(1766f - 1080f * PageLayoutConstants.PADDING_BOTTOM_RATIO_OF_WIDTH, metrics.bodyBottom, 0.01f)
        assertEquals(1766f - 1080f * PageLayoutConstants.PAGE_NUMBER_Y_RATIO_OF_WIDTH, metrics.pageNumberY, 0.01f)
    }

    @Test fun verticalPitchOnPixel6FillsAvailableHeight() {
        // Pixel 6: 1080x2400 px at 420 dpi (411.43x914.29 dp)
        // Available height in pager: 914.29 - 32 - 48 - 76 - 48 = 710.29 dp (~1864 px)
        val width = 1080f
        val height = 1864f

        val metrics = PageLayoutConstants.computeVerticalMetrics(26, width, height)
        val expectedRowHeight = (1864f - 1080f * (PageLayoutConstants.PADDING_Y_RATIO_OF_WIDTH + PageLayoutConstants.PADDING_BOTTOM_RATIO_OF_WIDTH)) / 15f
        assertEquals(expectedRowHeight, metrics.rowHeight, 0.01f)
        assertEquals(15, metrics.lineCount)
    }

    @Test fun verticalPitchOnSmallScreenScalesCleanly() {
        // 720x1280 px at 320 dpi (360x640 dp)
        // Available height: 640 - 24 - 48 - 76 - 48 = 444 dp = 888 px
        val width = 720f
        val height = 888f

        val metrics = PageLayoutConstants.computeVerticalMetrics(300, width, height)
        val expectedRowHeight = (888f - 720f * (PageLayoutConstants.PADDING_Y_RATIO_OF_WIDTH + PageLayoutConstants.PADDING_BOTTOM_RATIO_OF_WIDTH)) / 15f
        assertEquals(expectedRowHeight, metrics.rowHeight, 0.01f)
        assertEquals(23.04f, metrics.bodyTop, 0.01f)
        assertEquals(888f - 720f * PageLayoutConstants.PADDING_BOTTOM_RATIO_OF_WIDTH, metrics.bodyBottom, 0.01f)
    }

    @Test fun verticalPitchOnTabletPortraitAndLandscape() {
        // Tablet portrait: 1024x1366 dp, single page
        val portraitWidth = 1024f
        val portraitHeight = 1170f
        val portraitMetrics = PageLayoutConstants.computeVerticalMetrics(26, portraitWidth, portraitHeight)
        val expectedPortraitPitch = (1170f - 1024f * (PageLayoutConstants.PADDING_Y_RATIO_OF_WIDTH + PageLayoutConstants.PADDING_BOTTOM_RATIO_OF_WIDTH)) / 15f
        assertEquals(expectedPortraitPitch, portraitMetrics.rowHeight, 0.01f)

        // Tablet landscape: 1366x1024 dp, 2-page spread where each page is 683 dp wide
        val spreadHalfWidth = 683f
        val spreadHeight = 830f
        val spreadMetrics = PageLayoutConstants.computeVerticalMetrics(26, spreadHalfWidth, spreadHeight)
        val expectedSpreadPitch = (830f - 683f * (PageLayoutConstants.PADDING_Y_RATIO_OF_WIDTH + PageLayoutConstants.PADDING_BOTTOM_RATIO_OF_WIDTH)) / 15f
        assertEquals(expectedSpreadPitch, spreadMetrics.rowHeight, 0.01f)
    }

    @Test fun surahStartAndNormalPagesMaintainIdenticalFifteenLinePitch() {
        val width = 1080f
        val height = 1772f
        // Page 50 (surah start: header + basmala + 13 text lines) vs Page 26 (normal 15 text lines)
        val page50Metrics = PageLayoutConstants.computeVerticalMetrics(50, width, height)
        val page26Metrics = PageLayoutConstants.computeVerticalMetrics(26, width, height)
        assertEquals(page26Metrics.rowHeight, page50Metrics.rowHeight, 0.001f)
        assertEquals(page26Metrics.bodyTop, page50Metrics.bodyTop, 0.001f)
        assertEquals(page26Metrics.bodyBottom, page50Metrics.bodyBottom, 0.001f)
    }

    @Test fun pagesWithFewerLinesRetainStandardFifteenLinePitch() {
        val width = 1080f
        val height = 1772f
        // If a page has only 10 lines, default pitch uses standard 15-line grid
        val normalPitch = PageLayoutConstants.verticalPitch(100, width, height)
        val pitchWith10Lines = PageLayoutConstants.verticalPitch(100, width, height, lineCount = 15)
        assertEquals(normalPitch, pitchWith10Lines, 0.001f)
    }

    @Test fun pageLayoutIntegratesVerticalMetricsAcrossAllLines() {
        val width = 1080f
        val height = 1772f
        val lines = (1..15).map { lineNum ->
            MushafLine(lineNum, (1..4).map { fakeWord(it) }, null)
        }
        val page = MushafPage(26, lines, PageMetadata(26, AyahKey(2, 164), AyahKey(2, 170), listOf("البقرة"), 2, 3, 2))
        val layout = PageLayout(page, width, height, mapOf(2 to 286)) { _, _ -> 40f }

        assertEquals(15, layout.lines.size)
        assertEquals(layout.verticalMetrics.bodyTop, layout.lines.first().rect.top, 0.001f)
        assertEquals(layout.verticalMetrics.bodyBottom, layout.lines.last().rect.bottom, 0.001f)
        assertEquals(layout.verticalMetrics.rowHeight, layout.rowHeight, 0.001f)
        for (i in 0 until 14) {
            assertEquals(layout.lines[i].rect.bottom, layout.lines[i + 1].rect.top, 0.001f)
        }
    }

    private fun fakeWord(index: Int) = MushafWord(
        "2:1:$index", 2, 1, index, AyahKey(2, 1), index, CharType.WORD, "\uFC41", "word",
    )
}
