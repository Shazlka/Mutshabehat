package com.shazlka.qiraat.mutshabehat

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import java.io.Closeable
import java.io.File
import java.time.Instant

interface MutshabehatStore {
    fun groups(query: String = "", surah: String? = null): List<PersonalGroup>
    fun group(id: String): PersonalGroup?
    fun save(group: PersonalGroup)
    fun delete(id: String)
    fun toggleFavorite(id: String)
}

class SQLiteMutshabehatStore private constructor(private val db: SQLiteDatabase) : MutshabehatStore, Closeable {
    companion object {
        private const val ASSET = "data/mutshabehat.sqlite"
        private const val NAME = "mutshabehat.sqlite"

        fun open(context: Context): SQLiteMutshabehatStore {
            val target = File(context.noBackupFilesDir, NAME)
            if (!target.exists() || target.length() == 0L) {
                val temporary = File(target.parentFile, "$NAME.tmp")
                context.assets.open(ASSET).use { input -> temporary.outputStream().use(input::copyTo) }
                if (!temporary.renameTo(target)) { temporary.copyTo(target, overwrite = true); temporary.delete() }
            }
            return open(target)
        }

        fun open(file: File): SQLiteMutshabehatStore {
            val database = SQLiteDatabase.openOrCreateDatabase(file, null)
            database.execSQL("PRAGMA foreign_keys=ON")
            database.execSQL("CREATE TABLE IF NOT EXISTS groups(id TEXT PRIMARY KEY,title TEXT NOT NULL,color TEXT,status TEXT,favorite INTEGER DEFAULT 0,completed INTEGER DEFAULT 0,note TEXT,unote TEXT,created_at TEXT,updated_at TEXT)")
            database.execSQL("CREATE TABLE IF NOT EXISTS verses(id TEXT PRIMARY KEY,group_id TEXT NOT NULL,surah TEXT,ayah INTEGER,label TEXT,sort_order INTEGER DEFAULT 0,FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE)")
            database.execSQL("CREATE TABLE IF NOT EXISTS parts(id TEXT PRIMARY KEY,verse_id TEXT NOT NULL,type TEXT NOT NULL,text TEXT NOT NULL,sort_order INTEGER DEFAULT 0,FOREIGN KEY(verse_id) REFERENCES verses(id) ON DELETE CASCADE)")
            database.execSQL("CREATE TABLE IF NOT EXISTS automated_groups(id INTEGER PRIMARY KEY,legacy_id TEXT,title TEXT NOT NULL,color TEXT,surahs TEXT,payload TEXT NOT NULL,copied INTEGER DEFAULT 0)")
            database.execSQL("CREATE TABLE IF NOT EXISTS group_deletions(group_id TEXT PRIMARY KEY, deleted_at TEXT NOT NULL)")
            database.execSQL("CREATE INDEX IF NOT EXISTS idx_verses_group ON verses(group_id)")
            database.execSQL("CREATE INDEX IF NOT EXISTS idx_parts_verse ON parts(verse_id)")
            return SQLiteMutshabehatStore(database)
        }

        internal fun escapeLike(value: String) = value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    }

    @Synchronized override fun groups(query: String, surah: String?): List<PersonalGroup> {
        val where = mutableListOf<String>()
        val args = mutableListOf<String>()
        if (!surah.isNullOrBlank()) { where += "id IN (SELECT group_id FROM verses WHERE surah=?)"; args += surah }
        if (query.isNotBlank()) {
            where += "(title LIKE ? ESCAPE '\\' OR id IN (SELECT v.group_id FROM verses v JOIN parts p ON p.verse_id=v.id WHERE p.text LIKE ? ESCAPE '\\'))"
            val pattern = "%${escapeLike(query)}%"; args += pattern; args += pattern
        }
        val sql = "SELECT id,title,color,status,favorite,completed,note,unote,created_at,updated_at FROM groups" +
            (if (where.isEmpty()) "" else " WHERE ${where.joinToString(" AND ")}") + " ORDER BY favorite DESC,title ASC"
        return attach(readGroups(sql, args.toTypedArray()))
    }

