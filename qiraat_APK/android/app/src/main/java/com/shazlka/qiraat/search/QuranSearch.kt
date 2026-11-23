package com.shazlka.qiraat.search

import kotlin.math.max
import kotlin.math.min

enum class QuranSearchMode { SMART, EXACT, BROAD }
enum class QuranSearchMatchType { EXACT, PLAIN, IMLAI, CANONICAL, ALIAS, FUZZY, RASM }

data class QuranSearchToken(val original: String, val plain: String, val canonical: String, val imlai: String, val rasmKey: String)
data class QuranSearchQuery(
    val original: String, val plain: String, val canonical: String, val imlai: String, val rasmKey: String,
    val tokens: List<QuranSearchToken>,
)

object QuranSearchNormalizer {
    private val orthographyRules = listOf(
        "الصلوه" to "الصلاه", "صلوه" to "صلاه", "الزكوه" to "الزكاه", "زكوه" to "زكاه",
        "الحيوه" to "الحياه", "حيوه" to "حياه", "الربوا" to "الربا", "الربو" to "الربا",
        "ايمن" to "ايمان", "الكتب" to "الكتاب", "قراان" to "قران", "اامن" to "امن", "اادم" to "ادم",
        "يبني" to "بني", "اسراييل" to "اسرايل", "العلمين" to "العالمين", "الانهر" to "الانهار",
        "رجعون" to "راجعون", "جنت" to "جنات", "مشكوه" to "مشكاه", "نجوه" to "نجاه",
        "منوه" to "مناه", "الغدوه" to "الغداه",
    )

    fun query(text: String): QuranSearchQuery {
        val prepared = cleanup(text).replace("يا أيها", "يأيها").replace("يا ايها", "يايها")
        val tokens = prepared.split(Regex("\\s+")).filter(String::isNotEmpty).map(::token)
        return QuranSearchQuery(text, tokens.joinToString(" ") { it.plain }, tokens.joinToString(" ") { it.canonical },
            tokens.joinToString(" ") { it.imlai }, tokens.joinToString(" ") { it.rasmKey }, tokens)
    }

    fun token(text: String): QuranSearchToken {
        val plain = plain(text)
        val canonical = canonical(plain)
        return QuranSearchToken(text, plain, canonical, imlai(canonical), rasm(canonical))
    }

    fun cleanup(text: String): String = buildString {
        text.forEach { ch ->
            val type = Character.getType(ch)
            if (ch.code == 0x0640 || ch.code in 0x06D6..0x06ED || ch.code in listOf(0x200B, 0x200C, 0x200D, 0xFEFF) ||
                type == Character.NON_SPACING_MARK.toInt() || type == Character.COMBINING_SPACING_MARK.toInt() ||
                type == Character.CONTROL.toInt()
            ) return@forEach
            append(ch)
        }
    }.trim().replace(Regex("\\s+"), " ")

    fun plain(text: String) = cleanup(text).replace('ٱ', 'ا')
    fun canonical(text: String): String = buildString {
        plain(text).forEach { ch -> append(when (ch.code) {
            0x0621, 0x0622, 0x0623, 0x0625, 0x0671 -> 'ا'
            0x0649, 0x0626 -> 'ي'
            0x0629 -> 'ه'
            0x0624 -> 'و'
            else -> ch
        }) }
    }
    fun imlai(canonical: String): String = orthographyRules.fold(canonical) { value, rule -> value.replace(rule.first, rule.second) }
    fun rasm(canonical: String) = canonical.filterNot { it in "اويه" }

    fun similarity(lhs: String, rhs: String): Double {
        if (lhs.isEmpty() || rhs.isEmpty()) return 0.0
        var previous = IntArray(rhs.length + 1) { it }
        lhs.forEachIndexed { i, left ->
            val current = IntArray(rhs.length + 1); current[0] = i + 1
            rhs.forEachIndexed { j, right -> current[j + 1] = min(min(current[j] + 1, previous[j + 1] + 1), previous[j] + if (left == right) 0 else 1) }
            previous = current
        }
        return 1.0 - previous[rhs.length].toDouble() / max(lhs.length, rhs.length)
    }
}

data class AyahSearchResult(
    val ayah: com.shazlka.qiraat.core.AyahKey,
    val page: Int,
    val text: String,
    val matchedWordIDs: List<String> = emptyList(),
    val wordIndex: Int = 0,
    val uthmaniWord: String = "",
    val matchedText: String = uthmaniWord,
    val matchType: QuranSearchMatchType = QuranSearchMatchType.PLAIN,
    val score: Int = 95,
)
