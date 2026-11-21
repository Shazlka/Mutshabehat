package com.shazlka.qiraat.core

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

data class Point(val x: Float, val y: Float)
data class Rect(val left: Float, val top: Float, val right: Float, val bottom: Float) {
    val width: Float get() = right - left
    val height: Float get() = bottom - top
    val centerX: Float get() = (left + right) / 2
    val centerY: Float get() = (top + bottom) / 2
}

object PageLayoutConstants {
    const val PAGE_ASPECT = 1994f / 2850f
    const val FONT_SIZE_RATIO = 0.057f
    const val PADDING_X_RATIO = 0.038f
    const val PADDING_Y_RATIO_OF_WIDTH = 0.032f
    const val OPENING_INSET_Y_RATIO = 0.22f
    const val OPENING_INSET_X_RATIO = 0.13f
    const val CENTRED_GAP_EM = 0.12f
    const val MINIMUM_GAP_EM = 0.04f
    const val SHORT_LINE_RATIO = 0.7f
    const val MAX_HEIGHT_STRETCH = 1.18f

    enum class SpineSide { NONE, LEFT, RIGHT }

    fun fittedPageRect(area: Rect, stretch: Boolean, spine: SpineSide = SpineSide.NONE): Rect {
        var width = area.width
        var height = width / PAGE_ASPECT
        if (height > area.height) {
            height = area.height
            width = height * PAGE_ASPECT
        } else if (stretch) height = min(area.height, height * MAX_HEIGHT_STRETCH)
        val x = when (spine) {
            SpineSide.NONE -> area.centerX - width / 2
            SpineSide.LEFT -> area.left
            SpineSide.RIGHT -> area.right - width
        }
        return Rect(x, area.centerY - height / 2, x + width, area.centerY + height / 2)
    }
}

data class WordBox(val word: MushafWord, val frame: Rect)
sealed interface LaidOutLineContent {
    data class Words(val boxes: List<WordBox>, val gaps: List<Rect>) : LaidOutLineContent
    data class SurahHeader(val surah: Int) : LaidOutLineContent
    data object Basmala : LaidOutLineContent
    data object Empty : LaidOutLineContent
}
data class LaidOutLine(val number: Int, val rect: Rect, val isCentred: Boolean, val content: LaidOutLineContent)

class PageLayout(
    page: MushafPage,
    val width: Float,
    val height: Float,
    surahAyahCounts: Map<Int, Int>,
    advance: (MushafWord, Float) -> Float,
) {
    val fontSize: Float
    val lines: List<LaidOutLine>

    init {
        val opening = page.number <= 2
        val visible = if (opening) page.lines.filter { it.words.isNotEmpty() || it.decoration != null } else page.lines
        val body = if (opening) Rect(
            width * PageLayoutConstants.OPENING_INSET_X_RATIO, height * PageLayoutConstants.OPENING_INSET_Y_RATIO,
            width * (1 - PageLayoutConstants.OPENING_INSET_X_RATIO), height * (1 - PageLayoutConstants.OPENING_INSET_Y_RATIO),
        ) else Rect(
            width * PageLayoutConstants.PADDING_X_RATIO, width * PageLayoutConstants.PADDING_Y_RATIO_OF_WIDTH,
            width * (1 - PageLayoutConstants.PADDING_X_RATIO), height - width * PageLayoutConstants.PADDING_Y_RATIO_OF_WIDTH,
        )
        val counts = page.lines.map { it.words.size }.filter { it > 0 }.sorted()
        val typical = if (counts.isEmpty()) 0 else counts[(counts.size * 0.75).toInt()]
        val rowHeight = if (visible.isEmpty()) 0f else body.height / visible.size
        val target = min(body.width / 16.2f, rowHeight * 0.74f)
        fontSize = max(width * PageLayoutConstants.FONT_SIZE_RATIO, target)
        lines = visible.mapIndexed { row, line ->
            val rect = Rect(body.left, body.top + row * rowHeight, body.right, body.top + (row + 1) * rowHeight)
            val content: LaidOutLineContent
            val centred: Boolean
            when {
                line.decoration?.surahHeader != null -> { centred = true; content = LaidOutLineContent.SurahHeader(line.decoration.surahHeader) }
                line.decoration?.basmala == true -> { centred = true; content = LaidOutLineContent.Basmala }
                line.words.isEmpty() -> { centred = false; content = LaidOutLineContent.Empty }
                else -> {
                    val last = line.words.last()
                    val endsSurah = last.charType == CharType.END && surahAyahCounts[last.ayahKey.surah] == last.ayahKey.ayah
                    centred = opening || (endsSurah && line.words.size < typical * PageLayoutConstants.SHORT_LINE_RATIO)
                    val placed = placeWords(line.words, rect, fontSize, centred, advance)
                    content = LaidOutLineContent.Words(placed.first, placed.second)
                }
            }
            LaidOutLine(line.number, rect, centred, content)
        }
    }

    fun wordAt(point: Point): MushafWord? {
        val line = lines.firstOrNull { point.y >= it.rect.top && point.y < it.rect.bottom } ?: return null
        val boxes = (line.content as? LaidOutLineContent.Words)?.boxes ?: return null
        return boxes.firstOrNull { point.x in it.frame.left..it.frame.right }?.word
            ?: boxes.minByOrNull { abs(it.frame.centerX - point.x) }?.word
    }

    companion object {
        fun placeWords(
            words: List<MushafWord>, rect: Rect, fontSize: Float, centred: Boolean,
            advance: (MushafWord, Float) -> Float,
        ): Pair<List<WordBox>, List<Rect>> {
            var widths = words.map { advance(it, fontSize) }
            val gapCount = max(words.size - 1, 0).toFloat()
            var natural = widths.sum()
            val minGap = fontSize * PageLayoutConstants.MINIMUM_GAP_EM
            val squeeze = min(1f, (rect.width - gapCount * minGap) / max(natural, 1f))
            if (squeeze < 1) { widths = widths.map { it * squeeze }; natural *= squeeze }
            val gap: Float
            var x: Float
            if (centred || words.size == 1) {
                gap = fontSize * PageLayoutConstants.CENTRED_GAP_EM
                x = rect.centerX + (natural + gapCount * gap) / 2
            } else {
                gap = max(minGap, (rect.width - natural) / gapCount)
                x = rect.right
            }
            val boxHeight = fontSize * 1.15f
            val y = rect.centerY - boxHeight / 2
            val boxes = mutableListOf<WordBox>()
            val gaps = mutableListOf<Rect>()
            words.forEachIndexed { index, word ->
                val frame = Rect(x - widths[index], y, x, y + boxHeight)
                boxes += WordBox(word, frame)
                x = frame.left
                if (index < words.lastIndex) {
                    gaps += Rect(x - gap, y, x, y + boxHeight)
                    x -= gap
                }
            }
            return boxes to gaps
        }
    }
}
