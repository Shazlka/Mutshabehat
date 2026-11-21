package com.shazlka.qiraat.core

import android.content.SharedPreferences

object Spread {
    fun rightPage(page: Int) = if (page % 2 == 1) page else page - 1
    fun leftPage(page: Int) = rightPage(page) + 1
    fun isSpread(width: Double, height: Double) = width >= 1024 && width > height
}

fun clampPage(page: Int) = page.coerceIn(1, MUSHAF_PAGE_COUNT)

class ReadingPosition(private val preferences: SharedPreferences) {
    var page: Int
        get() = clampPage(preferences.getInt(KEY, 1))
        set(value) { preferences.edit().putInt(KEY, clampPage(value)).apply() }

    companion object { const val KEY = "mushaf1441:last-page:v1" }
}