    @Synchronized override fun group(id: String): PersonalGroup? = attach(readGroups(
        "SELECT id,title,color,status,favorite,completed,note,unote,created_at,updated_at FROM groups WHERE id=? LIMIT 1", arrayOf(id),
    )).firstOrNull()

    private fun readGroups(sql: String, args: Array<String>) = db.rawQuery(sql, args).use { cursor -> buildList {
        while (cursor.moveToNext()) add(PersonalGroup(
            id = cursor.getString(0), title = cursor.getString(1), color = cursor.getString(2) ?: "#55b94f",
            status = cursor.getString(3) ?: "draft", favorite = cursor.getInt(4) != 0, completed = cursor.getInt(5) != 0,
            note = cursor.getString(6), unote = cursor.getString(7), createdAt = cursor.getString(8), updatedAt = cursor.getString(9),
        ))
    } }

    private fun attach(groups: List<PersonalGroup>): List<PersonalGroup> = groups.map { group ->
        val verses = db.rawQuery("SELECT id,surah,ayah,label,sort_order FROM verses WHERE group_id=? ORDER BY sort_order", arrayOf(group.id)).use { cursor -> buildList {
            while (cursor.moveToNext()) {
                val verseId = cursor.getString(0)
                val parts = db.rawQuery("SELECT id,type,text,sort_order FROM parts WHERE verse_id=? ORDER BY sort_order", arrayOf(verseId)).use { pc -> buildList {
                    while (pc.moveToNext()) add(PersonalPart(pc.getString(0), pc.getString(1), pc.getString(2), pc.getInt(3)))
                } }
                add(PersonalVerse(verseId, group.id, cursor.getString(1) ?: "", cursor.getInt(2), cursor.getString(3), cursor.getInt(4), parts))
            }
        } }
        group.copy(verses = verses)
    }

    @Synchronized override fun save(group: PersonalGroup) = transaction {
        val now = Instant.now().toString()
        db.delete("group_deletions", "group_id=?", arrayOf(group.id))
        db.insertWithOnConflict("groups", null, ContentValues().apply {
            put("id", group.id); put("title", group.title); put("color", group.color); put("status", group.status)
            put("favorite", if (group.favorite) 1 else 0); put("completed", if (group.completed) 1 else 0)
            put("note", group.note); put("unote", group.unote); put("created_at", group.createdAt ?: now); put("updated_at", now)
        }, SQLiteDatabase.CONFLICT_REPLACE).also { check(it != -1L) }
        deleteChildren(group.id)
        group.verses.forEachIndexed { vi, verse ->
            db.insertOrThrow("verses", null, ContentValues().apply {
                put("id", verse.id); put("group_id", group.id); put("surah", verse.surah); put("ayah", verse.ayah); put("label", verse.label); put("sort_order", vi)
            })
            verse.parts.forEachIndexed { pi, part -> db.insertOrThrow("parts", null, ContentValues().apply {
                put("id", part.id); put("verse_id", verse.id); put("type", part.type); put("text", part.text); put("sort_order", pi)
            }) }
        }
    }

    @Synchronized override fun delete(id: String) = transaction {
        deleteChildren(id); db.delete("groups", "id=?", arrayOf(id))
        db.insertWithOnConflict("group_deletions", null, ContentValues().apply { put("group_id", id); put("deleted_at", Instant.now().toString()) }, SQLiteDatabase.CONFLICT_REPLACE)
    }

    @Synchronized override fun toggleFavorite(id: String) {
        db.execSQL("UPDATE groups SET favorite=CASE favorite WHEN 1 THEN 0 ELSE 1 END,updated_at=? WHERE id=?", arrayOf(Instant.now().toString(), id))
    }

    private fun deleteChildren(id: String) {
        db.execSQL("DELETE FROM parts WHERE verse_id IN (SELECT id FROM verses WHERE group_id=?)", arrayOf(id))
        db.delete("verses", "group_id=?", arrayOf(id))
    }
    private inline fun transaction(body: () -> Unit) { db.beginTransaction(); try { body(); db.setTransactionSuccessful() } finally { db.endTransaction() } }
    override fun close() = db.close()
}
