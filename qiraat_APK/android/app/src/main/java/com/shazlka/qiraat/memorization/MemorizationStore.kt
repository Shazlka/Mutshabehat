package com.shazlka.qiraat.memorization

import android.content.SharedPreferences
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.shazlka.qiraat.core.AyahKey
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

class MemorizationStore(
    val database: MemorizationStoreDatabase,
    val index: QuranIndex,
    val policy: MemorizationPolicy = MemorizationPolicy.standard,
    private val clock: () -> Instant = { Instant.now() },
    private val preferences: SharedPreferences? = null,
) {
    data class ApplyResult(
        val batch: BatchRecord,
        val milestones: List<Milestone>,
    )

    private val records = mutableMapOf<AyahKey, AyahMemorizationRecord>()
    private var snapshotCache: Pair<Int, MemorizationSnapshot>? = null

    var version: Int by mutableIntStateOf(0)
        private set

    var onDataChanged: (() -> Unit)? = null

    var showsBannerMark: Boolean by mutableStateOf(preferences?.getBoolean(BANNER_MARK_KEY, true) ?: true)
    var showsAyahMarker: Boolean by mutableStateOf(preferences?.getBoolean(AYAH_MARKER_KEY, false) ?: false)

    companion object {
        const val BANNER_MARK_KEY = "memorization:show-banner-mark:v1"
        const val AYAH_MARKER_KEY = "memorization:show-ayah-marker:v1"
        private const val QURAN_COMPLETED_KEY = "quran_completed_at"
        private const val MILESTONES_SEEN_KEY = "milestones_seen"
    }

    init {
        records.putAll(database.loadRecords())
    }

    fun updateBannerMark(value: Boolean) {
        showsBannerMark = value
        preferences?.edit()?.putBoolean(BANNER_MARK_KEY, value)?.apply()
    }

    fun updateAyahMarker(value: Boolean) {
        showsAyahMarker = value
        preferences?.edit()?.putBoolean(AYAH_MARKER_KEY, value)?.apply()
    }

    val quranCompletedAt: Instant?
        get() = database.meta(QURAN_COMPLETED_KEY)?.let { runCatching { Instant.parse(it) }.getOrNull() }

    fun record(key: AyahKey): AyahMemorizationRecord? {
        val v = version
        return records[key]
    }

    fun status(key: AyahKey): MemorizationStatus {
        val v = version
        return records[key]?.status ?: MemorizationStatus.NOT_MEMORIZED
    }

    val snapshot: MemorizationSnapshot
        get() {
            val currentVersion = version
            val cached = snapshotCache
            if (cached != null && cached.first == currentVersion) {
                return cached.second
            }
            val value = MemorizationStatisticsService.snapshot(records, index, policy)
            snapshotCache = Pair(currentVersion, value)
            return value
        }

    fun pageProgress(page: Int): MemorizationPageProgress {
        val v = version
        return MemorizationStatisticsService.pageProgress(page, records, index)
    }

    fun statuses(onPage: Int): Map<AyahKey, MemorizationStatus> {
        val v = version
        val result = mutableMapOf<AyahKey, MemorizationStatus>()
        for (key in index.ayatOnPage(onPage)) {
            val st = records[key]?.status
            if (st != null && st != MemorizationStatus.NOT_MEMORIZED) {
                result[key] = st
            }
        }
        return result
    }

    val allRecords: Map<AyahKey, AyahMemorizationRecord>
        get() {
            val v = version
            return records.toMap()
        }

    val streak: StreakSummary
        get() {
            val v = version
            return StreakCalculator.summary(database.qualifyingDays(), LocalDate.now())
        }

    val suggestion: Suggestion?
        get() {
            val v = version
            return SuggestionEngine.suggest(records, index, clock())
        }

    fun plan(
        selection: MemorizationSelection,
        label: String,
        status: MemorizationStatus,
        learning: Boolean? = null,
    ): BatchPlan {
        return MemorizationPlanner.planUpdate(selection, label, status, learning, records, index, clock())
    }

    fun reviewPlan(
        selection: MemorizationSelection,
        label: String,
        result: ReviewResult,
    ): BatchPlan {
        return MemorizationPlanner.planReview(selection, label, result, records, index, clock(), policy)
    }

    fun needsConfirmation(selection: MemorizationSelection, plan: BatchPlan): Boolean {
        return MemorizationPlanner.needsConfirmation(selection, plan, index, policy)
    }

    @Synchronized
    fun apply(plan: BatchPlan): ApplyResult {
        val before = snapshot
        val now = clock()
        val batch = database.apply(plan, now)
        for (change in plan.changes) {
            records[change.key] = change.after
        }
        version++
        val after = snapshot
        val milestones = reportNew(MemorizationPlanner.milestones(before, after, policy))
        recordCompletionIfNeeded(after, now)
        onDataChanged?.invoke()
        return ApplyResult(batch, milestones)
    }

    fun update(
        selection: MemorizationSelection,
        label: String,
        status: MemorizationStatus,
        learning: Boolean? = null,
    ): ApplyResult {
        return apply(plan(selection, label, status, learning))
    }

    fun review(
        selection: MemorizationSelection,
        label: String,
        result: ReviewResult,
    ): ApplyResult {
        return apply(reviewPlan(selection, label, result))
    }

    @Synchronized
    fun undo(batchID: UUID, force: Boolean = false) {
        database.undo(batchID, force, clock())
        records.clear()
        records.putAll(database.loadRecords())
        version++
        onDataChanged?.invoke()
    }

    private fun reportNew(milestones: List<Milestone>): List<Milestone> {
        val seenRaw = database.meta(MILESTONES_SEEN_KEY) ?: ""
        val seen = seenRaw.split(',').filter { it.isNotBlank() }.toMutableSet()
        val newlyReached = mutableListOf<Milestone>()

        for (m in milestones) {
            val tag = when (m) {
                is Milestone.SurahCompleted -> "surah:${m.surah}"
                is Milestone.JuzCompleted -> "juz:${m.juz}"
                is Milestone.Percent -> "percent:${m.percent}"
                is Milestone.QuranCompleted -> "quran"
            }
            if (!seen.contains(tag)) {
                seen.add(tag)
                newlyReached.add(m)
            }
        }
        if (newlyReached.isNotEmpty()) {
            database.setMeta(MILESTONES_SEEN_KEY, seen.joinToString(","))
        }
        return newlyReached
    }

    private fun recordCompletionIfNeeded(after: MemorizationSnapshot, now: Instant) {
        if (after.totalAyahs > 0 && (after.counts[MemorizationStatus.MASTERED] ?: 0) == after.totalAyahs) {
            if (database.meta(QURAN_COMPLETED_KEY) == null) {
                database.setMeta(QURAN_COMPLETED_KEY, now.toString())
            }
        }
    }
}
