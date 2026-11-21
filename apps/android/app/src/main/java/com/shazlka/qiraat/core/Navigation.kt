package com.shazlka.qiraat.core

import android.content.SharedPreferences

object Spread {
    fun rightPage(page: Int) = if (page % 2 == 1) page else page - 1
    fun leftPage(page: Int) = rightPage(page) + 1

    /**
     * Spread is only active on wide-screen tablet displays in landscape orientation.
     * Dimensions must be measured in density-independent points (dp), never raw hardware pixels.
     * Portrait phones (such as 384x832 dp) and landscape phones (832x384 dp) always evaluate to false.
     */
    fun isSpread(viewportWidthDp: Double, viewportHeightDp: Double): Boolean =
        viewportWidthDp >= 1024.0 && viewportWidthDp > viewportHeightDp

    fun isSpread(viewportWidthDp: Float, viewportHeightDp: Float): Boolean =
        viewportWidthDp >= 1024f && viewportWidthDp > viewportHeightDp

    /**
     * Number of pages to render simultaneously across the viewport width.
     * Exactly 1 page for phones (portrait or landscape), exactly 2 pages for iPad/tablet landscape spreads.
     */
    fun pageCount(viewportWidthDp: Double, viewportHeightDp: Double): Int =
        if (isSpread(viewportWidthDp, viewportHeightDp)) 2 else 1

    fun pageCount(viewportWidthDp: Float, viewportHeightDp: Float): Int =
        if (isSpread(viewportWidthDp, viewportHeightDp)) 2 else 1

    /**
     * Width allocated per page within the reader viewport.
     */
    fun pageWidth(viewportWidthDp: Double, viewportHeightDp: Double): Double =
        if (isSpread(viewportWidthDp, viewportHeightDp)) viewportWidthDp / 2.0 else viewportWidthDp

    fun pageWidth(viewportWidthDp: Float, viewportHeightDp: Float): Float =
        if (isSpread(viewportWidthDp, viewportHeightDp)) viewportWidthDp / 2f else viewportWidthDp
}

fun clampPage(page: Int) = page.coerceIn(1, MUSHAF_PAGE_COUNT)

class ReadingPosition(private val preferences: SharedPreferences) {
    var page: Int
        get() = clampPage(preferences.getInt(KEY, 1))
        set(value) { preferences.edit().putInt(KEY, clampPage(value)).apply() }

    companion object { const val KEY = "mushaf1441:last-page:v1" }
}
