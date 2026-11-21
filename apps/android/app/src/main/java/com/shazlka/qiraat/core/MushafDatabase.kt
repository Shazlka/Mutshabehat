package com.shazlka.qiraat.core

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import java.io.Closeable
import java.io.File

sealed class MushafDatabaseException(message: String) : Exception(message) {
    class OpenFailed(message: String) : MushafDatabaseException(message)
    class QueryFailed(message: String) : MushafDatabaseException(message)
    class PageOutOfRange(val page: Int) : MushafDatabaseException("Page out of range: $page")
    class UnsupportedSchema(val version: Int) : MushafDatabaseException("Unsupported schema: $version")
}

/** Read-only access to the byte-for-byte iOS mushaf.sqlite schema v2. */
class MushafDatabase private constructor(internal val database: SQLiteDatabase) : Closeable {
    companion object {
        const val SUPPORTED_SCHEMA_VERSION = 2
        private const val ASSET_PATH = "data/mushaf.sqlite"
        private const val DATABASE_NAME = "mushaf.sqlite"

        fun installBundledDatabase(context: Context): File {
            val target = File(context.noBackupFilesDir, DATABASE_NAME)
            if (!target.exists() || target.length() == 0L) {
                val temporary = File(target.parentFile, "$DATABASE_NAME.tmp")
                context.assets.open(ASSET_PATH).use { input ->
                    temporary.outputStream().buffered().use { output -> input.copyTo(output) }
                }
                if (!temporary.renameTo(target)) {
                    temporary.copyTo(target, overwrite = true)
                    temporary.delete()
                }
            }
            return target
        }

        fun open(file: File): MushafDatabase {
            val db = try {
                SQLiteDatabase.openDatabase(file.absolutePath, null, SQLiteDatabase.OPEN_READONLY)
            } catch (error: Exception) {
                throw MushafDatabaseException.OpenFailed(error.message ?: "Unable to open database")
            }
            val result = MushafDatabase(db)
            val version = db.rawQuery("SELECT value FROM meta WHERE key = 'schema_version'", null).use { cursor ->
                if (cursor.moveToFirst()) cursor.getString(0).toIntOrNull() ?: 0 else 0
            }
            if (version != SUPPORTED_SCHEMA_VERSION) {
                db.close()
                throw MushafDatabaseException.UnsupportedSchema(version)
            }
            return result
        }
    }

    fun surahs(): List<Surah> = database.rawQuery(
        "SELECT number, name, ayah_count, first_page, last_page FROM surahs ORDER BY number", null,
    ).use { cursor ->
        buildList {
            while (cursor.moveToNext()) add(Surah(cursor.getInt(0), cursor.getString(1), cursor.getInt(2), cursor.getInt(3), cursor.getInt(4)))
        }
    }

    fun page(number: Int): MushafPage {
        if (number !in 1..MUSHAF_PAGE_COUNT) throw MushafDatabaseException.PageOutOfRange(number)
        val metadata = database.rawQuery(
            "SELECT first_ayah_key, last_ayah_key, surah_names, juz, hizb, rub_in_juz FROM pages WHERE number = ?",
            arrayOf(number.toString()),
        ).use { cursor ->
            if (!cursor.moveToFirst()) throw MushafDatabaseException.QueryFailed("Missing metadata for page $number")
            val first = AyahKey.parse(cursor.getString(0))
                ?: throw MushafDatabaseException.QueryFailed("Invalid first ayah key '${cursor.getString(0)}' on page $number")
            val last = AyahKey.parse(cursor.getString(1))
                ?: throw MushafDatabaseException.QueryFailed("Invalid last ayah key '${cursor.getString(1)}' on page $number")
            PageMetadata(number, first, last, cursor.getString(2).split('|'), cursor.getInt(3), cursor.getInt(4), cursor.getInt(5))
        }

        val decorations = mutableMapOf<Int, LineDecoration>()
        database.rawQuery("SELECT line, surah_header, basmala FROM decorations WHERE page = ?", arrayOf(number.toString())).use { cursor ->
            while (cursor.moveToNext()) {
                decorations[cursor.getInt(0)] = LineDecoration(if (cursor.isNull(1)) null else cursor.getInt(1), cursor.getInt(2) == 1)
            }
        }

        val byLine = mutableMapOf<Int, MutableList<MushafWord>>()
        database.rawQuery(
            """SELECT id, line, index_in_line, surah, ayah, index_in_ayah, char_type, glyph, text_uthmani
               FROM words WHERE page = ? ORDER BY line, index_in_line""",
            arrayOf(number.toString()),
        ).use { cursor ->
            while (cursor.moveToNext()) {
                val line = cursor.getInt(1)
                byLine.getOrPut(line) { mutableListOf() }.add(
                    MushafWord(cursor.getString(0), number, line, cursor.getInt(2),
                        AyahKey(cursor.getInt(3), cursor.getInt(4)), cursor.getInt(5),
                        CharType.from(cursor.getString(6)), cursor.getString(7), cursor.getString(8)),
                )
            }
        }
        return MushafPage(number, (1..MUSHAF_LINES_PER_PAGE).map { MushafLine(it, byLine[it].orEmpty(), decorations[it]) }, metadata)
    }

    fun juzStartPages(): Map<Int, Int> = database.rawQuery("SELECT juz, MIN(number) FROM pages GROUP BY juz", null).use { cursor ->
        buildMap { while (cursor.moveToNext()) put(cursor.getInt(0), cursor.getInt(1)) }
    }

    fun pageOf(ayah: AyahKey): Int? = database.rawQuery(
        "SELECT MIN(page) FROM words WHERE surah = ? AND ayah = ?", arrayOf(ayah.surah.toString(), ayah.ayah.toString()),
    ).use { cursor -> if (cursor.moveToFirst() && !cursor.isNull(0)) cursor.getInt(0) else null }

    fun ayahText(ayah: AyahKey): String? = database.rawQuery(
        "SELECT ayah_text FROM quran_ayah_search WHERE surah=? AND ayah=?", arrayOf(ayah.surah.toString(), ayah.ayah.toString()),
    ).use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null }

    fun wordPageIndex(): Map<MushafWordCoordinate, Int> = database.rawQuery(
        "SELECT surah, ayah, index_in_ayah, page FROM words WHERE char_type = 'word'", null,
    ).use { cursor ->
        buildMap {
            while (cursor.moveToNext()) {
                val coordinate = MushafWordCoordinate(cursor.getInt(0), cursor.getInt(1), cursor.getInt(2))
                val page = cursor.getInt(3)
                val prior = put(coordinate, page)
                if (prior != null && prior != page) throw MushafDatabaseException.QueryFailed(
                    "Word coordinate ${coordinate.surah}:${coordinate.ayah}:${coordinate.token} is on pages $prior and $page",
                )
            }
        }
    }

    fun searchAyaat(text: String, mode: com.shazlka.qiraat.search.QuranSearchMode = com.shazlka.qiraat.search.QuranSearchMode.SMART, limit: Int = 50) =
        com.shazlka.qiraat.search.QuranSearchEngine(database).search(text, mode, limit)

    override fun close() = database.close()
}
