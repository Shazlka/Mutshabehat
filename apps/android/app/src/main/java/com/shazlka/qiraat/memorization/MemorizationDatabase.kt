package com.shazlka.qiraat.memorization

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import com.shazlka.qiraat.cloud.ProgressDataset
import com.shazlka.qiraat.cloud.ProgressSnapshot
import com.shazlka.qiraat.core.AyahKey
import java.io.Closeable
import java.io.File
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.util.UUID

sealed class MemorizationException(message: String) : Exception(message) {
    object NothingToApply : MemorizationException("لا توجد تغييرات للحفظ")
    object NotFound : MemorizationException("الدفعة غير موجودة")
    object AlreadyUndone : MemorizationException("تم التراجع عن هذه الدفعة مسبقاً")
    object NotUndoable : MemorizationException("لا يمكن التراجع عن عملية تراجع")
    data class HasNewerChanges(val conflicts: List<BatchRecord>) :
        MemorizationException("توجد تغييرات أحدث على بعض الآيات (${conflicts.size} دفعة).")
    data class WriteFailed(val detail: String) : MemorizationException(detail)
}

interface MemorizationStoreDatabase : Closeable {
    val databaseFile: File
    fun loadRecords(): Map<AyahKey, AyahMemorizationRecord>
    fun apply(plan: BatchPlan, now: Instant = Instant.now()): BatchRecord
    fun undo(batchID: UUID, force: Boolean = false, now: Instant = Instant.now()): BatchRecord
    fun batches(limit: Int = 100, offset: Int = 0): List<BatchRecord>
    fun batch(id: UUID): BatchRecord?
    fun events(batchID: UUID): List<ChangeEvent>
    fun undoConflicts(batchID: UUID): List<BatchRecord>
    fun qualifyingDays(): Set<LocalDate>
    fun meta(key: String): String?
    fun setMeta(key: String, value: String)
    val deviceID: String
    fun exportDatabase(): ByteArray
    fun importDatabase(bytes: ByteArray)
}

