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
class MemorizationStoreTest {
    private lateinit var memoDbFile: File
    private lateinit var mushafDbFile: File
    private lateinit var memoDb: SQLiteMemorizationDatabase
    private lateinit var mushafDb: MushafDatabase
    private lateinit var index: QuranIndex
    private lateinit var store: MemorizationStore
    private var clock = Instant.ofEpochMilli(1_790_000_000_000L)

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        memoDbFile = File(context.cacheDir, "test-memo-store-${System.nanoTime()}.sqlite")
        memoDb = SQLiteMemorizationDatabase.open(memoDbFile)

        mushafDbFile = File(context.cacheDir, "test-mushaf-store-${System.nanoTime()}.sqlite")
        context.assets.open("data/mushaf.sqlite").use { input ->
            mushafDbFile.outputStream().use(input::copyTo)
        }
        mushafDb = MushafDatabase.open(mushafDbFile)
        index = QuranIndex.load(mushafDb)
        store = MemorizationStore(memoDb, index, clock = { clock })
    }

    @After
    fun tearDown() {
        memoDb.close()
        mushafDb.close()
        memoDbFile.delete()
        mushafDbFile.delete()
    }

    @Test
    fun testApplyPlanUpdatesRecordsAndSnapshots() {
        val selection = MemorizationSelection.AyahRange(surah = 1, from = 1, to = 7)
        val plan = MemorizationPlanner.planUpdate(
            selection = selection,
            label = "حفظ الفاتحة",
            status = MemorizationStatus.MASTERED,
            learning = false,
            records = store.allRecords,
            index = index,
            now = clock,
        )

        val result = store.apply(plan)
        assertNotNull(result.batch)

        // All 7 ayat in Al-Fatiha should now be MASTERED
        for (ayah in 1..7) {
            val record = store.record(AyahKey(1, ayah))
            assertNotNull(record)
            assertEquals(MemorizationStatus.MASTERED, record?.status)
        }

        val snapshot = store.snapshot
        assertTrue(snapshot.canReciteCount >= 7)
        assertTrue(snapshot.strictPercent > 0.0)
    }

    @Test
    fun testUndoBatchRestoresPreviousState() {
        val key = AyahKey(1, 1)
        val plan = MemorizationPlanner.planUpdate(
            selection = MemorizationSelection.AyahRange(1, 1, 1),
            label = "تحديث",
            status = MemorizationStatus.MEMORIZED_WITH_ERRORS,
            records = store.allRecords,
            index = index,
            now = clock,
        )
        val result = store.apply(plan)

        assertEquals(MemorizationStatus.MEMORIZED_WITH_ERRORS, store.record(key)?.status)

        // Undo the batch
        store.undo(result.batch.id, force = false)
        assertNull(store.record(key))
    }

    @Test
    fun testUndoConflictDetectionWhenSubsequentBatchTouchedSameAyah() {
        val key = AyahKey(1, 1)
        // Batch 1: status = MEMORIZED_WITH_ERRORS
        val r1 = store.apply(
            MemorizationPlanner.planUpdate(
                selection = MemorizationSelection.AyahRange(1, 1, 1),
                label = "batch1",
                status = MemorizationStatus.MEMORIZED_WITH_ERRORS,
                records = store.allRecords,
                index = index,
                now = clock,
            ),
        )

        // Batch 2: status = MASTERED
        clock = clock.plusSeconds(10)
        val r2 = store.apply(
            MemorizationPlanner.planUpdate(
                selection = MemorizationSelection.AyahRange(1, 1, 1),
                label = "batch2",
                status = MemorizationStatus.MASTERED,
                records = store.allRecords,
                index = index,
                now = clock,
            ),
        )

        // Attempting to undo b1 without force should throw HasNewerChanges
        try {
            store.undo(r1.batch.id, force = false)
            fail("Expected HasNewerChanges exception")
        } catch (e: MemorizationException.HasNewerChanges) {
            assertEquals(1, e.conflicts.size)
            assertEquals(r2.batch.id, e.conflicts.first().id)
        }

        // Undoing b1 with force succeeds
        store.undo(r1.batch.id, force = true)
        // Batch 1 is undone
        val b1 = store.database.batch(r1.batch.id)
        assertNotNull(b1?.undoneAt)
    }
}
