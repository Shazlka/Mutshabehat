package com.shazlka.qiraat.backup

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.shazlka.qiraat.core.AyahKey
import com.shazlka.qiraat.core.MushafDatabase
import com.shazlka.qiraat.memorization.*
import com.shazlka.qiraat.mutshabehat.SQLiteMutshabehatStore
import com.shazlka.qiraat.reading.QuranReadingDatabase
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.File
import java.time.Instant
import java.util.UUID

@RunWith(RobolectricTestRunner::class)
class BackupServiceTest {
    private lateinit var context: Context
    private lateinit var mushafDbFile: File
    private lateinit var memoDbFile: File
    private lateinit var readingDbFile: File
    private lateinit var mutDbFile: File

    private lateinit var mushafDb: MushafDatabase
    private lateinit var memoDb: SQLiteMemorizationDatabase
    private lateinit var readingDb: QuranReadingDatabase
    private lateinit var mutDb: SQLiteMutshabehatStore

    private lateinit var index: QuranIndex
    private lateinit var store: MemorizationStore
    private lateinit var service: BackupService
    private val t0 = Instant.ofEpochMilli(1_790_000_000_000L)

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        mushafDbFile = File(context.cacheDir, "test-backup-mushaf-${System.nanoTime()}.sqlite")
        context.assets.open("data/mushaf.sqlite").use { input ->
            mushafDbFile.outputStream().use(input::copyTo)
        }
        mushafDb = MushafDatabase.open(mushafDbFile)
        index = QuranIndex.load(mushafDb)

        memoDbFile = File(context.cacheDir, "test-backup-memo-${System.nanoTime()}.sqlite")
        memoDb = SQLiteMemorizationDatabase.open(memoDbFile)
        readingDbFile = File(context.cacheDir, "test-backup-reading-${System.nanoTime()}.sqlite")
        readingDb = QuranReadingDatabase.open(readingDbFile)
        mutDbFile = File(context.cacheDir, "test-backup-mut-${System.nanoTime()}.sqlite")
        mutDb = SQLiteMutshabehatStore.open(mutDbFile)

