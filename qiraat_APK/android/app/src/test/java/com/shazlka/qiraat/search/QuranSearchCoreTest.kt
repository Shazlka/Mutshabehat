package com.shazlka.qiraat.search

import org.junit.Assert.*
import org.junit.Test

class QuranSearchCoreTest {
    @Test fun normalizerMatchesIOSLevels() {
        val value = QuranSearchNormalizer.query("ٱلصَّلَوٰةَ")
        assertEquals("الصلوة", value.plain)
        assertEquals("الصلوه", value.canonical)
        assertEquals("الصلاه", value.imlai)
        assertEquals("لح", QuranSearchNormalizer.query("الحياة").rasmKey)
    }

    @Test fun parserOrdersReversedRanges() {
        assertEquals(2..10, (AdvancedQuranQueryParser.parse("رقم_السورة:[10 الى 2]") as AdvancedQueryNode.SurahNumber).range)
        assertEquals(1..7, (AdvancedQuranQueryParser.parse("رقم_الآية:[7 الى 1]") as AdvancedQueryNode.AyahNumber).range)
    }

    @Test fun parserPortsFieldsMorphologyAndBooleanAST() {
        val node = AdvancedQuranQueryParser.parse("نوع_السورة:مكية و >صلاة") as AdvancedQueryNode.And
        assertTrue(node.children[0] is AdvancedQueryNode.SurahType)
        assertEquals(AdvancedQueryNode.WordDerivatives("صلاة", false), node.children[1])
        assertTrue(AdvancedQuranQueryParser.parse("{ملك،اسم}") is AdvancedQueryNode.WordProperty)
        assertTrue(AdvancedQuranQueryParser.parse("\"رب العالمين\"") is AdvancedQueryNode.ExactPhrase)
    }

    @Test fun morphologyIsFullIOSLexicon() {
        assertEquals(161, AdvancedQuranMorphology.wordEntries.size)
        assertTrue("قالوا" in AdvancedQuranMorphology.derivatives("قول", true))
        assertTrue("الصابرين" in AdvancedQuranMorphology.derivatives("صبر", true))
        assertTrue("الله" in AdvancedQuranMorphology.words("اله", QuranPartOfSpeech.NOUN))
    }
}
