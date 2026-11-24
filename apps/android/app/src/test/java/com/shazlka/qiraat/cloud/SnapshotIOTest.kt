package com.shazlka.qiraat.cloud

import android.database.sqlite.SQLiteDatabase
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/** The database layouts found on real devices: they must neither fail to sync nor swap values between devices. */
@RunWith(RobolectricTestRunner::class)
class SnapshotIOTest {
    private fun database(readingDaysSwapped: Boolean, olderDeletions: Boolean): SQLiteDatabase {
        val db = SQLiteDatabase.create(null)
        db.execSQL("CREATE TABLE khatmas (id TEXT PRIMARY KEY, khatma_number INTEGER NOT NULL, started_at TEXT NOT NULL, completed_at TEXT, status TEXT NOT NULL, percent_complete REAL NOT NULL DEFAULT 0.0)")
        db.execSQL("CREATE TABLE khatma_read_ayahs (khatma_id TEXT NOT NULL, surah INTEGER NOT NULL, ayah INTEGER NOT NULL, page INTEGER NOT NULL, read_at TEXT NOT NULL, PRIMARY KEY (khatma_id, surah, ayah))")
        db.execSQL(
            if (readingDaysSwapped)
                "CREATE TABLE reading_days (date_string TEXT PRIMARY KEY, ayahs_read INTEGER NOT NULL, pages_read INTEGER NOT NULL, last_read_at TEXT NOT NULL, seconds_read INTEGER NOT NULL DEFAULT 0)"
            else
                "CREATE TABLE reading_days (date_string TEXT PRIMARY KEY, ayahs_read INTEGER NOT NULL, pages_read INTEGER NOT NULL, seconds_read INTEGER NOT NULL DEFAULT 0, last_read_at TEXT NOT NULL)",
        )
        db.execSQL("CREATE TABLE reading_days_legacy (date_string TEXT PRIMARY KEY, ayahs_read INTEGER NOT NULL, pages_read INTEGER NOT NULL, seconds_read INTEGER NOT NULL, last_read_at TEXT NOT NULL)")
        db.execSQL("CREATE TABLE reading_activity_events (id TEXT PRIMARY KEY, date_string TEXT NOT NULL, ayahs_read INTEGER NOT NULL, pages_read INTEGER NOT NULL, seconds_read INTEGER NOT NULL, recorded_at TEXT NOT NULL)")
        db.execSQL(
            if (olderDeletions)
                "CREATE TABLE reading_deletions (id TEXT PRIMARY KEY, table_name TEXT NOT NULL, record_id TEXT NOT NULL, deleted_at TEXT NOT NULL)"
            else
                "CREATE TABLE reading_deletions (kind TEXT NOT NULL, khatma_number INTEGER NOT NULL DEFAULT 0, surah INTEGER NOT NULL, ayah INTEGER NOT NULL DEFAULT 0, page INTEGER NOT NULL DEFAULT 0, deleted_at TEXT NOT NULL, PRIMARY KEY(kind, khatma_number, surah, ayah, page))",
        )
        return db
    }

    private val days = listOf("2026-10-02", "518", "81", "30", "2026-10-02T11:35:39.192Z")

    private fun empty() = ProgressDataset.KHATMA.tables.associateWith { emptyList<List<String?>>() }

    @Test
    fun valuesKeepTheirMeaningWhateverTheColumnOrder() {
        for (swapped in listOf(false, true)) {
            val db = database(readingDaysSwapped = swapped, olderDeletions = false)
            SnapshotIO.replace(ProgressDataset.KHATMA, db, empty() + ("reading_days" to listOf<List<String?>>(days)))
            assertEquals(days, SnapshotIO.capture(ProgressDataset.KHATMA, db).getValue("reading_days").single())
            val stored = db.rawQuery("SELECT seconds_read, last_read_at FROM reading_days", null).use {
                it.moveToFirst(); it.getString(0) to it.getString(1)
            }
            assertEquals("30" to "2026-10-02T11:35:39.192Z", stored)
        }
    }

    @Test
    fun olderDeletionTableDoesNotBreakTheExchangeAndIsKept() {
        val db = database(readingDaysSwapped = false, olderDeletions = true)
        db.execSQL("INSERT INTO reading_deletions VALUES ('x', 'khatma_read_ayahs', 'k|1|1', '2026-11-01T00:00:00Z')")
        assertFalse(SnapshotIO.usable(db, "reading_deletions"))
        assertTrue(SnapshotIO.capture(ProgressDataset.KHATMA, db).getValue("reading_deletions").isEmpty())

        val cloudDeletion = listOf<List<String?>>(listOf("bookmark:page", "0", "101", "2", "600", "2026-11-10T15:53:38.798Z"))
        SnapshotIO.replace(ProgressDataset.KHATMA, db, empty() + ("reading_deletions" to cloudDeletion))
        // The device's own records are untouched and nothing was written in the wrong shape.
        assertEquals(1L, db.rawQuery("SELECT count(*) FROM reading_deletions WHERE id = 'x'", null).use { it.moveToFirst(); it.getLong(0) })
    }

    @Test
    fun aRowWithTheWrongNumberOfValuesIsRejectedAndNothingChanges() {
        val db = database(readingDaysSwapped = false, olderDeletions = false)
        db.execSQL("INSERT INTO reading_days VALUES ('2026-01-01', 1, 1, 5, '2026-01-01T00:00:00Z')")
        val bad = empty() + ("reading_days" to listOf<List<String?>>(listOf("2026-10-02", "1")))
        assertThrows(IllegalArgumentException::class.java) { SnapshotIO.replace(ProgressDataset.KHATMA, db, bad) }
        assertEquals(1L, db.rawQuery("SELECT count(*) FROM reading_days WHERE date_string = '2026-01-01'", null).use { it.moveToFirst(); it.getLong(0) })
    }
}
