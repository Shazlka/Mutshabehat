package com.shazlka.qiraat.reading

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.File
import java.time.Instant
import java.time.temporal.ChronoUnit

@RunWith(RobolectricTestRunner::class)
class ReadingDatabaseTest {
    private lateinit var database: QuranReadingDatabase
    private lateinit var dbFile: File

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        dbFile = File(context.cacheDir, "test-reading-${System.nanoTime()}.sqlite")
        database = QuranReadingDatabase.open(dbFile)
    }

    @After
    fun tearDown() {
        database.close()
        dbFile.delete()
    }

    @Test
    fun testAddAndQueryBookmarks() {
        // Add ayah bookmark
        database.addBookmark(type = BookmarkType.AYAH, surah = 2, ayah = 255, page = 42, note = "Ayat Al-Kursi")
        // Add page bookmark
        database.addBookmark(type = BookmarkType.PAGE, surah = 3, ayah = 1, page = 50, note = null)

        val all = database.allBookmarks()
        assertEquals(2, all.size)

        val ayahsOnly = database.allBookmarks(type = BookmarkType.AYAH)
        assertEquals(1, ayahsOnly.size)
        assertEquals(2, ayahsOnly.first().surah)
        assertEquals(255, ayahsOnly.first().ayah)
        assertEquals(42, ayahsOnly.first().page)
        assertEquals("Ayat Al-Kursi", ayahsOnly.first().note)

        val pagesOnly = database.allBookmarks(type = BookmarkType.PAGE)
        assertEquals(1, pagesOnly.size)
        assertEquals(50, pagesOnly.first().page)
    }

    @Test
    fun testBookmarkDuplicatePrevention() {
        database.addBookmark(type = BookmarkType.AYAH, surah = 18, ayah = 1, page = 293, note = "Surah Al-Kahf")
        database.addBookmark(type = BookmarkType.AYAH, surah = 18, ayah = 1, page = 293, note = "Updated Note")

        val all = database.allBookmarks(type = BookmarkType.AYAH)
        assertEquals(1, all.size)
        assertEquals("Updated Note", all.first().note)
    }

    @Test
    fun testRemoveBookmark() {
        database.addBookmark(type = BookmarkType.AYAH, surah = 36, ayah = 1, page = 440)
        assertTrue(database.isAyahBookmarked(surah = 36, ayah = 1))

        database.removeBookmark(type = BookmarkType.AYAH, surah = 36, ayah = 1, page = 440)
        assertFalse(database.isAyahBookmarked(surah = 36, ayah = 1))
        assertEquals(0, database.allBookmarks().size)
    }

    @Test
    fun testRemovingPageBookmarkWorksFromAnyAyahOnThePage() {
        database.addBookmark(type = BookmarkType.PAGE, surah = 2, ayah = 30, page = 5)
        assertTrue(database.isPageBookmarked(page = 5))

        database.removeBookmark(type = BookmarkType.PAGE, surah = 2, ayah = 31, page = 5)
        assertFalse(database.isPageBookmarked(page = 5))
        assertEquals(0, database.allBookmarks().size)
    }

    @Test
    fun testKhatmaLifecycle() {
        val active = database.getOrCreateActiveKhatma()
        assertNotNull(active)
        assertEquals(1, active.khatmaNumber)
        assertFalse(active.isCompleted)

        // Record reading 5 ayahs
        val ayahs = listOf(
            Triple(1, 1, 1),
            Triple(1, 2, 1),
            Triple(1, 3, 1),
            Triple(1, 4, 1),
            Triple(1, 5, 1),
        )
        database.recordReadAyahs(active.id, ayahs)
        val readCount = database.readAyahsCount(active.id)
        assertEquals(5, readCount)

        // Complete khatma
        val completed = database.completeActiveKhatma(active.id)
        assertNotNull(completed)
        assertEquals(1, database.completedKhatmasCount())
    }

    @Test
    fun testDailyStreakCalculation() {
        val now = Instant.now()
        // Record 3 consecutive days: today, yesterday, 2 days ago
        database.recordDailyReadingActivity(ayahsCount = 10, pagesCount = 1, seconds = 600, on = now)
        database.recordDailyReadingActivity(ayahsCount = 10, pagesCount = 1, seconds = 500, on = now.minus(1, ChronoUnit.DAYS))
        database.recordDailyReadingActivity(ayahsCount = 10, pagesCount = 1, seconds = 700, on = now.minus(2, ChronoUnit.DAYS))

        val (current, longest, total) = database.calculateStreaks(now)
        assertEquals(3, current)
        assertEquals(3, longest)
        assertEquals(3, total)
    }

    @Test
    fun testReadingActivityAndLifetimeStats() {
        val now = Instant.now()
        val active = database.getOrCreateActiveKhatma()
        database.recordReadAyahs(active.id, listOf(Triple(1, 1, 1), Triple(1, 2, 1)))
        database.recordDailyReadingActivity(ayahsCount = 15, pagesCount = 2, seconds = 120, on = now)
        database.recordDailyReadingActivity(ayahsCount = 20, pagesCount = 3, seconds = 180, on = now)

        assertEquals(300, database.lifetimeReadingSeconds())
        assertEquals(2, database.lifetimeReadAyahsCount())
    }
}
