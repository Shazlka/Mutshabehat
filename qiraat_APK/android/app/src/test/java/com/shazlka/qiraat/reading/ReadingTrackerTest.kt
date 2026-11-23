package com.shazlka.qiraat.reading

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.shazlka.qiraat.core.AyahKey
import com.shazlka.qiraat.core.MushafDatabase
import com.shazlka.qiraat.memorization.QuranIndex
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancel
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.File
import java.time.Instant

@RunWith(RobolectricTestRunner::class)
class ReadingTrackerTest {
    private lateinit var context: Context
    private lateinit var readingDbFile: File
    private lateinit var mushafDbFile: File
    private lateinit var readingDb: QuranReadingDatabase
    private lateinit var mushafDb: MushafDatabase
    private lateinit var quranIndex: QuranIndex
    private lateinit var scope: CoroutineScope
    private lateinit var tracker: ReadingTracker

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        readingDbFile = File(context.cacheDir, "test-tracker-${System.nanoTime()}.sqlite")
        readingDb = QuranReadingDatabase.open(readingDbFile)

        mushafDbFile = File(context.cacheDir, "test-mushaf-${System.nanoTime()}.sqlite")
        context.assets.open("data/mushaf.sqlite").use { input ->
            mushafDbFile.outputStream().use(input::copyTo)
        }
        mushafDb = MushafDatabase.open(mushafDbFile)
        quranIndex = QuranIndex.load(mushafDb)

        scope = CoroutineScope(Dispatchers.Unconfined)
        tracker = ReadingTracker(readingDb, scope)
    }

    @After
    fun tearDown() {
        scope.cancel()
        readingDb.close()
        mushafDb.close()
        readingDbFile.delete()
        mushafDbFile.delete()
    }

    @Test
    fun testManualPagesSessionLogging() {
        tracker.recordManualPageRangeSession(
            fromPage = 1,
            toPage = 10,
            sessionDate = Instant.now(),
            durationMinutes = 15,
            pageAyahsResolver = { page -> quranIndex.ayatOnPage(page) },
        )

        val totalSeconds = tracker.db.lifetimeReadingSeconds()
        val totalAyahs = tracker.db.lifetimeReadAyahsCount()
        assertTrue(totalSeconds >= 900)
        assertTrue(totalAyahs > 0)
    }

    @Test
    fun testBookmarkTogglingInTracker() {
        assertFalse(tracker.isPageBookmarked(10))
        tracker.togglePageBookmark(page = 10, surah = 2, ayah = 62)
        assertTrue(tracker.isPageBookmarked(10))

        tracker.togglePageBookmark(page = 10, surah = 2, ayah = 62)
        assertFalse(tracker.isPageBookmarked(10))
    }

    @Test
    fun testSurahCompletionToggle() {
        val surahAyahCounts = mapOf(1 to 7)

        tracker.markSurahCompleted(
            surahNumber = 1,
            completed = true,
            surahAyahCounts = surahAyahCounts,
            pageResolver = { surah, ayah -> 1 },
        )
        val readCount = tracker.db.readAyahsCountForSurah(tracker.activeKhatma.id, 1)
        assertEquals(7, readCount)

        tracker.markSurahCompleted(
            surahNumber = 1,
            completed = false,
            surahAyahCounts = surahAyahCounts,
            pageResolver = { surah, ayah -> 1 },
        )
        val readCountAfter = tracker.db.readAyahsCountForSurah(tracker.activeKhatma.id, 1)
        assertEquals(0, readCountAfter)
    }
}
