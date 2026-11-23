package com.shazlka.qiraat.mutshabehat

import org.junit.Assert.*
import org.junit.Test

class ArabicDiffTest {
    @Test fun stripsTashkeelAndNormalizesArabic() {
        assertEquals("الرحمان", ArabicDiff.stripTashkeel("الرَّحْمَـٰن"))
        assertEquals("ايمان", ArabicDiff.normalizeArabic("إِيمَان"))
        assertEquals("فتاه", ArabicDiff.normalizeArabic("فَتَاة"))
    }

    @Test fun levenshteinMatchesIOSRules() {
        assertEquals(0, ArabicDiff.levenshtein("كتاب", "كتاب"))
        assertEquals(2, ArabicDiff.levenshtein("قال", "قالوا"))
        assertEquals(Int.MAX_VALUE, ArabicDiff.levenshtein("أ", "abcdefgh", cap = 4))
    }

    @Test fun identicalWordsStayShared() {
        val tokens = ArabicDiff.computeWordDiff("قال الله", "قال الله")
        assertEquals(2, tokens.size)
        assertTrue(tokens.all { it.status == ArabicDiff.Status.Same })
    }

    @Test fun autoColorCreatesSharedAndDifferingParts() {
        val (first, second) = ArabicDiff.autoColorPair("فأخذتهم الرجفة فأصبحوا", "فأخذتهم الصيحة فأصبحوا")
        assertEquals(listOf("shared", "diff", "shared"), first.map { it.type })
        assertEquals(listOf("shared", "diff", "shared"), second.map { it.type })
        assertEquals("الرجفة", first[1].text)
        assertEquals("الصيحة", second[1].text)
    }
}
