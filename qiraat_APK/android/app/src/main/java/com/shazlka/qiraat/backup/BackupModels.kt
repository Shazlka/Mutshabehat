package com.shazlka.qiraat.backup

import com.shazlka.qiraat.core.AyahKey
import com.shazlka.qiraat.memorization.AyahMemorizationRecord
import com.shazlka.qiraat.memorization.BatchRecord
import com.shazlka.qiraat.memorization.ChangeEvent
import com.shazlka.qiraat.memorization.GoalDefinition
import kotlinx.serialization.Serializable
import java.security.MessageDigest
import java.time.Instant

data class BackupFileEntry(
    val name: String,
    val sha256: String,
    val size: Long,
    val rowCount: Int? = null,
)

data class BackupManifest(
    val formatVersion: Int = 1,
    val createdAt: Instant,
    val deviceID: String,
    val appVersion: String,
    val files: List<BackupFileEntry>,
)

data class MemorizationExport(
    val formatVersion: Int = 1,
    val exportedAt: Instant,
    val deviceID: String,
    val records: List<AyahMemorizationRecord>,
    val batches: List<BatchRecord>,
    val events: List<ChangeEvent>,
    val goals: List<GoalDefinition> = emptyList(),
    val meta: Map<String, String> = emptyMap(),
)

object BackupHash {
    fun sha256Hex(bytes: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(bytes)
        return hash.joinToString("") { "%02x".format(it) }
    }
}

enum class MemorizationRestoreMode {
    MERGE,
    REPLACE,
}

object MemorizationMerge {
    fun merge(local: MemorizationExport, incoming: MemorizationExport): MemorizationExport {
        val records = local.records.associateBy { it.key }.toMutableMap()
        for (record in incoming.records) {
            val existing = records[record.key]
            if (existing == null || record.updatedAt > existing.updatedAt) {
                records[record.key] = record
            }
        }

        val batches = local.batches.associateBy { it.id }.toMutableMap()
        for (batch in incoming.batches) {
            val existing = batches[batch.id]
            if (existing != null) {
                if (existing.undoneAt == null && batch.undoneAt != null) {
                    batches[batch.id] = batch
                }
            } else {
                batches[batch.id] = batch
            }
        }

        fun eventKey(event: ChangeEvent): String = "${event.batchID}|${event.surah}|${event.ayah}"
        val events = local.events.associateBy { eventKey(it) }.toMutableMap()
        for (event in incoming.events) {
            val key = eventKey(event)
            if (!events.containsKey(key)) {
                events[key] = event
            }
        }

        val goals = local.goals.associateBy { it.id }.toMutableMap()
        for (goal in incoming.goals) {
            if (!goals.containsKey(goal.id)) {
                goals[goal.id] = goal
            }
        }

        val meta = local.meta.toMutableMap()
        for ((key, value) in incoming.meta) {
            when (key) {
                "device_id" -> continue
                "quran_completed_at" -> {
                    val localVal = meta[key]
                    meta[key] = if (localVal != null) {
                        if (value < localVal) value else localVal
                    } else value
                }
                "milestones_seen" -> {
                    val localSet = (meta[key] ?: "").split(',').filter { it.isNotBlank() }.toSet()
                    val incomingSet = value.split(',').filter { it.isNotBlank() }.toSet()
                    meta[key] = (localSet + incomingSet).sorted().joinToString(",")
                }
                else -> {
                    if (!meta.containsKey(key)) {
                        meta[key] = value
                    }
                }
            }
        }

        val maxExported = if (incoming.exportedAt > local.exportedAt) incoming.exportedAt else local.exportedAt
        return MemorizationExport(
            formatVersion = 1,
            exportedAt = maxExported,
            deviceID = local.deviceID,
            records = records.values.sortedWith(compareBy({ it.surah }, { it.ayah })),
            batches = batches.values.sortedWith(compareBy({ it.createdAt }, { it.id.toString() })),
            events = events.values.sortedWith(compareBy({ it.at }, { it.batchID.toString() }, { it.surah }, { it.ayah })),
            goals = goals.values.sortedWith(compareBy({ it.createdAt }, { it.id.toString() })),
            meta = meta,
        )
    }
}
