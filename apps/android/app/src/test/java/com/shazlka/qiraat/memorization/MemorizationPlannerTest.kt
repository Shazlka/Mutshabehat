package com.shazlka.qiraat.memorization

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.shazlka.qiraat.core.AyahKey
import com.shazlka.qiraat.core.MushafDatabase
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.File
import java.time.Instant

@RunWith(RobolectricTestRunner::class)
class MemorizationPlannerTest {
    private lateinit var mushafDbFile: File
    private lateinit var mushafDb: MushafDatabase
    private lateinit var index: QuranIndex
    private val now = Instant.ofEpochMilli(1_790_000_000_000L)

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        mushafDbFile = File(context.cacheDir, "test-memo-mushaf-${System.nanoTime()}.sqlite")
        context.assets.open("data/mushaf.sqlite").use { input ->
            mushafDbFile.outputStream().use(input::copyTo)
        }
        mushafDb = MushafDatabase.open(mushafDbFile)
        index = QuranIndex.load(mushafDb)
    }

    @After
    fun tearDown() {
        mushafDb.close()
        mushafDbFile.delete()
    }

    private fun key(surah: Int, ayah: Int) = AyahKey(surah, ayah)

    private fun record(
        key: AyahKey,
        status: MemorizationStatus,
        learning: Boolean = false,
        first: Instant? = null,
    ): AyahMemorizationRecord {
        return AyahMemorizationRecord.blank(key, now.minusSeconds(1000)).copy(
            status = status,
            isCurrentlyLearning = learning,
            firstMemorizedAt = first,
        )
    }

    private fun plan(
        selection: MemorizationSelection,
        status: MemorizationStatus,
        learning: Boolean? = null,
        records: Map<AyahKey, AyahMemorizationRecord> = emptyMap(),
    ): BatchPlan {
        return MemorizationPlanner.planUpdate(
            selection = selection,
            label = "test",
            status = status,
            learning = learning,
            records = records,
            index = index,
            now = now,
        )
    }

    @Test
    fun testPlansOnlyChangedAyat() {
        val records = mutableMapOf<AyahKey, AyahMemorizationRecord>()
        for (ayah in 1..2) {
            records[key(1, ayah)] = record(key(1, ayah), MemorizationStatus.MASTERED)
        }
        val result = plan(MemorizationSelection.Surah(1), MemorizationStatus.MASTERED, records = records)
        assertEquals(7, result.selectionCount)
        assertEquals(5, result.changes.size)
        assertEquals(2, result.unchangedCount)
        assertEquals(BatchKind.UPDATE, result.kind)
        assertEquals("test", result.label)
        assertTrue(result.changes.all { it.after.status == MemorizationStatus.MASTERED && it.before == null })
    }

    @Test
    fun testSameStatusIsNoOpEvenWithLearningNil() {
        val k = key(1, 1)
        val result = plan(
            selection = MemorizationSelection.AyahRange(surah = 1, from = 1, to = 1),
            status = MemorizationStatus.MASTERED,
            records = mapOf(k to record(k, MemorizationStatus.MASTERED, learning = true)),
        )
        assertTrue(result.changes.isEmpty())
        assertEquals(1, result.unchangedCount)
    }

    @Test
    fun testNotMemorizedOnUntouchedAyahCreatesNoRow() {
        val result = plan(MemorizationSelection.Surah(1), MemorizationStatus.NOT_MEMORIZED)
        assertTrue(result.changes.isEmpty())
    }

    @Test
    fun testFirstMemorizedAtIsSetOnceAndKept() {
        val k = key(2, 5)
        val withErrors = plan(
            selection = MemorizationSelection.AyahRange(surah = 2, from = 5, to = 5),
            status = MemorizationStatus.MEMORIZED_WITH_ERRORS,
        ).changes[0].after
        assertEquals(now, withErrors.firstMemorizedAt)

        val records = mutableMapOf(k to withErrors)
        val later = now.plusSeconds(500)
        val mastered = MemorizationPlanner.planUpdate(
            selection = MemorizationSelection.AyahRange(surah = 2, from = 5, to = 5),
            label = "t",
            status = MemorizationStatus.MASTERED,
            learning = null,
            records = records,
            index = index,
            now = later,
        ).changes[0].after
        assertEquals(now, mastered.firstMemorizedAt)
        assertEquals(later, mastered.lastStatusChangedAt)

        records[k] = mastered
        val down = MemorizationPlanner.planUpdate(
            selection = MemorizationSelection.AyahRange(surah = 2, from = 5, to = 5),
            label = "t",
            status = MemorizationStatus.NOT_MEMORIZED,
            learning = null,
            records = records,
            index = index,
            now = later.plusSeconds(500),
        ).changes[0].after
        assertEquals(now, down.firstMemorizedAt)
        assertEquals(MemorizationStatus.NOT_MEMORIZED, down.status)
    }

    @Test
    fun testNeedsMushafDoesNotSetFirstMemorized() {
        val after = plan(
            selection = MemorizationSelection.AyahRange(surah = 2, from = 5, to = 5),
            status = MemorizationStatus.NEEDS_MUSHAF,
        ).changes[0].after
        assertNull(after.firstMemorizedAt)
        assertEquals(now, after.lastStatusChangedAt)
    }

    @Test
    fun testMasteredClearsLearningFlag() {
        val k = key(36, 1)
        val initial = record(k, MemorizationStatus.MEMORIZED_WITH_ERRORS, learning = true)
        val after = plan(
            selection = MemorizationSelection.AyahRange(surah = 36, from = 1, to = 1),
            status = MemorizationStatus.MASTERED,
            records = mapOf(k to initial),
        ).changes[0].after
        assertFalse(after.isCurrentlyLearning)
        assertEquals(MemorizationStatus.MASTERED, after.status)
    }

    @Test
    fun testPlanReviewAdvancesIntervals() {
        val k = key(1, 1)
        val initial = record(k, MemorizationStatus.MASTERED)
        val reviewed = MemorizationPlanner.planReview(
            selection = MemorizationSelection.AyahRange(1, 1, 1),
            label = "مراجعة",
            result = ReviewResult.EXCELLENT,
            records = mapOf(k to initial),
            index = index,
            now = now,
        ).changes[0].after

        assertEquals(1, reviewed.reviewCount)
        assertEquals(now, reviewed.lastReviewedAt)
        assertEquals(ReviewStrength.STRONG, reviewed.reviewStrength)
        assertNotNull(reviewed.nextReviewAt)
        assertTrue(reviewed.nextReviewAt!!.isAfter(now))
    }
}
