package com.shazlka.qiraat.reading

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import com.shazlka.qiraat.core.AyahKey
import java.io.Closeable
import java.io.File
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.UUID

interface ReadingStore : Closeable {
    val databaseFile: File

    fun getOrCreateActiveKhatma(): KhatmaRecord
    fun completeActiveKhatma(khatmaId: String): KhatmaRecord?
    fun recordReadAyahs(khatmaId: String, items: List<Triple<Int, Int, Int>>, at: Instant = Instant.now()): Int
    fun recordReading(
        khatmaId: String,
        items: List<Triple<Int, Int, Int>>,
        at: Instant = Instant.now(),
        pagesCount: Int,
        seconds: Int,
        activityAyahs: (Int) -> Int,
    ): Int?

    fun recordDailyReadingActivity(
        ayahsCount: Int,
        pagesCount: Int,
        seconds: Int = 0,
        on: Instant = Instant.now(),
    ): Pair<Int, Int>

    fun calculateStreaks(asOf: Instant = Instant.now()): Triple<Int, Int, Int>
    fun allReadingDays(): List<ReadingDayRecord>
    fun readingSecondsMap(startingFrom: LocalDate, endingAt: LocalDate): Map<String, Int>
    fun readingDaysSet(startingFrom: LocalDate, endingAt: LocalDate): Set<String>
    fun lifetimeReadingSeconds(): Int
    fun lifetimeReadAyahsCount(): Int

    fun readAyahsCount(khatmaId: String): Int
    fun readAyahsCountForSurah(khatmaId: String, surah: Int): Int
    fun allReadAyahsForSurah(khatmaId: String, surah: Int): Set<Int>
    fun removeReadAyahsForSurah(khatmaId: String, surah: Int)
    fun completedKhatmasCount(): Int

    fun addBookmark(
        type: BookmarkType,
        surah: Int,
        ayah: Int,
        page: Int,
        note: String? = null,
        createdAt: Instant = Instant.now(),
    ): QuranBookmark

    fun removeBookmark(id: String)
    fun removeBookmark(type: BookmarkType, surah: Int, ayah: Int, page: Int)
    fun isAyahBookmarked(surah: Int, ayah: Int): Boolean
    fun isPageBookmarked(page: Int): Boolean
    fun bookmarkedAyahs(on: Int): Set<AyahKey>
    fun allBookmarks(type: BookmarkType? = null, query: String? = null): List<QuranBookmark>

    fun exportDatabase(): ByteArray
    fun importDatabase(bytes: ByteArray)
}

