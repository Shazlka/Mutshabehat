package com.shazlka.qiraat.memorization

import com.shazlka.qiraat.core.AyahKey
import com.shazlka.qiraat.core.AyahLayoutRow
import com.shazlka.qiraat.core.MUSHAF_PAGE_COUNT
import com.shazlka.qiraat.core.MushafDatabase

class QuranIndex(
    val rows: List<AyahLayoutRow>,
    val pageJuz: Map<Int, Int>,
) {
    val ayahKeys: List<AyahKey> = rows.map { it.key }
    val totalAyahs: Int get() = ayahKeys.size
    val surahNumbers: List<Int> by lazy { surahAyat.keys.sorted() }
    val juzNumbers: List<Int> by lazy { juzPages.keys.sorted() }
    val pageNumbers: List<Int> by lazy { (pageAyat.keys + pageJuz.keys).distinct().sorted() }

    private val ordinals = mutableMapOf<AyahKey, Int>()
    private val ayahPages = mutableMapOf<AyahKey, Int>()
    private val pageAyat = mutableMapOf<Int, MutableList<AyahKey>>()
    private val surahAyat = mutableMapOf<Int, MutableList<AyahKey>>()
    private val surahPages = mutableMapOf<Int, IntRange>()
    private val juzPages = mutableMapOf<Int, IntRange>()
    private val weights = mutableMapOf<AyahKey, Double>()

    init {
        val pageWords = mutableMapOf<Int, Int>()
        for ((ordinal, row) in rows.withIndex()) {
            ordinals[row.key] = ordinal
            ayahPages[row.key] = row.page
            pageAyat.getOrPut(row.page) { mutableListOf() }.add(row.key)
            surahAyat.getOrPut(row.key.surah) { mutableListOf() }.add(row.key)

            val existingRange = surahPages[row.key.surah]
            surahPages[row.key.surah] = if (existingRange == null) {
                row.page..row.page
            } else {
                minOf(existingRange.first, row.page)..maxOf(existingRange.last, row.page)
            }
            pageWords[row.page] = (pageWords[row.page] ?: 0) + row.wordCount
        }

        for (row in rows) {
            val total = pageWords[row.page] ?: 0
            weights[row.key] = if (total == 0) 0.0 else row.wordCount.toDouble() / total.toDouble()
        }

        for ((page, juz) in pageJuz) {
            val existing = juzPages[juz]
            juzPages[juz] = if (existing == null) {
                page..page
            } else {
                minOf(existing.first, page)..maxOf(existing.last, page)
            }
        }
    }

    companion object {
        fun load(db: MushafDatabase): QuranIndex {
            return QuranIndex(db.ayahLayout(), db.pageJuzMap())
        }
    }

    fun ordinal(key: AyahKey): Int? = ordinals[key]
    fun ayahCount(surah: Int): Int = surahAyat[surah]?.size ?: 0
    fun page(key: AyahKey): Int? = ayahPages[key]
    fun ayatOnPage(page: Int): List<AyahKey> = pageAyat[page].orEmpty()
    fun weight(key: AyahKey): Double = weights[key] ?: 0.0
    fun pagesOfSurah(surah: Int): IntRange? = surahPages[surah]
    fun ayatOfSurah(surah: Int): List<AyahKey> = surahAyat[surah].orEmpty()
    fun juz(page: Int): Int? = pageJuz[page]
    fun pagesOfJuz(juz: Int): IntRange? = juzPages[juz]

    fun ayatOfJuz(juz: Int): List<AyahKey> {
        val range = juzPages[juz] ?: return emptyList()
        return range.filter { pageJuz[it] == juz }.flatMap { pageAyat[it].orEmpty() }
    }

    fun ayatInPages(pages: IntRange): List<AyahKey> {
        val lower = maxOf(1, pages.first)
        val upper = minOf(MUSHAF_PAGE_COUNT, pages.last)
        if (lower > upper) return emptyList()
        return (lower..upper).flatMap { pageAyat[it].orEmpty() }
    }

    fun ayatSpan(first: AyahKey, last: AyahKey): List<AyahKey> {
        val start = ordinals[first] ?: return emptyList()
        val end = ordinals[last] ?: return emptyList()
        val minIdx = minOf(start, end)
        val maxIdx = maxOf(start, end)
        return ayahKeys.subList(minIdx, maxIdx + 1)
    }
}
