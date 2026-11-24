package com.shazlka.qiraat.cloud

import android.database.sqlite.SQLiteDatabase
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest

typealias ProgressSnapshot = Map<String, List<List<String?>>>

enum class ProgressDataset(val path: String, val title: String, val tables: List<String>) {
    KHATMA(
        "khatma", "الختمة",
        listOf("khatmas", "khatma_read_ayahs", "reading_days", "reading_days_legacy", "reading_activity_events", "reading_deletions"),
    ),
    MEMORIZATION(
        "memorization", "الحفظ",
        listOf("memorization_ayahs", "memorization_batches", "memorization_events", "memorization_goals", "memorization_meta"),
    );

    fun hasProgress(snapshot: ProgressSnapshot): Boolean = tables.any { table ->
        val rows = snapshot.getValue(table)
        if (table == "khatmas") rows.any { it[4] == "completed" } else rows.isNotEmpty()
    }

    fun capture(db: SQLiteDatabase): ProgressSnapshot = tables.associateWith { table ->
        db.rawQuery("SELECT * FROM $table${filter(table)}", null).use { cursor ->
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

    fun replace(db: SQLiteDatabase, snapshot: ProgressSnapshot) {
        require(snapshot.keys == tables.toSet())
        db.beginTransaction()
        try {
            for (table in tables.asReversed()) db.execSQL("DELETE FROM $table${filter(table)}")
            for (table in tables) {
                for (row in snapshot.getValue(table)) {
                    if (table == "memorization_meta") require(row.firstOrNull() in metadata)
                    val placeholders = List(row.size) { "?" }.joinToString(",")
                    db.execSQL("INSERT INTO $table VALUES ($placeholders)", row.toTypedArray())
                }
            }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    fun decode(value: JSONObject): ProgressSnapshot {
        require(value.keys().asSequence().toSet() == tables.toSet())
        return tables.associateWith { table ->
            val rows = value.getJSONArray(table)
            List(rows.length()) { index ->
                val row = rows.getJSONArray(index)
                List(row.length()) { column -> if (row.isNull(column)) null else row.getString(column) }
            }
        }
    }

    fun encode(snapshot: ProgressSnapshot): JSONObject = JSONObject().apply {
        for (table in tables) {
            put(table, JSONArray().apply {
                for (row in snapshot.getValue(table)) put(JSONArray().apply {
                    row.forEach { put(it ?: JSONObject.NULL) }
                })
            })
        }
    }

    fun fingerprint(snapshot: ProgressSnapshot): String = sha256(encode(snapshot).toString())

    private fun filter(table: String): String =
        if (table == "memorization_meta") " WHERE key IN ('milestones_seen','quran_completed_at')" else ""

    companion object {
        private val metadata = setOf("milestones_seen", "quran_completed_at")

        internal fun sha256(value: String): String = MessageDigest.getInstance("SHA-256")
            .digest(value.toByteArray()).joinToString("") { "%02x".format(it) }
    }
}