class QuranReadingDatabase private constructor(
    private var db: SQLiteDatabase,
    override val databaseFile: File,
) : ReadingStore {

    companion object {
        private const val DB_NAME = "mushaf_reading.sqlite"
        val DAY_FORMATTER: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd").withZone(ZoneId.systemDefault())

        fun open(context: Context): QuranReadingDatabase {
            val file = File(context.filesDir, DB_NAME)
            return open(file)
        }

        fun open(file: File): QuranReadingDatabase {
            file.parentFile?.mkdirs()
            val database = SQLiteDatabase.openOrCreateDatabase(file, null)
            runCatching { database.enableWriteAheadLogging() }
            database.execSQL("PRAGMA foreign_keys = ON;")
            setupTables(database)
            return QuranReadingDatabase(database, file)
        }

        private fun setupTables(db: SQLiteDatabase) {
            db.execSQL("""
                CREATE TABLE IF NOT EXISTS bookmarks (
                    id TEXT PRIMARY KEY,
                    type TEXT NOT NULL,
                    surah INTEGER NOT NULL,
                    ayah INTEGER NOT NULL,
                    page INTEGER NOT NULL,
                    note TEXT,
                    created_at TEXT NOT NULL,
                    UNIQUE(type, surah, ayah, page)
                );
            """)

            db.execSQL("""
                CREATE TABLE IF NOT EXISTS khatmas (
                    id TEXT PRIMARY KEY,
                    khatma_number INTEGER NOT NULL,
                    started_at TEXT NOT NULL,
                    completed_at TEXT,
                    status TEXT NOT NULL,
                    percent_complete REAL NOT NULL DEFAULT 0.0
                );
            """)

            db.execSQL("""
                CREATE TABLE IF NOT EXISTS khatma_read_ayahs (
                    khatma_id TEXT NOT NULL,
                    surah INTEGER NOT NULL,
                    ayah INTEGER NOT NULL,
                    page INTEGER NOT NULL,
                    read_at TEXT NOT NULL,
                    PRIMARY KEY (khatma_id, surah, ayah),
                    FOREIGN KEY (khatma_id) REFERENCES khatmas(id) ON DELETE CASCADE
                );
            """)

            db.execSQL("""
                CREATE TABLE IF NOT EXISTS reading_days (
                    date_string TEXT PRIMARY KEY,
                    ayahs_read INTEGER NOT NULL DEFAULT 0,
                    pages_read INTEGER NOT NULL DEFAULT 0,
                    seconds_read INTEGER NOT NULL DEFAULT 0,
                    last_read_at TEXT NOT NULL
                );
            """)

            db.execSQL("""
                CREATE TABLE IF NOT EXISTS reading_activity_events (
                    id TEXT PRIMARY KEY,
                    date_string TEXT NOT NULL,
                    ayahs_read INTEGER NOT NULL,
                    pages_read INTEGER NOT NULL,
                    seconds_read INTEGER NOT NULL,
                    recorded_at TEXT NOT NULL
                );
            """)

            db.execSQL("""
                CREATE TABLE IF NOT EXISTS reading_metadata (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );
            """)
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

    // MARK: - Khatma Progress

    @Synchronized
    override fun getOrCreateActiveKhatma(): KhatmaRecord {
        val sql = "SELECT id, khatma_number, started_at, completed_at, status, percent_complete FROM khatmas WHERE status = 'active' ORDER BY khatma_number DESC LIMIT 1;"
        db.rawQuery(sql, null).use { cursor ->
            if (cursor.moveToFirst()) {
                val id = cursor.getString(0)
                val number = cursor.getInt(1)
                val startedAt = runCatching { Instant.parse(cursor.getString(2)) }.getOrDefault(Instant.now())
                val completedAt = if (!cursor.isNull(3)) runCatching { Instant.parse(cursor.getString(3)) }.getOrNull() else null
                val status = cursor.getString(4)
                val pct = cursor.getDouble(5)
                return KhatmaRecord(id, number, startedAt, completedAt, status, pct)
            }
        }

        val countSql = "SELECT COALESCE(MAX(khatma_number), 0) FROM khatmas;"
        var nextNumber = 1
        db.rawQuery(countSql, null).use { cursor ->
            if (cursor.moveToFirst()) {
                nextNumber = cursor.getInt(0) + 1
            }
        }

        val newId = UUID.randomUUID().toString()
        val now = Instant.now()
        val values = ContentValues().apply {
            put("id", newId)
            put("khatma_number", nextNumber)
            put("started_at", now.toString())
            put("status", "active")
            put("percent_complete", 0.0)
        }
        db.insert("khatmas", null, values)
        return KhatmaRecord(newId, nextNumber, now, null, "active", 0.0)
    }

    @Synchronized
    override fun completeActiveKhatma(khatmaId: String): KhatmaRecord? {
        val now = Instant.now()
        val values = ContentValues().apply {
            put("status", "completed")
            put("completed_at", now.toString())
            put("percent_complete", 100.0)
        }
        val rows = db.update("khatmas", values, "id = ?", arrayOf(khatmaId))
        if (rows == 0) return null

        val sql = "SELECT id, khatma_number, started_at, completed_at, status, percent_complete FROM khatmas WHERE id = ?;"
        return db.rawQuery(sql, arrayOf(khatmaId)).use { cursor ->
            if (cursor.moveToFirst()) {
                KhatmaRecord(
                    id = cursor.getString(0),
                    khatmaNumber = cursor.getInt(1),
                    startedAt = runCatching { Instant.parse(cursor.getString(2)) }.getOrDefault(now),
                    completedAt = now,
                    status = "completed",
                    percentComplete = 100.0,
                )
            } else null
        }
    }

    @Synchronized
    override fun recordReadAyahs(khatmaId: String, items: List<Triple<Int, Int, Int>>, at: Instant): Int {
        if (items.isEmpty()) return 0
        return inTransaction {
            var newCount = 0
            val dateStr = at.toString()
            items.forEach { (surah, ayah, page) ->
                val values = ContentValues().apply {
                    put("khatma_id", khatmaId)
                    put("surah", surah)
                    put("ayah", ayah)
                    put("page", page)
                    put("read_at", dateStr)
                }
                val rowId = db.insertWithOnConflict("khatma_read_ayahs", null, values, SQLiteDatabase.CONFLICT_IGNORE)
                if (rowId != -1L) newCount++
            }
            newCount
        }
    }

    @Synchronized
    override fun recordReading(
        khatmaId: String,
        items: List<Triple<Int, Int, Int>>,
        at: Instant,
        pagesCount: Int,
        seconds: Int,
        activityAyahs: (Int) -> Int,
    ): Int? {
        if (items.isEmpty()) return 0
        return try {
            inTransaction {
                var newCount = 0
                val dateStr = at.toString()
                items.forEach { (surah, ayah, page) ->
                    val values = ContentValues().apply {
                        put("khatma_id", khatmaId)
                        put("surah", surah)
                        put("ayah", ayah)
                        put("page", page)
                        put("read_at", dateStr)
                    }
                    val rowId = db.insertWithOnConflict("khatma_read_ayahs", null, values, SQLiteDatabase.CONFLICT_IGNORE)
                    if (rowId != -1L) newCount++
                }

                val activityCount = activityAyahs(newCount)
                if (activityCount > 0) {
                    insertActivityLocked(activityCount, pagesCount, seconds, at)
                }
                newCount
            }
        } catch (e: Exception) {
            null
        }
    }

    private fun insertActivityLocked(ayahsCount: Int, pagesCount: Int, seconds: Int, date: Instant) {
        val dateStr = LocalDate.ofInstant(date, ZoneId.systemDefault()).format(DateTimeFormatter.ISO_LOCAL_DATE)
        val nowStr = date.toString()

        val eventValues = ContentValues().apply {
            put("id", UUID.randomUUID().toString())
            put("date_string", dateStr)
            put("ayahs_read", ayahsCount)
            put("pages_read", pagesCount)
            put("seconds_read", seconds)
            put("recorded_at", nowStr)
        }
        db.insert("reading_activity_events", null, eventValues)

        val upsertSql = """
            INSERT INTO reading_days (date_string, ayahs_read, pages_read, seconds_read, last_read_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(date_string) DO UPDATE SET
                ayahs_read = ayahs_read + excluded.ayahs_read,
                pages_read = pages_read + excluded.pages_read,
                seconds_read = seconds_read + excluded.seconds_read,
                last_read_at = excluded.last_read_at;
        """
        db.execSQL(upsertSql, arrayOf(dateStr, ayahsCount, pagesCount, seconds, nowStr))
    }

    @Synchronized
    override fun recordDailyReadingActivity(
        ayahsCount: Int,
        pagesCount: Int,
        seconds: Int,
        on: Instant,
    ): Pair<Int, Int> {
        inTransaction {
            insertActivityLocked(ayahsCount, pagesCount, seconds, on)
        }
        val streaks = recalculateStreaks(LocalDate.ofInstant(on, ZoneId.systemDefault()))
        return Pair(streaks.first, streaks.second)
    }

    @Synchronized
    override fun calculateStreaks(asOf: Instant): Triple<Int, Int, Int> {
        val localDate = LocalDate.ofInstant(asOf, ZoneId.systemDefault())
        val (current, longest) = recalculateStreaks(localDate)
        val total = fetchTotalReadingDays()
        return Triple(current, longest, total)
    }

    private fun recalculateStreaks(asOf: LocalDate): Pair<Int, Int> {
        val sql = "SELECT date_string FROM reading_days ORDER BY date_string ASC;"
        val days = mutableListOf<String>()
        db.rawQuery(sql, null).use { cursor ->
            while (cursor.moveToNext()) {
                days.add(cursor.getString(0))
            }
        }

        if (days.isEmpty()) return Pair(0, 0)

        var streak = 0
        var maxStreak = 0
        var prevDate: LocalDate? = null

        for (dayStr in days) {
            val curDate = runCatching { LocalDate.parse(dayStr) }.getOrNull() ?: continue
            if (prevDate != null) {
                val diff = curDate.toEpochDay() - prevDate.toEpochDay()
                if (diff == 1L) {
                    streak += 1
                } else if (diff > 1L) {
                    streak = 1
                }
            } else {
                streak = 1
            }
            maxStreak = maxOf(maxStreak, streak)
            prevDate = curDate
        }

        val lastRecordedStr = days.lastOrNull()
        val lastRecordedDate = lastRecordedStr?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
            ?: return Pair(0, maxStreak)

        val diffFromToday = asOf.toEpochDay() - lastRecordedDate.toEpochDay()
        val activeStreak = when {
            diffFromToday <= 0L -> streak
            diffFromToday == 1L -> streak
            else -> 0
        }

        val metaSql = """
            INSERT INTO reading_metadata (key, value) VALUES ('longest_streak', '$maxStreak')
            ON CONFLICT(key) DO UPDATE SET value = MAX(CAST(value AS INTEGER), $maxStreak);
        """
        db.execSQL(metaSql)

        return Pair(activeStreak, maxStreak)
    }

    private fun fetchTotalReadingDays(): Int {
        val sql = "SELECT COUNT(*) FROM reading_days;"
        return db.rawQuery(sql, null).use { cursor ->
            if (cursor.moveToFirst()) cursor.getInt(0) else 0
        }
    }

    @Synchronized
    override fun allReadingDays(): List<ReadingDayRecord> {
        val sql = "SELECT date_string, ayahs_read, pages_read, seconds_read, last_read_at FROM reading_days ORDER BY date_string DESC;"
        return db.rawQuery(sql, null).use { cursor ->
            buildList {
                while (cursor.moveToNext()) {
                    val dateStr = cursor.getString(0)
                    val ayahs = cursor.getInt(1)
                    val pages = cursor.getInt(2)
                    var seconds = cursor.getInt(3)
                    if (seconds == 0) {
                        if (ayahs > 0) seconds = ayahs * 20
                        else if (pages > 0) seconds = pages * 75
                    }
                    val lastRead = runCatching { Instant.parse(cursor.getString(4)) }.getOrDefault(Instant.now())
                    add(ReadingDayRecord(dateStr, ayahs, pages, seconds, lastRead))
                }
            }
        }
    }

    @Synchronized
    override fun readingSecondsMap(startingFrom: LocalDate, endingAt: LocalDate): Map<String, Int> {
        val startStr = startingFrom.format(DateTimeFormatter.ISO_LOCAL_DATE)
        val endStr = endingAt.format(DateTimeFormatter.ISO_LOCAL_DATE)
        val sql = "SELECT date_string, seconds_read, ayahs_read, pages_read FROM reading_days WHERE date_string >= ? AND date_string <= ?;"
        return db.rawQuery(sql, arrayOf(startStr, endStr)).use { cursor ->
            buildMap {
                while (cursor.moveToNext()) {
                    val dateStr = cursor.getString(0)
                    var sec = cursor.getInt(1)
                    val ayahs = cursor.getInt(2)
                    val pages = cursor.getInt(3)
                    if (sec == 0) {
                        if (ayahs > 0) sec = ayahs * 20
                        else if (pages > 0) sec = pages * 75
                    }
                    put(dateStr, sec)
                }
            }
        }
    }

    @Synchronized
    override fun readingDaysSet(startingFrom: LocalDate, endingAt: LocalDate): Set<String> {
        val startStr = startingFrom.format(DateTimeFormatter.ISO_LOCAL_DATE)
        val endStr = endingAt.format(DateTimeFormatter.ISO_LOCAL_DATE)
        val sql = "SELECT date_string FROM reading_days WHERE date_string >= ? AND date_string <= ?;"
        return db.rawQuery(sql, arrayOf(startStr, endStr)).use { cursor ->
            buildSet {
                while (cursor.moveToNext()) {
                    add(cursor.getString(0))
                }
            }
        }
    }

    @Synchronized
    override fun lifetimeReadingSeconds(): Int {
        val sql = "SELECT COALESCE(SUM(seconds_read), 0), COALESCE(SUM(ayahs_read), 0), COALESCE(SUM(pages_read), 0) FROM reading_days;"
        return db.rawQuery(sql, null).use { cursor ->
            if (cursor.moveToFirst()) {
                val totalSec = cursor.getInt(0)
                val fallbackAyahs = cursor.getInt(1)
                val fallbackPages = cursor.getInt(2)
                if (totalSec > 0) totalSec
                else if (fallbackAyahs > 0) fallbackAyahs * 20
                else if (fallbackPages > 0) fallbackPages * 75
                else 0
            } else 0
        }
    }

    @Synchronized
    override fun lifetimeReadAyahsCount(): Int {
        val sql = "SELECT COUNT(*) FROM khatma_read_ayahs;"
        return db.rawQuery(sql, null).use { cursor ->
            if (cursor.moveToFirst()) cursor.getInt(0) else 0
        }
    }

    @Synchronized
    override fun readAyahsCount(khatmaId: String): Int {
        val sql = "SELECT COUNT(DISTINCT surah || ':' || ayah) FROM khatma_read_ayahs WHERE khatma_id = ?;"
        return db.rawQuery(sql, arrayOf(khatmaId)).use { cursor ->
            if (cursor.moveToFirst()) cursor.getInt(0) else 0
        }
    }

    @Synchronized
    override fun readAyahsCountForSurah(khatmaId: String, surah: Int): Int {
        val sql = "SELECT COUNT(DISTINCT ayah) FROM khatma_read_ayahs WHERE khatma_id = ? AND surah = ?;"
        return db.rawQuery(sql, arrayOf(khatmaId, surah.toString())).use { cursor ->
            if (cursor.moveToFirst()) cursor.getInt(0) else 0
        }
    }

    @Synchronized
    override fun allReadAyahsForSurah(khatmaId: String, surah: Int): Set<Int> {
        val sql = "SELECT ayah FROM khatma_read_ayahs WHERE khatma_id = ? AND surah = ?;"
        return db.rawQuery(sql, arrayOf(khatmaId, surah.toString())).use { cursor ->
            buildSet {
                while (cursor.moveToNext()) add(cursor.getInt(0))
            }
        }
    }

    @Synchronized
    override fun removeReadAyahsForSurah(khatmaId: String, surah: Int) {
        db.delete("khatma_read_ayahs", "khatma_id = ? AND surah = ?", arrayOf(khatmaId, surah.toString()))
    }

    @Synchronized
    override fun completedKhatmasCount(): Int {
        val sql = "SELECT COUNT(*) FROM khatmas WHERE status = 'completed';"
        return db.rawQuery(sql, null).use { cursor ->
            if (cursor.moveToFirst()) cursor.getInt(0) else 0
        }
    }

    // MARK: - Bookmarks

    @Synchronized
    override fun addBookmark(
        type: BookmarkType,
        surah: Int,
        ayah: Int,
        page: Int,
        note: String?,
        createdAt: Instant,
    ): QuranBookmark {
        val id = UUID.randomUUID().toString()
        val dateStr = createdAt.toString()
        val sql = """
            INSERT INTO bookmarks (id, type, surah, ayah, page, note, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(type, surah, ayah, page) DO UPDATE SET
                note = excluded.note,
                created_at = excluded.created_at;
        """
        db.execSQL(sql, arrayOf(id, type.value, surah, ayah, page, note, dateStr))

        val storedID = storedBookmarkID(type, surah, ayah, page) ?: id
        return QuranBookmark(storedID, type, surah, ayah, page, note, createdAt)
    }

    private fun storedBookmarkID(type: BookmarkType, surah: Int, ayah: Int, page: Int): String? {
        val sql = "SELECT id FROM bookmarks WHERE type = ? AND surah = ? AND ayah = ? AND page = ? LIMIT 1;"
        return db.rawQuery(sql, arrayOf(type.value, surah.toString(), ayah.toString(), page.toString())).use { cursor ->
            if (cursor.moveToFirst()) cursor.getString(0) else null
        }
    }

    @Synchronized
    override fun removeBookmark(id: String) {
        db.delete("bookmarks", "id = ?", arrayOf(id))
    }

    @Synchronized
    override fun removeBookmark(type: BookmarkType, surah: Int, ayah: Int, page: Int) {
        val ids = bookmarkIDs(type, surah, ayah, page)
        ids.forEach { removeBookmark(it) }
    }

    private fun bookmarkIDs(type: BookmarkType, surah: Int, ayah: Int, page: Int): List<String> {
        val isPage = type == BookmarkType.PAGE
        val sql = if (isPage) {
            "SELECT id FROM bookmarks WHERE type = 'page' AND page = ?;"
        } else {
            "SELECT id FROM bookmarks WHERE type = 'ayah' AND surah = ? AND ayah = ?;"
        }
        val args = if (isPage) arrayOf(page.toString()) else arrayOf(surah.toString(), ayah.toString())
        return db.rawQuery(sql, args).use { cursor ->
            buildList {
                while (cursor.moveToNext()) add(cursor.getString(0))
            }
        }
    }

    @Synchronized
    override fun isAyahBookmarked(surah: Int, ayah: Int): Boolean {
        val sql = "SELECT 1 FROM bookmarks WHERE type = 'ayah' AND surah = ? AND ayah = ? LIMIT 1;"
        return db.rawQuery(sql, arrayOf(surah.toString(), ayah.toString())).use { cursor ->
            cursor.moveToFirst()
        }
    }

    @Synchronized
    override fun isPageBookmarked(page: Int): Boolean {
        val sql = "SELECT 1 FROM bookmarks WHERE type = 'page' AND page = ? LIMIT 1;"
        return db.rawQuery(sql, arrayOf(page.toString())).use { cursor ->
            cursor.moveToFirst()
        }
    }

    @Synchronized
    override fun bookmarkedAyahs(on: Int): Set<AyahKey> {
        val sql = "SELECT surah, ayah FROM bookmarks WHERE type = 'ayah' AND page = ?;"
        return db.rawQuery(sql, arrayOf(on.toString())).use { cursor ->
            buildSet {
                while (cursor.moveToNext()) {
                    add(AyahKey(cursor.getInt(0), cursor.getInt(1)))
                }
            }
        }
    }

    @Synchronized
    override fun allBookmarks(type: BookmarkType?, query: String?): List<QuranBookmark> {
        val where = mutableListOf<String>()
        val args = mutableListOf<String>()

        if (type != null) {
            where += "type = ?"
            args += type.value
        }

        val q = query?.trim().orEmpty()
        if (q.isNotEmpty()) {
            where += "(note LIKE ? ESCAPE '\\' OR surah = ? OR ayah = ? OR page = ?)"
            val escaped = "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
            args += escaped
            val num = q.toIntOrNull()?.toString() ?: "-1"
            args += num
            args += num
            args += num
        }

        val sql = "SELECT id, type, surah, ayah, page, note, created_at FROM bookmarks" +
                (if (where.isEmpty()) "" else " WHERE " + where.joinToString(" AND ")) +
                " ORDER BY created_at DESC;"

        return db.rawQuery(sql, args.toTypedArray()).use { cursor ->
            buildList {
                while (cursor.moveToNext()) {
                    val id = cursor.getString(0)
                    val t = BookmarkType.from(cursor.getString(1))
                    val surah = cursor.getInt(2)
                    val ayah = cursor.getInt(3)
                    val page = cursor.getInt(4)
                    val note = if (cursor.isNull(5)) null else cursor.getString(5)
                    val createdAt = runCatching { Instant.parse(cursor.getString(6)) }.getOrDefault(Instant.now())
                    add(QuranBookmark(id, t, surah, ayah, page, note, createdAt))
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

    override fun close() {
        if (db.isOpen) db.close()
    }
}
