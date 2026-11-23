package com.shazlka.qiraat.reader

import com.shazlka.qiraat.core.*
import org.junit.Assert.*
import org.junit.Test

class QiraatCardAndFooterLogicTest {
    private val catalog = QiraatCatalog(
        schemaVersion = 1,
        source = "test",
        sourceUrl = null,
        fetchedAt = "now",
        pageCount = 604,
        readers = listOf(
            QiraatCatalog.Reader("Q01", "نافع المدني", "نافع", "#2563EB", 1),
            QiraatCatalog.Reader("Q06", "حمزة الكوفي", "حمزة", "#DC2626", 6),
            QiraatCatalog.Reader("Q10", "خلف العاشر", "خلف العاشر", "#7C3AED", 10)
        ),
        narrators = listOf(
            QiraatCatalog.Narrator("Q01-R01", "Q01", "قالون", "#60A5FA", 1),
            QiraatCatalog.Narrator("Q01-R02", "Q01", "ورش", "#1D4ED8", 2),
            QiraatCatalog.Narrator("Q06-R01", "Q06", "خلف", "#F87171", 1),
            QiraatCatalog.Narrator("Q06-R02", "Q06", "خلاد", "#B91C1C", 2)
        ),
        multiReaderColor = "#3F6212",
        performanceColor = "#4F46E5",
        unresolvedColor = "#8A8A8A"
    )

    @Test
    fun testAuthorityPillInitialAndCleanName() {
        val imam = AuthorityPill("Q01", "الإمام نافع", "#2563EB", AuthorityPill.Kind.READER)
        assertEquals("ن", imam.initial)
        assertEquals("نافع", imam.cleanName)

        val narrator = AuthorityPill("Q01-R01", "الراوي قالون", "#60A5FA", AuthorityPill.Kind.NARRATOR)
        assertEquals("ق", narrator.initial)
        assertEquals("قالون", narrator.cleanName)

        val warsh = AuthorityPill("Q01-R02", "الراوي ورش", "#1D4ED8", AuthorityPill.Kind.NARRATOR)
        assertEquals("و", warsh.initial)
        assertEquals("ورش", warsh.cleanName)
    }

    @Test
    fun testParentNameOfNarrator() {
        val qalun = AuthorityPill("Q01-R01", "الراوي قالون", "#60A5FA", AuthorityPill.Kind.NARRATOR)
        assertEquals("نافع", parentNameOf(qalun, catalog))

        val reader = AuthorityPill("Q01", "الإمام نافع", "#2563EB", AuthorityPill.Kind.READER)
        assertNull(parentNameOf(reader, catalog))

        val namedReader = AuthorityPill("Q03-R01", "الراوي الدوري عن أبي عمرو", "#000000", AuthorityPill.Kind.NARRATOR)
        assertNull(parentNameOf(namedReader, catalog))
    }

    @Test
    fun testVariantAttributionByActionGrouping() {
        val variant = QiraatVariant(
            id = "v1",
            surah = 1,
            ayah = 4,
            startToken = 1,
            hafsText = "مَـٰلِكِ",
            variantText = "مَلِكِ",
            readingIds = listOf("Q01-R01", "Q01-R02", "Q06-R01"),
            attribution = listOf(
                QiraatAttribution("Q01-R01", action = "بحذف الألف"),
                QiraatAttribution("Q01-R02", action = "بحذف الألف"),
                QiraatAttribution("Q06-R01", action = "بإثبات الألف")
            )
        )

        val groups = variant.attributionByAction(variant.readingIds, catalog)
        assertEquals(2, groups.size)
        assertEquals("بحذف الألف", groups[0].action)
        assertEquals(listOf("Q01-R01", "Q01-R02"), groups[0].entries.map { it.authorityId })
        assertEquals("بإثبات الألف", groups[1].action)
        assertEquals(listOf("Q06-R01"), groups[1].entries.map { it.authorityId })
    }

    @Test
    fun testRulingAttributionFilteringAndAlternate() {
        val ruling = QiraatRuling(
            id = "r1",
            category = "USUL_IMALAH",
            categoryAr = "الإمالة",
            color = "#EA580C",
            surah = 2,
            ayah = 1,
            startToken = 1,
            attribution = listOf(
                QiraatAttribution("Q01-R02", action = "تقليل"),
                QiraatAttribution("Q06-R01", action = "إمالة كبرى")
            ),
            readings = listOf(
                QiraatRulingReading("Q01-R02", action = "تقليل", isDefault = true),
                QiraatRulingReading("Q06-R01", action = "إمالة كبرى", isDefault = false)
            )
        )

        // Scoped to All
        val allGroups = ruling.attributionByAction(QiraatFilter.All, catalog)
        assertEquals(2, allGroups.size)
        assertTrue(ruling.hasAlternateReading(QiraatFilter.All, catalog))

        // Scoped to Reader Q01 (Nafie)
        val nafieGroups = ruling.attributionByAction(QiraatFilter.Reader("Q01"), catalog)
        assertEquals(1, nafieGroups.size)
        assertEquals("تقليل", nafieGroups[0].action)
        assertFalse(ruling.hasAlternateReading(QiraatFilter.Reader("Q01"), catalog))

        // Scoped to Reading Q06-R01 (Khalaf)
        val khalafGroups = ruling.attributionByAction(QiraatFilter.Reading("Q06-R01"), catalog)
        assertEquals(1, khalafGroups.size)
        assertEquals("إمالة كبرى", khalafGroups[0].action)
        assertTrue(ruling.hasAlternateReading(QiraatFilter.Reading("Q06-R01"), catalog))
    }

    @Test
    fun testQiraatClassificationPort() {
        val variant = QiraatVariant(
            id = "v1",
            surah = 1,
            ayah = 4,
            startToken = 1,
            hafsText = "مَـٰلِكِ",
            variantText = "مَلِكِ",
            differenceType = "OMISSION"
        )
        assertEquals("حذف حرف أو كلمة", QiraatClassification.subCategory(variant))
        assertEquals(
            "فرش الحروف › حذف حرف أو كلمة",
            QiraatClassification.classification(variant)
        )

        val ruling = QiraatRuling(
            id = "r1",
            category = "USUL_IMALAH",
            categoryAr = "الإمالة",
            surah = 2,
            ayah = 1,
            startToken = 1,
            subCategory = "إمالة الألف"
        )
        assertEquals("إمالة الألف", QiraatClassification.usulSubCategory(ruling))
        assertEquals(
            "أصول القراءات › الإمالة › إمالة الألف",
            QiraatClassification.classification(ruling)
        )
    }

    @Test
    fun testCatalogFilterNameAndUnambiguousName() {
        assertEquals("الكل", catalog.filterName(QiraatFilter.All))
        assertEquals("الإمام نافع", catalog.filterName(QiraatFilter.Reader("Q01")))
        assertEquals("الراوي قالون", catalog.filterName(QiraatFilter.Reading("Q01-R01")))

        // Narrator "خلف" clashes with reader "خلف العاشر", so unambiguousName appends "عن حمزة"
        val khalaf = catalog.narrator("Q06-R01")!!
        assertEquals("خلف عن حمزة", catalog.unambiguousName(khalaf))
        assertEquals("الراوي خلف عن حمزة", catalog.filterName(QiraatFilter.Reading("Q06-R01")))
    }
}
