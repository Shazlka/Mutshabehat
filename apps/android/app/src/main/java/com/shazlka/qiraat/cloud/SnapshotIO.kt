package com.shazlka.qiraat.cloud

import android.database.sqlite.SQLiteDatabase

/**
 * Reads and writes a dataset's tables by column name, in one fixed order, so every device sees the same rows.
 *
 * The sync format is positional (an array of text values per row). `SELECT *` follows the order a table happened to
 * be created or migrated in, and that differs between installs: the iPhone's `reading_days` has `last_read_at` before
 * `seconds_read`, a fresh database has them the other way round, and Android's older `reading_deletions` has a different
 * shape altogether. Naming the columns makes the exchange independent of all of that.
 *
 * A table that lacks the expected columns (Android's older `reading_deletions`) is left out of both directions: it
 * reads as empty and is never overwritten, so it can neither upload rows in the wrong shape nor lose its own.
 */
object SnapshotIO {
    val columns: Map<String, List<String>> = mapOf(
        "khatmas" to listOf("id", "khatma_number", "started_at", "completed_at", "status", "percent_complete"),
        "khatma_read_ayahs" to listOf("khatma_id", "surah", "ayah", "page", "read_at"),
        "reading_days" to listOf("date_string", "ayahs_read", "pages_read", "seconds_read", "last_read_at"),
        "reading_days_legacy" to listOf("date_string", "ayahs_read", "pages_read", "seconds_read", "last_read_at"),
        "reading_activity_events" to listOf("id", "date_string", "ayahs_read", "pages_read", "seconds_read", "recorded_at"),
        "reading_deletions" to listOf("kind", "khatma_number", "surah", "ayah", "page", "deleted_at"),
        "memorization_ayahs" to listOf(
            "surah", "ayah", "status", "review_strength", "is_learning", "first_memorized_at", "last_status_changed_at",
            "last_reviewed_at", "next_review_at", "review_count", "successful_review_count",
            "consecutive_successful_reviews", "error_count", "updated_at",
        ),
        "memorization_batches" to listOf(
            "id", "created_at", "kind", "label", "scope_json", "ayah_count", "device_id", "counts_for_streak", "gain_ayahs",
            "undone_at", "undoes_batch_id",
        ),
        "memorization_events" to listOf(
            "id", "batch_id", "surah", "ayah", "at", "old_status", "new_status", "old_strength", "new_strength",
            "before_json", "after_json",
        ),
        "memorization_goals" to listOf("id", "json"),
        "memorization_meta" to listOf("key", "value"),
    )

    private val metadata = listOf("milestones_seen", "quran_completed_at")

    /** True when the table exists with every expected column. */
    fun usable(db: SQLiteDatabase, table: String): Boolean {
        val expected = columns.getValue(table)
        val present = db.rawQuery("PRAGMA table_info($table)", null).use { cursor ->
            buildSet { while (cursor.moveToNext()) add(cursor.getString(cursor.getColumnIndexOrThrow("name"))) }
        }
        return present.containsAll(expected)
    }

    @JvmStatic
    fun capture(dataset: ProgressDataset, db: SQLiteDatabase): ProgressSnapshot = dataset.tables.associateWith { table ->
        if (!usable(db, table)) return@associateWith emptyList<List<String?>>()
        val list = columns.getValue(table).joinToString(", ") { "\"$it\"" }
        val filter = if (table == "memorization_meta") " WHERE key IN (${metadata.joinToString(",") { "'$it'" }})" else ""
        db.rawQuery("SELECT $list FROM $table$filter", null).use { cursor ->
            buildList {
                while (cursor.moveToNext()) {
                    add(List(cursor.columnCount) { column -> if (cursor.isNull(column)) null else cursor.getString(column) })
                }
            }.sortedWith { a, b ->
                a.indices.firstNotNullOfOrNull { column ->
                    a[column].orEmpty().compareTo(b[column].orEmpty()).takeIf { it != 0 }
                } ?: 0
            }
        }
    }

    @JvmStatic
    fun replace(dataset: ProgressDataset, db: SQLiteDatabase, snapshot: ProgressSnapshot) {
        require(snapshot.keys == dataset.tables.toSet())
        val writable = dataset.tables.filter { usable(db, it) }
        db.beginTransaction()
        try {
            for (table in writable.asReversed()) {
                val filter = if (table == "memorization_meta") " WHERE key IN (${metadata.joinToString(",") { "'$it'" }})" else ""
                db.execSQL("DELETE FROM $table$filter")
            }
            for (table in writable) {
                val names = columns.getValue(table)
                val statement = db.compileStatement(
                    "INSERT INTO $table (${names.joinToString(", ") { "\"$it\"" }}) VALUES (${names.joinToString(",") { "?" }})",
                )
                statement.use {
                    for (row in snapshot.getValue(table)) {
                        require(row.size == names.size)
                        if (table == "memorization_meta") require(row.firstOrNull() in metadata)
                        it.clearBindings()
                        row.forEachIndexed { index, value ->
                            if (value == null) it.bindNull(index + 1) else it.bindString(index + 1, value)
                        }
                        it.executeInsert()
                    }
                }
            }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }
}
