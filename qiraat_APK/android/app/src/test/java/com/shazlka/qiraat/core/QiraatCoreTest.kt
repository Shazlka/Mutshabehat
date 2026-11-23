package com.shazlka.qiraat.core

import org.junit.Assert.*
import org.junit.Test

class QiraatCoreTest {
    private val catalog = QiraatCatalog(1, "test", null, "now", 604,
        listOf(QiraatCatalog.Reader("Q01", "نافع المدني", "نافع", "#2563EB", 1), QiraatCatalog.Reader("Q06", "حمزة الكوفي", "حمزة", "#DC2626", 6)),
        listOf(QiraatCatalog.Narrator("Q01-R01", "Q01", "قالون", "#60A5FA", 1), QiraatCatalog.Narrator("Q01-R02", "Q01", "ورش", "#1D4ED8", 2),
            QiraatCatalog.Narrator("Q06-R01", "Q06", "خلف", "#F87171", 1), QiraatCatalog.Narrator("Q06-R02", "Q06", "خلاد", "#B91C1C", 2)),
        "#3F6212", "#4F46E5", "#8a8a8a")

    @Test fun crossAyahRulingUsesIosSpanRules() {
        val ruling = QiraatRuling("r", surah = 2, ayah = 5, startToken = 3, endToken = 2, endAyah = 7)
        assertTrue(ruling.touches(2, 5, 3)); assertFalse(ruling.touches(2, 5, 2))
        assertTrue(ruling.touches(2, 6, 40)); assertTrue(ruling.touches(2, 7, 2)); assertFalse(ruling.touches(2, 7, 3))
    }

    @Test fun markerRollsBothNarratorsUpToReaderColor() {
        val variant = QiraatVariant("v", 2, 3, 1, hafsText = "كلمة", variantText = "كلمه", readingIds = listOf("Q01-R01", "Q01-R02"))
        val marks = QiraatMarks(catalog, QiraatPageData(2, listOf(variant)))
        assertEquals(VariantStyle.Single("#2563EB"), marks.variantMarker(2, 3, 1, QiraatFilter.All)?.style)
        assertEquals("#2563EB", marks.wordMarks(2, 3, 1, QiraatFilter.All)?.textColor)
    }

    @Test fun multiReaderAndPerformanceFollowIosColors() {
        val multi = QiraatVariant("v", 2, 3, 1, hafsText = "أ", variantText = "ب", readingIds = listOf("Q01-R01", "Q06-R02"))
        val performance = QiraatVariant("p", 2, 3, 2, hafsText = "أ", variantText = "أ", readingIds = listOf("Q06-R01"))
        val marks = QiraatMarks(catalog, QiraatPageData(2, listOf(multi, performance)))
        assertEquals(VariantStyle.MultiReader(listOf("#2563EB", "#DC2626")), marks.variantMarker(2, 3, 1, QiraatFilter.All)?.style)
        assertEquals("#3F6212", marks.wordMarks(2, 3, 1, QiraatFilter.All)?.textColor)
        assertEquals("#4F46E5", marks.wordMarks(2, 3, 2, QiraatFilter.All)?.textColor)
    }

    @Test fun bikhilafUsesNarratorColorForDottedLine() {
        val variant = QiraatVariant("v", 2, 3, 1, hafsText = "أ", variantText = "ب", description = "بخلف عنه", readingIds = listOf("Q01-R02"))
        val mark = QiraatMarks(catalog, QiraatPageData(2, listOf(variant))).wordMarks(2, 3, 1, QiraatFilter.All)
        assertEquals(QiraatUnderline.Solid("#1D4ED8"), mark?.alternateUnderline)
    }

    @Test fun filterStorageAndArabicLabelsMatchIos() {
        assertEquals(QiraatFilter.Reading("Q01-R02"), QiraatFilter.fromStorage("reading:Q01-R02"))
        assertNull(QiraatFilter.fromStorage("reader:"))
        assertEquals("خلاف في الرسم", differenceTypeLabelAr("ORTHOGRAPHY"))
        assertEquals("غير مصنَّف", differenceTypeLabelAr("UNKNOWN"))
    }

    @Test fun authorityPillsStayInCanonicalReaderOrder() {
        assertEquals(listOf("الراوي ورش", "الإمام حمزة"), rollupAuthorityPills(listOf("Q06-R02", "Q01-R02", "Q06-R01"), catalog).map { it.name })
    }

    @Test fun pageTintIsExactlyFivePercent() {
        val mixed = QiraatPageTint.mixed(QiraatColor(1.0, 1.0, 1.0), QiraatColor(0.0, 0.0, 0.0))
        assertEquals(.95, mixed.red, .0001); assertEquals(.95, mixed.green, .0001)
    }

    @Test fun readingFormPortsIosSilatAndNaqlScalarRules() {
        assertFalse(QiraatReadingForm.display("أُو۟لَـٰٓئِكَ").contains('\u06DF'))
        val silat = requireNotNull(QiraatReadingForm.form("كَأَنَّهُمْ", "قرأ بصلة ميم الجمع وصلا.", "USUL_MIM_JAM"))
        assertTrue(silat.endsWith("\u06E5")); assertFalse(silat.contains('\u0652')); assertTrue(silat.contains("مُ"))
        val naql = requireNotNull(QiraatReadingForm.form("وَٱلْأَرْضَ", "قرأ بالنقل مع ترك السكت.", "USUL_SAKT"))
        assertFalse(naql.contains('أ')); assertTrue(naql.contains("لَ"))
        assertNull(QiraatReadingForm.form("وَٱلْأَرْضَ", "قرأ بالسكت وصلاً، ووقف بالسكت والنقل.", "USUL_SAKT"))
    }

    @Test fun readingFormPortsIosCrossWordNaql() {
        val form = requireNotNull(QiraatReadingForm.form("مِنْ", "قرأ بالنقل وصلاً ووقفا.", "USUL_NAQL", nextWord = "ءَامَنَ"))
        assertTrue(form.contains(' ')); assertFalse(form.contains('\u0652')); assertFalse(form.contains('ء'))
        assertNotNull(QiraatReadingForm.form("أَفْلَحَ", "قرأ بالنقل وصلاً ووقفا.", "USUL_NAQL", previousWord = "قَدْ"))
        assertNull(QiraatReadingForm.form("عَذَابٌ", "قرأ بالنقل وصلاً ووقفا.", "USUL_SAKT", nextWord = "أَلِيمٌ"))
    }
}
