package com.shazlka.qiraat.search

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.shazlka.qiraat.core.MushafDatabase
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.File

@RunWith(RobolectricTestRunner::class)
class QuranSearchDatabaseTest {
    private lateinit var database: MushafDatabase
    private lateinit var file: File

    @Before fun open() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        file = File(context.cacheDir, "search-${System.nanoTime()}.sqlite")
        context.assets.open("data/mushaf.sqlite").use { input -> file.outputStream().use(input::copyTo) }
        database = MushafDatabase.open(file)
    }
    @After fun close() { database.close(); file.delete() }

    @Test fun smartAndPhraseSearchRealQuranIndex() {
        assertTrue(database.searchAyaat("الصلاة").isNotEmpty())
        val phrase = database.searchAyaat("ان الله غفور رحيم")
        assertTrue(phrase.isNotEmpty())
        assertTrue(phrase.all { it.matchedWordIDs.size == 4 })
    }

    @Test fun advancedQueriesMatchIOSReferenceCases() {
        assertTrue(database.searchAyaat("ك_آ:[129 الى 200]").any { it.ayah.surah == 2 && it.ayah.ayah == 282 })
        assertEquals(15, database.searchAyaat("(سجدة:نعم)", limit = 100).size)
        assertEquals(4, database.searchAyaat("(سجدة:نعم) و نوع_السجدة:واجبة", limit = 100).size)
        assertTrue(database.searchAyaat("\"لا يحب\"").isNotEmpty())
        assertTrue(database.searchAyaat("(><توب) و (><غفر)").isNotEmpty())
        assertTrue(database.searchAyaat("(ج_آ:7) و >الله").any { it.ayah.surah == 73 && it.ayah.ayah == 20 })
        assertEquals(28, database.searchAyaat("نوع_السورة:مدنية و رقم_الآية:1", limit = 100).size)
        assertEquals(96, database.searchAyaat("رقم_السورة:[1 الى 114] و رقم_الآية:1", limit = 114).first().ayah.surah)
        assertTrue(database.searchAyaat("الم المص الر المر كهيعص طه طسم طس يس ص حم عسق ق ن", limit = 50).size >= 20)
        assertTrue(database.searchAyaat("خوف و يحزنون").any { it.ayah.surah == 2 && it.ayah.ayah == 38 })
    }
}
