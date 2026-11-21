package com.shazlka.qiraat.core

const val MUSHAF_PAGE_COUNT = 604
const val MUSHAF_LINES_PER_PAGE = 15

data class AyahKey(val surah: Int, val ayah: Int) {
    init {
        require(surah in 1..114)
        require(ayah >= 1)
    }

    override fun toString() = "$surah:$ayah"

    companion object {
        fun parse(value: String): AyahKey? {
            val parts = value.split(':')
            if (parts.size != 2) return null
            val surah = parts[0].toIntOrNull() ?: return null
            val ayah = parts[1].toIntOrNull() ?: return null
            return runCatching { AyahKey(surah, ayah) }.getOrNull()
        }
    }
}

enum class CharType(val databaseValue: String) {
    WORD("word"), END("end"), PAUSE("pause"), SAJDAH("sajdah"), RUB_EL_HIZB("rub-el-hizb"), OTHER("other");

    companion object { fun from(value: String) = entries.firstOrNull { it.databaseValue == value } ?: OTHER }
}

data class MushafWord(
    val id: String,
    val page: Int,
    val line: Int,
    val indexInLine: Int,
    val ayahKey: AyahKey,
    val indexInAyah: Int,
    val charType: CharType,
    val glyph: String,
    val textUthmani: String,
)

data class MushafWordCoordinate(val surah: Int, val ayah: Int, val token: Int)
data class LineDecoration(val surahHeader: Int?, val basmala: Boolean)
data class MushafLine(val number: Int, val words: List<MushafWord>, val decoration: LineDecoration?)

data class PageMetadata(
    val page: Int,
    val firstAyah: AyahKey,
    val lastAyah: AyahKey,
    val surahNames: List<String>,
    val juz: Int,
    val hizb: Int,
    val rubInJuz: Int,
) {
    val rubInHizb: Int get() = (rubInJuz.coerceAtLeast(1) - 1) % 4 + 1
}

data class Surah(val number: Int, val name: String, val ayahCount: Int, val firstPage: Int, val lastPage: Int)

data class MushafPage(val number: Int, val lines: List<MushafLine>, val metadata: PageMetadata) {
    val isRightHandPage: Boolean get() = number % 2 == 1
}
