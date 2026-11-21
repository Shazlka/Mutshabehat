package com.shazlka.qiraat.backup

import com.shazlka.qiraat.core.AyahKey
import com.shazlka.qiraat.memorization.*
import com.shazlka.qiraat.reading.ReadingStore
import com.shazlka.qiraat.mutshabehat.MutshabehatStore
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.time.Instant
import java.time.format.DateTimeFormatter
import java.util.UUID

class BackupService(
    val memorizationStore: MemorizationStore,
    val readingStore: ReadingStore,
    val mutshabehatStore: MutshabehatStore,
) {
    companion object {
        fun formatInstant(instant: Instant?): String? {
            return instant?.toString()
        }

        fun parseInstant(str: String?): Instant? {
            if (str == null || str == "null" || str.isBlank()) return null
            return runCatching { Instant.parse(str) }.getOrNull()
        }
    }

    fun buildCurrentMemorizationExport(): MemorizationExport {
        val records = memorizationStore.allRecords.values.toList()
        val batches = memorizationStore.database.batches(1000, 0)
        val events = batches.flatMap { memorizationStore.database.events(it.id) }
        val metaMap = buildMap {
            memorizationStore.database.meta("schema_version")?.let { put("schema_version", it) }
            memorizationStore.database.meta("milestones_seen")?.let { put("milestones_seen", it) }
            memorizationStore.database.meta("quran_completed_at")?.let { put("quran_completed_at", it) }
        }

        return MemorizationExport(
            formatVersion = 1,
            exportedAt = Instant.now(),
            deviceID = memorizationStore.database.deviceID,
            records = records,
            batches = batches,
            events = events,
            goals = emptyList(),
            meta = metaMap,
        )
    }

    fun exportMemorizationToJson(): String {
        val export = buildCurrentMemorizationExport()
        return serializeExport(export)
    }

    fun serializeExport(export: MemorizationExport): String {
        val json = JSONObject()
        json.put("formatVersion", export.formatVersion)
        json.put("exportedAt", export.exportedAt.toString())
        json.put("deviceID", export.deviceID)

        val recordsArr = JSONArray()
        for (r in export.records) {
            val rObj = JSONObject()
            rObj.put("surah", r.surah)
            rObj.put("ayah", r.ayah)
            rObj.put("status", r.status.rawValue)
            rObj.put("reviewStrength", r.reviewStrength.rawValue)
            rObj.put("isCurrentlyLearning", r.isCurrentlyLearning)
            rObj.put("firstMemorizedAt", r.firstMemorizedAt?.toString())
            rObj.put("lastStatusChangedAt", r.lastStatusChangedAt?.toString())
            rObj.put("lastReviewedAt", r.lastReviewedAt?.toString())
            rObj.put("nextReviewAt", r.nextReviewAt?.toString())
            rObj.put("reviewCount", r.reviewCount)
            rObj.put("successfulReviewCount", r.successfulReviewCount)
            rObj.put("consecutiveSuccessfulReviews", r.consecutiveSuccessfulReviews)
            rObj.put("errorCount", r.errorCount)
            rObj.put("updatedAt", r.updatedAt.toString())
            recordsArr.put(rObj)
        }
        json.put("records", recordsArr)

        val batchesArr = JSONArray()
        for (b in export.batches) {
            val bObj = JSONObject()
            bObj.put("id", b.id.toString())
            bObj.put("createdAt", b.createdAt.toString())
            bObj.put("kind", b.kind.value)
            bObj.put("label", b.label)
            bObj.put("scopeJSON", b.scopeJSON)
            bObj.put("ayahCount", b.ayahCount)
            bObj.put("deviceID", b.deviceID)
            bObj.put("countsForStreak", b.countsForStreak)
            bObj.put("gainAyahs", b.gainAyahs)
            bObj.put("undoneAt", b.undoneAt?.toString())
            bObj.put("undoesBatchID", b.undoesBatchID?.toString())
            batchesArr.put(bObj)
        }
        json.put("batches", batchesArr)

        val eventsArr = JSONArray()
        for (e in export.events) {
            val eObj = JSONObject()
            eObj.put("batchID", e.batchID.toString())
            eObj.put("surah", e.surah)
            eObj.put("ayah", e.ayah)
            eObj.put("at", e.at.toString())
            eventsArr.put(eObj)
        }
        json.put("events", eventsArr)

        val metaObj = JSONObject()
        for ((k, v) in export.meta) {
            metaObj.put(k, v)
        }
        json.put("meta", metaObj)
        json.put("goals", JSONArray())

        return json.toString(2)
    }

    fun parseExport(jsonStr: String): MemorizationExport {
        val root = JSONObject(jsonStr)
        val formatVersion = root.optInt("formatVersion", 1)
        val exportedAt = parseInstant(root.getString("exportedAt")) ?: Instant.now()
        val deviceID = root.optString("deviceID", "unknown")

        val recordsList = mutableListOf<AyahMemorizationRecord>()
        val recordsArr = root.optJSONArray("records")
        if (recordsArr != null) {
            for (i in 0 until recordsArr.length()) {
                val obj = recordsArr.getJSONObject(i)
                val surah = obj.getInt("surah")
                val ayah = obj.getInt("ayah")
                val status = MemorizationStatus.from(obj.getInt("status"))
                val strength = ReviewStrength.from(obj.getInt("reviewStrength"))
                val isLearning = obj.optBoolean("isCurrentlyLearning", false)
                val firstMem = parseInstant(obj.optString("firstMemorizedAt"))
                val lastStatus = parseInstant(obj.optString("lastStatusChangedAt"))
                val lastRev = parseInstant(obj.optString("lastReviewedAt"))
                val nextRev = parseInstant(obj.optString("nextReviewAt"))
                val reviewCount = obj.optInt("reviewCount", 0)
                val succCount = obj.optInt("successfulReviewCount", 0)
                val consec = obj.optInt("consecutiveSuccessfulReviews", 0)
                val errCount = obj.optInt("errorCount", 0)
                val updatedAt = parseInstant(obj.getString("updatedAt")) ?: Instant.now()

                recordsList.add(
                    AyahMemorizationRecord(
                        surah = surah,
                        ayah = ayah,
                        status = status,
                        reviewStrength = strength,
                        isCurrentlyLearning = isLearning,
                        firstMemorizedAt = firstMem,
                        lastStatusChangedAt = lastStatus,
                        lastReviewedAt = lastRev,
                        nextReviewAt = nextRev,
                        reviewCount = reviewCount,
                        successfulReviewCount = succCount,
                        consecutiveSuccessfulReviews = consec,
                        errorCount = errCount,
                        updatedAt = updatedAt,
                    )
                )
            }
        }

        val batchesList = mutableListOf<BatchRecord>()
        val batchesArr = root.optJSONArray("batches")
        if (batchesArr != null) {
            for (i in 0 until batchesArr.length()) {
                val obj = batchesArr.getJSONObject(i)
                val id = UUID.fromString(obj.getString("id"))
                val createdAt = parseInstant(obj.getString("createdAt")) ?: Instant.now()
                val kind = BatchKind.from(obj.getString("kind"))
                val label = obj.optString("label", "")
                val scopeJSON = obj.optString("scopeJSON", "{}")
                val ayahCount = obj.optInt("ayahCount", 0)
                val devId = obj.optString("deviceID", "unknown")
                val streak = obj.optBoolean("countsForStreak", false)
                val gain = obj.optInt("gainAyahs", 0)
                val undoneAt = parseInstant(obj.optString("undoneAt"))
                val undoesID = obj.optString("undoesBatchID")?.takeIf { it.isNotBlank() && it != "null" }?.let { UUID.fromString(it) }

                batchesList.add(
                    BatchRecord(id, createdAt, kind, label, scopeJSON, ayahCount, devId, streak, gain, undoneAt, undoesID)
                )
            }
        }

        val eventsList = mutableListOf<ChangeEvent>()
        val eventsArr = root.optJSONArray("events")
        if (eventsArr != null) {
            for (i in 0 until eventsArr.length()) {
                val obj = eventsArr.getJSONObject(i)
                val bid = UUID.fromString(obj.getString("batchID"))
                val surah = obj.getInt("surah")
                val ayah = obj.getInt("ayah")
                val at = parseInstant(obj.getString("at")) ?: Instant.now()
                val blank = AyahMemorizationRecord.blank(AyahKey(surah, ayah), at)
                eventsList.add(ChangeEvent(bid, surah, ayah, at, null, blank))
            }
        }

        val metaMap = mutableMapOf<String, String>()
        val metaObj = root.optJSONObject("meta")
        if (metaObj != null) {
            for (key in metaObj.keys()) {
                metaMap[key] = metaObj.getString(key)
            }
        }

        return MemorizationExport(
            formatVersion = formatVersion,
            exportedAt = exportedAt,
            deviceID = deviceID,
            records = recordsList,
            batches = batchesList,
            events = eventsList,
            goals = emptyList(),
            meta = metaMap,
        )
    }

    fun importMemorizationJson(jsonStr: String, mode: MemorizationRestoreMode) {
        val incoming = parseExport(jsonStr)
        val finalExport = if (mode == MemorizationRestoreMode.MERGE) {
            val local = buildCurrentMemorizationExport()
            MemorizationMerge.merge(local, incoming)
        } else {
            incoming
        }

        val plan = BatchPlan(
            kind = BatchKind.IMPORT,
            label = if (mode == MemorizationRestoreMode.MERGE) "دمج استيراد الحفظ" else "استبدال الحفظ",
            scopeJSON = "{\"type\":\"import\"}",
            selectionCount = finalExport.records.size,
            changes = finalExport.records.map { AyahChange(it.key, null, it) },
            countsForStreak = false,
            gainAyahs = 0,
        )
        memorizationStore.apply(plan)
    }

    fun buildBackupManifest(folder: File): BackupManifest {
        val files = mutableListOf<BackupFileEntry>()
        val memoBytes = memorizationStore.database.databaseFile.takeIf { it.exists() }?.readBytes() ?: ByteArray(0)
        files.add(BackupFileEntry("memorization.sqlite", BackupHash.sha256Hex(memoBytes), memoBytes.size.toLong()))

        val readBytes = readingStore.databaseFile.takeIf { it.exists() }?.readBytes() ?: ByteArray(0)
        files.add(BackupFileEntry("reading.sqlite", BackupHash.sha256Hex(readBytes), readBytes.size.toLong()))

        val jsonBytes = exportMemorizationToJson().toByteArray(Charsets.UTF_8)
        files.add(BackupFileEntry("memorization.json", BackupHash.sha256Hex(jsonBytes), jsonBytes.size.toLong(), rowCount = memorizationStore.allRecords.size))

        return BackupManifest(
            formatVersion = 1,
            createdAt = Instant.now(),
            deviceID = memorizationStore.database.deviceID,
            appVersion = "0.4.0-phase4",
            files = files,
        )
    }
}
