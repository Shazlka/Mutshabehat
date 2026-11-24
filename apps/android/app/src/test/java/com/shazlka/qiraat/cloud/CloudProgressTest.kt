package com.shazlka.qiraat.cloud

import com.shazlka.qiraat.memorization.SQLiteMemorizationDatabase
import com.shazlka.qiraat.reading.QuranReadingDatabase
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.File
import java.time.Instant

@RunWith(RobolectricTestRunner::class)
class CloudProgressTest {
    @get:Rule val folder = TemporaryFolder()

    @Test
    fun khatmaRoundTripPreservesReadAyahs() {
        QuranReadingDatabase.open(File(folder.root, "source.sqlite")).use { source ->
            QuranReadingDatabase.open(File(folder.root, "target.sqlite")).use { target ->
                val active = source.getOrCreateActiveKhatma()
                source.recordReadAyahs(active.id, listOf(Triple(1, 1, 1)), Instant.parse("2026-11-24T02:00:00Z"))
                val snapshot = source.cloudSnapshot()
                val decoded = ProgressDataset.KHATMA.decode(ProgressDataset.KHATMA.encode(snapshot))
                assertEquals(snapshot, target.cloudSnapshot(decoded))
                assertEquals(1, target.readAyahsCount(active.id))
            }
        }
    }

    @Test
    fun invalidMemorizationSnapshotRollsBackAndKeepsDeviceIdentity() {
        SQLiteMemorizationDatabase.open(File(folder.root, "memorization.sqlite")).use { database ->
            val device = database.deviceID
            val original = database.cloudSnapshot() + ("memorization_goals" to listOf(listOf("goal-1", "{}")))
            assertEquals(original, database.cloudSnapshot(original))

            val invalid = original + ("memorization_meta" to listOf(listOf("device_id", "other-device")))
            assertThrows(IllegalArgumentException::class.java) { database.cloudSnapshot(invalid) }
            assertEquals(original, database.cloudSnapshot())
            assertEquals(device, database.deviceID)
        }
    }
}