class SQLiteMemorizationDatabase private constructor(
    private var db: SQLiteDatabase,
    override val databaseFile: File,
) : MemorizationStoreDatabase {

    companion object {
        private const val DB_NAME = "mushaf_memorization.sqlite"

        fun open(context: Context): SQLiteMemorizationDatabase {
            val file = File(context.filesDir, DB_NAME)
            return open(file)
        }

        fun open(file: File): SQLiteMemorizationDatabase {
            file.parentFile?.mkdirs()
            val database = SQLiteDatabase.openOrCreateDatabase(file, null)
            runCatching { database.enableWriteAheadLogging() }
            database.execSQL("PRAGMA foreign_keys = ON;")
            setupTables(database)
            return SQLiteMemorizationDatabase(database, file)
        }

        private fun setupTables(db: SQLiteDatabase) {
            db.execSQL("""
                CREATE TABLE IF NOT EXISTS memorization_ayahs (
                    surah INTEGER NOT NULL,
                    ayah INTEGER NOT NULL,
                    status INTEGER NOT NULL CHECK(status BETWEEN 1 AND 4),
                    review_strength INTEGER NOT NULL CHECK(review_strength BETWEEN 1 AND 5),
                    is_learning INTEGER NOT NULL DEFAULT 0,
                    first_memorized_at INTEGER,
                    last_status_changed_at INTEGER,
                    last_reviewed_at INTEGER,
                    next_review_at INTEGER,
                    review_count INTEGER NOT NULL DEFAULT 0,
                    successful_review_count INTEGER NOT NULL DEFAULT 0,
                    consecutive_successful_reviews INTEGER NOT NULL DEFAULT 0,
                    error_count INTEGER NOT NULL DEFAULT 0,
                    updated_at INTEGER NOT NULL,
                    PRIMARY KEY (surah, ayah)
                );
            """)

            db.execSQL("""
                CREATE TABLE IF NOT EXISTS memorization_batches (
                    id TEXT PRIMARY KEY,
                    created_at INTEGER NOT NULL,
                    kind TEXT NOT NULL,
                    label TEXT NOT NULL,
                    scope_json TEXT NOT NULL,
                    ayah_count INTEGER NOT NULL,
                    device_id TEXT NOT NULL,
                    counts_for_streak INTEGER NOT NULL DEFAULT 0,
                    gain_ayahs INTEGER NOT NULL DEFAULT 0,
                    undone_at INTEGER,
                    undoes_batch_id TEXT
                );
            """)

            db.execSQL("""
                CREATE TABLE IF NOT EXISTS memorization_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    batch_id TEXT NOT NULL REFERENCES memorization_batches(id) ON DELETE CASCADE,
                    surah INTEGER NOT NULL,
                    ayah INTEGER NOT NULL,
                    at INTEGER NOT NULL,
                    old_status INTEGER,
                    new_status INTEGER NOT NULL,
                    old_strength INTEGER,
                    new_strength INTEGER NOT NULL,
                    before_json TEXT,
                    after_json TEXT NOT NULL
                );
            """)

            db.execSQL("""
                CREATE TABLE IF NOT EXISTS memorization_goals (
                    id TEXT PRIMARY KEY,
                    json TEXT NOT NULL
                );
            """)

            db.execSQL("""
                CREATE TABLE IF NOT EXISTS memorization_meta (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );
            """)

            db.execSQL("CREATE INDEX IF NOT EXISTS idx_mem_batches_created ON memorization_batches(created_at);")
            db.execSQL("CREATE INDEX IF NOT EXISTS idx_mem_events_at ON memorization_events(at);")
            db.execSQL("CREATE INDEX IF NOT EXISTS idx_mem_events_batch ON memorization_events(batch_id);")
            db.execSQL("CREATE INDEX IF NOT EXISTS idx_mem_events_ayah ON memorization_events(surah, ayah);")
        }
    }

    override val deviceID: String
        get() {
            val existing = meta("device_id")
            if (!existing.isNullOrEmpty()) return existing
            val newId = UUID.randomUUID().toString()
            setMeta("device_id", newId)
            return newId
        }

    @Synchronized
    override fun meta(key: String): String? {
        val sql = "SELECT value FROM memorization_meta WHERE key = ? LIMIT 1;"
        return db.rawQuery(sql, arrayOf(key)).use { cursor ->
            if (cursor.moveToFirst()) cursor.getString(0) else null
        }
    }

    @Synchronized
    override fun setMeta(key: String, value: String) {
        val sql = """
            INSERT INTO memorization_meta (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value;
        """
        db.execSQL(sql, arrayOf(key, value))
    }

    @Synchronized
    override fun loadRecords(): Map<AyahKey, AyahMemorizationRecord> {
        val sql = """
            SELECT
              surah, ayah, status, review_strength, is_learning,
              first_memorized_at, last_status_changed_at, last_reviewed_at, next_review_at,
              review_count, successful_review_count, consecutive_successful_reviews, error_count,
              updated_at
            FROM memorization_ayahs;
        """
        return db.rawQuery(sql, null).use { cursor ->
            buildMap {
                while (cursor.moveToNext()) {
                    val surah = cursor.getInt(0)
                    val ayah = cursor.getInt(1)
                    val status = MemorizationStatus.from(cursor.getInt(2))
                    val strength = ReviewStrength.from(cursor.getInt(3))
                    val isLearning = cursor.getInt(4) != 0

                    val firstMem = if (!cursor.isNull(5)) Instant.ofEpochMilli(cursor.getLong(5)) else null
                    val lastStatus = if (!cursor.isNull(6)) Instant.ofEpochMilli(cursor.getLong(6)) else null
                    val lastRev = if (!cursor.isNull(7)) Instant.ofEpochMilli(cursor.getLong(7)) else null
                    val nextRev = if (!cursor.isNull(8)) Instant.ofEpochMilli(cursor.getLong(8)) else null

                    val revCount = cursor.getInt(9)
                    val succCount = cursor.getInt(10)
                    val consec = cursor.getInt(11)
                    val errCount = cursor.getInt(12)
                    val updated = Instant.ofEpochMilli(cursor.getLong(13))

                    val record = AyahMemorizationRecord(
                        surah = surah,
                        ayah = ayah,
                        status = status,
                        reviewStrength = strength,
                        isCurrentlyLearning = isLearning,
                        firstMemorizedAt = firstMem,
                        lastStatusChangedAt = lastStatus,
                        lastReviewedAt = lastRev,
                        nextReviewAt = nextRev,
                        reviewCount = revCount,
                        successfulReviewCount = succCount,
                        consecutiveSuccessfulReviews = consec,
                        errorCount = errCount,
                        updatedAt = updated,
                    )
                    put(record.key, record)
                }
            }
        }
    }

    private inline fun <T> inTransaction(block: () -> T): T {
        db.beginTransaction()
        return try {
            val result = block()
            db.setTransactionSuccessful()
            result
        } finally {
            db.endTransaction()
        }
    }

    @Synchronized
    override fun apply(plan: BatchPlan, now: Instant): BatchRecord {
        if (plan.changes.isEmpty()) throw MemorizationException.NothingToApply
        val normalizedNow = Instant.ofEpochMilli(now.toEpochMilli())
        val batch = BatchRecord(
            id = UUID.randomUUID(),
            createdAt = normalizedNow,
            kind = plan.kind,
            label = plan.label,
            scopeJSON = plan.scopeJSON,
            ayahCount = plan.changes.size,
            deviceID = deviceID,
            countsForStreak = plan.countsForStreak,
            gainAyahs = plan.gainAyahs,
            undoneAt = null,
            undoesBatchID = null,
        )

        inTransaction {
            insertBatch(batch)
            for (change in plan.changes) {
                upsertRow(change.after)
                insertEvent(batch.id, change.key, normalizedNow, change.before, change.after)
            }
        }
        return batch
    }

    private fun insertBatch(batch: BatchRecord) {
        val values = ContentValues().apply {
            put("id", batch.id.toString())
            put("created_at", batch.createdAt.toEpochMilli())
            put("kind", batch.kind.value)
            put("label", batch.label)
            put("scope_json", batch.scopeJSON)
            put("ayah_count", batch.ayahCount)
            put("device_id", batch.deviceID)
            put("counts_for_streak", if (batch.countsForStreak) 1 else 0)
            put("gain_ayahs", batch.gainAyahs)
            put("undone_at", batch.undoneAt?.toEpochMilli())
            put("undoes_batch_id", batch.undoesBatchID?.toString())
        }
        db.insertOrThrow("memorization_batches", null, values)
    }

    private fun upsertRow(record: AyahMemorizationRecord) {
        val sql = """
            INSERT INTO memorization_ayahs (
              surah, ayah, status, review_strength, is_learning,
              first_memorized_at, last_status_changed_at, last_reviewed_at, next_review_at,
              review_count, successful_review_count, consecutive_successful_reviews, error_count,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(surah, ayah) DO UPDATE SET
              status = excluded.status,
              review_strength = excluded.review_strength,
              is_learning = excluded.is_learning,
              first_memorized_at = excluded.first_memorized_at,
              last_status_changed_at = excluded.last_status_changed_at,
              last_reviewed_at = excluded.last_reviewed_at,
              next_review_at = excluded.next_review_at,
              review_count = excluded.review_count,
              successful_review_count = excluded.successful_review_count,
              consecutive_successful_reviews = excluded.consecutive_successful_reviews,
              error_count = excluded.error_count,
              updated_at = excluded.updated_at;
        """
        db.execSQL(
            sql,
            arrayOf(
                record.surah,
                record.ayah,
                record.status.rawValue,
                record.reviewStrength.rawValue,
                if (record.isCurrentlyLearning) 1 else 0,
                record.firstMemorizedAt?.toEpochMilli(),
                record.lastStatusChangedAt?.toEpochMilli(),
                record.lastReviewedAt?.toEpochMilli(),
                record.nextReviewAt?.toEpochMilli(),
                record.reviewCount,
                record.successfulReviewCount,
                record.consecutiveSuccessfulReviews,
                record.errorCount,
                record.updatedAt.toEpochMilli(),
            ),
        )
    }

    private fun insertEvent(
        batchID: UUID,
        key: AyahKey,
        at: Instant,
        before: AyahMemorizationRecord?,
        after: AyahMemorizationRecord,
    ) {
        val values = ContentValues().apply {
            put("batch_id", batchID.toString())
            put("surah", key.surah)
            put("ayah", key.ayah)
            put("at", at.toEpochMilli())
            put("old_status", before?.status?.rawValue)
            put("new_status", after.status.rawValue)
            put("old_strength", before?.reviewStrength?.rawValue)
            put("new_strength", after.reviewStrength.rawValue)
            put("before_json", before?.let { serializeRecord(it) })
            put("after_json", serializeRecord(after))
        }
        db.insertOrThrow("memorization_events", null, values)
    }

    private fun serializeRecord(record: AyahMemorizationRecord): String {
        return "{\"ayah\":${record.ayah},\"status\":${record.status.rawValue},\"surah\":${record.surah}}"
    }

    @Synchronized
    override fun undo(batchID: UUID, force: Boolean, now: Instant): BatchRecord {
        val original = batch(batchID) ?: throw MemorizationException.NotFound
        if (original.undoneAt != null) throw MemorizationException.AlreadyUndone
        if (original.kind == BatchKind.UNDO) throw MemorizationException.NotUndoable

        val conflicts = undoConflicts(batchID)
        if (conflicts.isNotEmpty() && !force) {
            throw MemorizationException.HasNewerChanges(conflicts)
        }

        val originalEvents = events(batchID)
        if (originalEvents.size != original.ayahCount) {
            throw MemorizationException.WriteFailed("بيانات التراجع ناقصة")
        }

        val normalizedNow = Instant.ofEpochMilli(now.toEpochMilli())
        val undoBatch = BatchRecord(
            id = UUID.randomUUID(),
            createdAt = normalizedNow,
            kind = BatchKind.UNDO,
            label = "تراجع: " + original.label,
            scopeJSON = original.scopeJSON,
            ayahCount = originalEvents.size,
            deviceID = deviceID,
            countsForStreak = false,
            gainAyahs = 0,
            undoneAt = null,
            undoesBatchID = original.id,
        )

        inTransaction {
            insertBatch(undoBatch)
            for (event in originalEvents) {
                if (event.before == null) {
                    db.delete("memorization_ayahs", "surah = ? AND ayah = ?", arrayOf(event.surah.toString(), event.ayah.toString()))
                    val blank = AyahMemorizationRecord.blank(event.key, normalizedNow)
                    insertEvent(undoBatch.id, event.key, normalizedNow, event.after, blank)
                } else {
                    upsertRow(event.before)
                    insertEvent(undoBatch.id, event.key, normalizedNow, event.after, event.before)
                }
            }
            val updateSql = "UPDATE memorization_batches SET undone_at = ? WHERE id = ?;"
            db.execSQL(updateSql, arrayOf(normalizedNow.toEpochMilli(), original.id.toString()))
        }

        return undoBatch
    }

    @Synchronized
    override fun batches(limit: Int, offset: Int): List<BatchRecord> {
        val sql = "SELECT id, created_at, kind, label, scope_json, ayah_count, device_id, counts_for_streak, gain_ayahs, undone_at, undoes_batch_id FROM memorization_batches ORDER BY created_at DESC LIMIT ? OFFSET ?;"
        return db.rawQuery(sql, arrayOf(limit.toString(), offset.toString())).use { cursor ->
            buildList {
                while (cursor.moveToNext()) {
                    add(parseBatch(cursor))
                }
            }
        }
    }

    @Synchronized
    override fun batch(id: UUID): BatchRecord? {
        val sql = "SELECT id, created_at, kind, label, scope_json, ayah_count, device_id, counts_for_streak, gain_ayahs, undone_at, undoes_batch_id FROM memorization_batches WHERE id = ? LIMIT 1;"
        return db.rawQuery(sql, arrayOf(id.toString())).use { cursor ->
            if (cursor.moveToFirst()) parseBatch(cursor) else null
        }
    }

    private fun parseBatch(cursor: android.database.Cursor): BatchRecord {
        val id = UUID.fromString(cursor.getString(0))
        val createdAt = Instant.ofEpochMilli(cursor.getLong(1))
        val kind = BatchKind.from(cursor.getString(2))
        val label = cursor.getString(3)
        val scopeJSON = cursor.getString(4)
        val ayahCount = cursor.getInt(5)
        val devId = cursor.getString(6)
        val streak = cursor.getInt(7) != 0
        val gain = cursor.getInt(8)
        val undoneAt = if (!cursor.isNull(9)) Instant.ofEpochMilli(cursor.getLong(9)) else null
        val undoesID = if (!cursor.isNull(10)) UUID.fromString(cursor.getString(10)) else null
        return BatchRecord(id, createdAt, kind, label, scopeJSON, ayahCount, devId, streak, gain, undoneAt, undoesID)
    }

    @Synchronized
    override fun events(batchID: UUID): List<ChangeEvent> {
        val sql = """
            SELECT e.batch_id, e.surah, e.ayah, e.at,
                   a.status, a.review_strength, a.is_learning, a.first_memorized_at, a.last_status_changed_at,
                   a.last_reviewed_at, a.next_review_at, a.review_count, a.successful_review_count,
                   a.consecutive_successful_reviews, a.error_count, a.updated_at
            FROM memorization_events e
            LEFT JOIN memorization_ayahs a ON a.surah = e.surah AND a.ayah = e.ayah
            WHERE e.batch_id = ?
            ORDER BY e.id ASC;
        """
        val rawSql = "SELECT batch_id, surah, ayah, at, old_status, new_status, old_strength, new_strength FROM memorization_events WHERE batch_id = ? ORDER BY id ASC;"
        return db.rawQuery(rawSql, arrayOf(batchID.toString())).use { cursor ->
            buildList {
                while (cursor.moveToNext()) {
                    val bid = UUID.fromString(cursor.getString(0))
                    val surah = cursor.getInt(1)
                    val ayah = cursor.getInt(2)
                    val at = Instant.ofEpochMilli(cursor.getLong(3))
                    val oldStatus = if (!cursor.isNull(4)) MemorizationStatus.from(cursor.getInt(4)) else null
                    val newStatus = MemorizationStatus.from(cursor.getInt(5))
                    val oldStrength = if (!cursor.isNull(6)) ReviewStrength.from(cursor.getInt(6)) else null
                    val newStrength = ReviewStrength.from(cursor.getInt(7))

                    val before = oldStatus?.let {
                        AyahMemorizationRecord(
                            surah = surah,
                            ayah = ayah,
                            status = it,
                            reviewStrength = oldStrength ?: ReviewStrength.NOT_REVIEWED,
                            isCurrentlyLearning = false,
                            updatedAt = at,
                        )
                    }
                    val after = AyahMemorizationRecord(
                        surah = surah,
                        ayah = ayah,
                        status = newStatus,
                        reviewStrength = newStrength,
                        isCurrentlyLearning = false,
                        updatedAt = at,
                    )
                    add(ChangeEvent(bid, surah, ayah, at, before, after))
                }
            }
        }
    }

    @Synchronized
    override fun undoConflicts(batchID: UUID): List<BatchRecord> {
        val original = batch(batchID) ?: return emptyList()
        val sql = """
            SELECT DISTINCT b.id, b.created_at, b.kind, b.label, b.scope_json, b.ayah_count, b.device_id, b.counts_for_streak, b.gain_ayahs, b.undone_at, b.undoes_batch_id
            FROM memorization_batches b
            JOIN memorization_events e ON e.batch_id = b.id
            WHERE b.created_at > ?
              AND b.undone_at IS NULL
              AND b.kind != 'undo'
              AND EXISTS (SELECT 1 FROM memorization_events e2 WHERE e2.batch_id = ? AND e2.surah = e.surah AND e2.ayah = e.ayah)
            ORDER BY b.created_at ASC;
        """
        return db.rawQuery(sql, arrayOf(original.createdAt.toEpochMilli().toString(), batchID.toString())).use { cursor ->
            buildList {
                while (cursor.moveToNext()) {
                    add(parseBatch(cursor))
                }
            }
        }
    }

    @Synchronized
    override fun qualifyingDays(): Set<LocalDate> {
        val sql = "SELECT created_at FROM memorization_batches WHERE counts_for_streak = 1 AND undone_at IS NULL;"
        return db.rawQuery(sql, null).use { cursor ->
            buildSet {
                while (cursor.moveToNext()) {
                    val epoch = cursor.getLong(0)
                    add(Instant.ofEpochMilli(epoch).atZone(ZoneId.systemDefault()).toLocalDate())
                }
            }
        }
    }

    @Synchronized
    override fun exportDatabase(): ByteArray {
        db.rawQuery("PRAGMA wal_checkpoint(TRUNCATE);", null).use { it.moveToFirst() }
        return databaseFile.readBytes()
    }

    @Synchronized
    override fun importDatabase(bytes: ByteArray) {
        db.close()
        val tempFile = File(databaseFile.parentFile, "${databaseFile.name}.tmp")
        tempFile.writeBytes(bytes)
        if (!tempFile.renameTo(databaseFile)) {
            tempFile.copyTo(databaseFile, overwrite = true)
            tempFile.delete()
        }
        val reopened = SQLiteDatabase.openOrCreateDatabase(databaseFile, null)
        runCatching { reopened.enableWriteAheadLogging() }
        reopened.execSQL("PRAGMA foreign_keys = ON;")
        setupTables(reopened)
        db = reopened
    }

    @Synchronized
    fun cloudSnapshot(replacement: ProgressSnapshot? = null): ProgressSnapshot {
        if (replacement != null) ProgressDataset.MEMORIZATION.replace(db, replacement)
        return ProgressDataset.MEMORIZATION.capture(db)
    }

    override fun close() {
        if (db.isOpen) db.close()
    }
}