        store = MemorizationStore(memoDb, index, clock = { t0 })
        service = BackupService(store, readingDb, mutDb)
    }

    @After
    fun tearDown() {
        memoDb.close()
        readingDb.close()
        mutDb.close()
        mushafDb.close()
        mushafDbFile.delete()
        memoDbFile.delete()
        readingDbFile.delete()
        mutDbFile.delete()
    }

    private fun at(seconds: Long): Instant = t0.plusSeconds(seconds)

    private fun record(
        surah: Int,
        ayah: Int,
        status: MemorizationStatus,
        updated: Instant,
    ): AyahMemorizationRecord {
        return AyahMemorizationRecord.blank(AyahKey(surah, ayah), updated).copy(status = status)
    }

    private fun batch(
        id: UUID,
        created: Instant,
        undone: Instant? = null,
    ): BatchRecord {
        return BatchRecord(
            id = id,
            createdAt = created,
            kind = BatchKind.UPDATE,
            label = "x",
            scopeJSON = "{}",
            ayahCount = 1,
            deviceID = "d",
            countsForStreak = true,
            gainAyahs = 1,
            undoneAt = undone,
            undoesBatchID = null,
        )
    }

    private fun event(
        batchId: UUID,
        surah: Int,
        ayah: Int,
        time: Instant,
    ): ChangeEvent {
        return ChangeEvent(
            batchID = batchId,
            surah = surah,
            ayah = ayah,
            at = time,
            before = null,
            after = record(surah, ayah, MemorizationStatus.MASTERED, time),
        )
    }

    private fun export(
        records: List<AyahMemorizationRecord> = emptyList(),
        batches: List<BatchRecord> = emptyList(),
        events: List<ChangeEvent> = emptyList(),
        goals: List<GoalDefinition> = emptyList(),
        meta: Map<String, String> = emptyMap(),
        device: String = "local",
    ): MemorizationExport {
        return MemorizationExport(
            formatVersion = 1,
            exportedAt = t0,
            deviceID = device,
            records = records,
            batches = batches,
            events = events,
            goals = goals,
            meta = meta,
        )
    }

    @Test
    fun testMergeKeepsNewerAyahRow() {
        val local = export(records = listOf(record(1, 1, MemorizationStatus.NEEDS_MUSHAF, updated = at(10))))
        val incoming = export(
            records = listOf(
                record(1, 1, MemorizationStatus.MASTERED, updated = at(20)),
                record(1, 2, MemorizationStatus.MASTERED, updated = at(5)),
            ),
        )
        val merged = MemorizationMerge.merge(local = local, incoming = incoming)
        assertEquals(2, merged.records.size)
        assertEquals(MemorizationStatus.MASTERED, merged.records.first { it.ayah == 1 }.status)
        assertEquals(MemorizationStatus.MASTERED, merged.records.first { it.ayah == 2 }.status)
    }

    @Test
    fun testMergeKeepsLocalRowWhenIncomingIsOlder() {
        val local = export(records = listOf(record(1, 1, MemorizationStatus.MASTERED, updated = at(30))))
        val incoming = export(records = listOf(record(1, 1, MemorizationStatus.NEEDS_MUSHAF, updated = at(10))))
        val merged = MemorizationMerge.merge(local = local, incoming = incoming)
        assertEquals(MemorizationStatus.MASTERED, merged.records.first().status)
    }

    @Test
    fun testMergeKeepsLocalOnTie() {
        val local = export(records = listOf(record(1, 1, MemorizationStatus.MEMORIZED_WITH_ERRORS, updated = at(10))))
        val incoming = export(records = listOf(record(1, 1, MemorizationStatus.MASTERED, updated = at(10))))
        val merged = MemorizationMerge.merge(local = local, incoming = incoming)
        assertEquals(MemorizationStatus.MEMORIZED_WITH_ERRORS, merged.records.first().status)
    }

    @Test
    fun testMergeUnionsBatchesAndEventsById() {
        val a = UUID.randomUUID()
        val b = UUID.randomUUID()
        val local = export(
            batches = listOf(batch(a, created = at(1))),
            events = listOf(event(a, 1, 1, time = at(1))),
        )
        val incoming = export(
            batches = listOf(batch(a, created = at(1)), batch(b, created = at(2))),
            events = listOf(event(a, 1, 1, time = at(1)), event(b, 1, 2, time = at(2))),
        )
        val merged = MemorizationMerge.merge(local = local, incoming = incoming)
        assertEquals(setOf(a, b), merged.batches.map { it.id }.toSet())
        assertEquals(2, merged.events.size)
    }

    @Test
    fun testMergeKeepsUndoneFromEitherSide() {
        val id = UUID.randomUUID()
        val undone = at(50)
        val localUndone = MemorizationMerge.merge(
            local = export(batches = listOf(batch(id, created = at(1), undone = undone))),
            incoming = export(batches = listOf(batch(id, created = at(1)))),
        )
        assertEquals(undone, localUndone.batches.first().undoneAt)

        val incomingUndone = MemorizationMerge.merge(
            local = export(batches = listOf(batch(id, created = at(1)))),
            incoming = export(batches = listOf(batch(id, created = at(1), undone = undone))),
        )
        assertEquals(undone, incomingUndone.batches.first().undoneAt)
    }

    @Test
    fun testExportAndImportJsonRoundtrip() {
        val plan = MemorizationPlanner.planUpdate(
            selection = MemorizationSelection.AyahRange(1, 1, 3),
            label = "test export",
            status = MemorizationStatus.MASTERED,
            records = store.allRecords,
            index = index,
            now = t0,
        )
        store.apply(plan)

        val json = service.exportMemorizationToJson()
        val parsed = service.parseExport(json)
        assertEquals(1, parsed.formatVersion)
        assertEquals(3, parsed.records.size)
        assertTrue(parsed.records.all { it.status == MemorizationStatus.MASTERED })

        // Reset store and import JSON back
        val emptyDbFile = File(context.cacheDir, "test-import-${System.nanoTime()}.sqlite")
        val emptyDb = SQLiteMemorizationDatabase.open(emptyDbFile)
        val newStore = MemorizationStore(emptyDb, index, clock = { t0 })
        val newService = BackupService(newStore, readingDb, mutDb)

        newService.importMemorizationJson(json, MemorizationRestoreMode.REPLACE)
        assertEquals(3, newStore.allRecords.size)
        assertEquals(MemorizationStatus.MASTERED, newStore.record(AyahKey(1, 1))?.status)

        emptyDb.close()
        emptyDbFile.delete()
    }
}
