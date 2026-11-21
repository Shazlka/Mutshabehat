package com.shazlka.qiraat.core

import android.content.res.AssetManager
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Typeface
import java.util.LinkedHashMap

/** Loads only pN.ttf for page N. Missing fonts are fatal and never substitute another page font. */
class QcfFontStore(private val assets: AssetManager, private val capacity: Int = 12) {
    sealed class Failure(message: String) : Exception(message) {
        class Missing(page: Int, cause: Throwable? = null) : Failure("Missing or unreadable QCF font for page $page") { init { if (cause != null) initCause(cause) } }
    }

    private val fonts = object : LinkedHashMap<Int, Typeface>(capacity, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<Int, Typeface>?) = size > capacity
    }

    @Synchronized fun font(page: Int): Typeface = fonts[page] ?: try {
        Typeface.createFromAsset(assets, "fonts/p$page.ttf").also { fonts[page] = it }
    } catch (error: RuntimeException) { throw Failure.Missing(page, error) }

    @Synchronized fun cachedPages(): List<Int> = fonts.keys.toList()

    fun prewarm(pages: Iterable<Int>) { pages.filter { it in 1..MUSHAF_PAGE_COUNT }.forEach { runCatching { font(it) } } }

    fun measureToken(glyph: String, page: Int, size: Float, paint: Paint = Paint()): Float {
        val pageFont = font(page)
        return splitToken(glyph).sumOf { piece ->
            paint.typeface = if (piece == " ") Typeface.DEFAULT else pageFont
            paint.textSize = size
            paint.measureText(piece).toDouble()
        }.toFloat()
    }

    /** Handles the 198 space-containing tokens without asking Android to font-fallback PUA glyphs. */
    fun drawToken(canvas: Canvas, glyph: String, page: Int, x: Float, baseline: Float, paint: Paint) {
        val pageFont = font(page)
        var cursor = x
        splitToken(glyph).forEach { piece ->
            paint.typeface = if (piece == " ") Typeface.DEFAULT else pageFont
            canvas.drawText(piece, cursor, baseline, paint)
            cursor += paint.measureText(piece)
        }
    }

    companion object {
        fun splitToken(value: String): List<String> = buildList {
            val buffer = StringBuilder()
            value.forEach { character ->
                if (character == ' ') {
                    if (buffer.isNotEmpty()) { add(buffer.toString()); buffer.clear() }
                    add(" ")
                } else buffer.append(character)
            }
            if (buffer.isNotEmpty()) add(buffer.toString())
        }

        fun neighbourhood(page: Int): IntRange {
            val safe = clampPage(page)
            return maxOf(1, safe - 2)..minOf(MUSHAF_PAGE_COUNT, safe + 4)
        }
    }
}
