package com.shazlka.qiraat.mutshabehat

import java.util.UUID
import kotlin.math.abs
import kotlin.math.min

object ArabicDiff {
    fun stripTashkeel(value: String): String = buildString {
        value.replace('ٰ', 'ا').forEach { ch ->
            if (ch.code !in 0x064B..0x065F && ch.code !in 0x06D6..0x06ED && ch.code != 0x0640) append(ch)
        }
    }

    fun normalizeArabic(value: String): String = buildString {
        stripTashkeel(value).forEach { ch ->
            append(when (ch.code) {
                0x0621, 0x0622, 0x0623, 0x0625, 0x0671 -> 'ا'
                0x0649, 0x0626 -> 'ي'
                0x0629 -> 'ه'
                0x0624 -> 'و'
                else -> ch
            })
        }
    }.trim()

    fun levenshtein(a: String, b: String, cap: Int = 4): Int {
        if (abs(a.length - b.length) > cap) return Int.MAX_VALUE
        if (a.isEmpty()) return b.length
        if (b.isEmpty()) return a.length
        var previous = IntArray(b.length + 1) { it }
        for (i in a.indices) {
            val current = IntArray(b.length + 1)
            current[0] = i + 1
            for (j in b.indices) {
                current[j + 1] = min(min(current[j] + 1, previous[j + 1] + 1), previous[j] + if (a[i] == b[j]) 0 else 1)
            }
            previous = current
        }
        return previous[b.length]
    }

    sealed interface Status {
        data object Same : Status
        data object Added : Status
        data object Removed : Status
        data class Changed(val oldWord: String) : Status
    }
    data class WordToken(val word: String, val status: Status)

    fun computeWordDiff(textA: String, textB: String): List<WordToken> {
        val wordsA = textA.trim().split(Regex("\\s+")).filter(String::isNotEmpty)
        val wordsB = textB.trim().split(Regex("\\s+")).filter(String::isNotEmpty)
        val a = wordsA.map(::normalizeArabic)
        val b = wordsB.map(::normalizeArabic)
        val dp = Array(a.size + 1) { IntArray(b.size + 1) }
        for (i in 1..a.size) for (j in 1..b.size) {
            dp[i][j] = if (a[i - 1] == b[j - 1]) dp[i - 1][j - 1] + 1 else maxOf(dp[i - 1][j], dp[i][j - 1])
        }
        val raw = mutableListOf<WordToken>()
        var i = a.size
        var j = b.size
        while (i > 0 || j > 0) {
            when {
                i > 0 && j > 0 && a[i - 1] == b[j - 1] -> { raw += WordToken(wordsA[i - 1], Status.Same); i--; j-- }
                j > 0 && (i == 0 || dp[i][j - 1] >= dp[i - 1][j]) -> { raw += WordToken(wordsB[j - 1], Status.Added); j-- }
                i > 0 -> { raw += WordToken(wordsA[i - 1], Status.Removed); i-- }
            }
        }
        raw.reverse()
        return buildList {
            var k = 0
            while (k < raw.size) {
                val current = raw[k]
                val next = raw.getOrNull(k + 1)
                if (current.status == Status.Removed && next?.status == Status.Added &&
                    levenshtein(normalizeArabic(current.word), normalizeArabic(next.word)) <= 3
                ) {
                    add(WordToken(next.word, Status.Changed(current.word))); k += 2
                } else { add(current); k++ }
            }
        }
    }

    fun autoColorPair(textA: String, textB: String): Pair<List<PersonalPart>, List<PersonalPart>> {
        val a = mutableListOf<PersonalPart>()
        val b = mutableListOf<PersonalPart>()
        computeWordDiff(textA, textB).forEach { token ->
            when (val status = token.status) {
                Status.Same -> { a += part("shared", token.word); b += part("shared", token.word) }
                Status.Removed -> a += part("unique", token.word)
                Status.Added -> b += part("addition", token.word)
                is Status.Changed -> { a += part("diff", status.oldWord); b += part("diff", token.word) }
            }
        }
        return mergeAdjacent(a) to mergeAdjacent(b)
    }

    private fun part(type: String, text: String) = PersonalPart(UUID.randomUUID().toString(), type, text)
    private fun mergeAdjacent(parts: List<PersonalPart>): List<PersonalPart> = buildList {
        parts.forEach { part ->
            val last = lastOrNull()
            if (last?.type == part.type) set(lastIndex, last.copy(text = "${last.text} ${part.text}".trim()))
            else add(part.copy(sortOrder = size))
        }
    }
}
