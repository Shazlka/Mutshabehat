package com.shazlka.qiraat.memorization

import com.shazlka.qiraat.core.AyahKey
import com.shazlka.qiraat.core.MUSHAF_PAGE_COUNT
import java.time.Instant
import java.util.UUID

enum class MemorizationStatus(val rawValue: Int, val titleAr: String, val titleEn: String) {
    MASTERED(1, "متقن", "Mastered"),
    MEMORIZED_WITH_ERRORS(2, "محفوظ بأخطاء", "Memorized with errors"),
    NEEDS_MUSHAF(3, "يحتاج مصحف", "Needs Mushaf"),
    NOT_MEMORIZED(4, "غير محفوظ", "Not memorized");

    companion object {
        fun from(raw: Int): MemorizationStatus = entries.firstOrNull { it.rawValue == raw } ?: NOT_MEMORIZED
    }
}

enum class ReviewStrength(val rawValue: Int, val titleAr: String, val titleEn: String) {
    STRONG(1, "قوي", "Strong"),
    GOOD(2, "جيد", "Good"),
    NEEDS_REVIEW(3, "يحتاج مراجعة", "Needs review"),
    WEAK(4, "ضعيف", "Weak"),
    NOT_REVIEWED(5, "لم يُراجع", "Not reviewed");

    companion object {
        fun from(raw: Int): ReviewStrength = entries.firstOrNull { it.rawValue == raw } ?: NOT_REVIEWED
    }
}

enum class ReviewResult(val rawValue: Int, val titleAr: String, val titleEn: String) {
    EXCELLENT(1, "ممتاز", "Excellent"),
    GOOD(2, "جيد", "Good"),
    MISTAKES(3, "أخطاء", "Mistakes"),
    FORGOT(4, "نسيت", "Forgot");

    companion object {
        fun from(raw: Int): ReviewResult = entries.firstOrNull { it.rawValue == raw } ?: GOOD
    }
}

data class AyahMemorizationRecord(
    val surah: Int,
    val ayah: Int,
    val status: MemorizationStatus,
    val reviewStrength: ReviewStrength,
    val isCurrentlyLearning: Boolean,
    val firstMemorizedAt: Instant? = null,
    val lastStatusChangedAt: Instant? = null,
    val lastReviewedAt: Instant? = null,
    val nextReviewAt: Instant? = null,
    val reviewCount: Int = 0,
    val successfulReviewCount: Int = 0,
    val consecutiveSuccessfulReviews: Int = 0,
    val errorCount: Int = 0,
    val updatedAt: Instant,
) {
    val key: AyahKey get() = AyahKey(surah, ayah)

    companion object {
        fun blank(key: AyahKey, now: Instant): AyahMemorizationRecord = AyahMemorizationRecord(
            surah = key.surah,
            ayah = key.ayah,
            status = MemorizationStatus.NOT_MEMORIZED,
            reviewStrength = ReviewStrength.NOT_REVIEWED,
            isCurrentlyLearning = false,
            updatedAt = now,
        )
    }
}

enum class BatchKind(val value: String) {
    UPDATE("update"),
    REVIEW("review"),
    UNDO("undo"),
    IMPORT("import");

    companion object {
        fun from(v: String): BatchKind = entries.firstOrNull { it.value == v } ?: UPDATE
    }
}

data class BatchRecord(
    val id: UUID,
    val createdAt: Instant,
    val kind: BatchKind,
    val label: String,
    val scopeJSON: String,
    val ayahCount: Int,
    val deviceID: String,
    val countsForStreak: Boolean,
    val gainAyahs: Int,
    val undoneAt: Instant?,
    val undoesBatchID: UUID?,
)

data class ChangeEvent(
    val batchID: UUID,
    val surah: Int,
    val ayah: Int,
    val at: Instant,
    val before: AyahMemorizationRecord?,
    val after: AyahMemorizationRecord,
) {
    val key: AyahKey get() = AyahKey(surah, ayah)
}

data class AyahChange(
    val key: AyahKey,
    val before: AyahMemorizationRecord?,
    val after: AyahMemorizationRecord,
)

data class BatchPlan(
    val kind: BatchKind,
    val label: String,
    val scopeJSON: String,
    val selectionCount: Int,
    val changes: List<AyahChange>,
    val countsForStreak: Boolean,
    val gainAyahs: Int,
) {
    val unchangedCount: Int get() = selectionCount - changes.size
}

sealed interface MemorizationSelection {
    data class Surah(val number: Int) : MemorizationSelection
    data class AyahRange(val surah: Int, val from: Int, val to: Int) : MemorizationSelection
    data class PageRange(val pages: IntRange) : MemorizationSelection
    data class Juz(val number: Int) : MemorizationSelection
    data class Ayat(val keys: Set<AyahKey>) : MemorizationSelection
    data class Span(val from: AyahKey, val to: AyahKey) : MemorizationSelection

    val scopeJSON: String
        get() = when (this) {
            is Surah -> "{\"surah\":$number,\"type\":\"surah\"}"
            is AyahRange -> "{\"from\":$from,\"surah\":$surah,\"to\":$to,\"type\":\"ayahRange\"}"
            is PageRange -> "{\"page\":[${pages.first},${pages.last}],\"type\":\"pageRange\"}"
            is Juz -> "{\"juz\":$number,\"type\":\"juz\"}"
            is Ayat -> "{\"count\":${keys.size},\"type\":\"ayat\"}"
            is Span -> "{\"fromKey\":\"${from}\",\"toKey\":\"${to}\",\"type\":\"span\"}"
        }

    fun resolve(index: QuranIndex): List<AyahKey> = when (this) {
        is Surah -> index.ayatOfSurah(number)
        is AyahRange -> {
            val count = index.ayahCount(surah)
            val lower = maxOf(1, minOf(from, to))
            val upper = minOf(count, maxOf(from, to))
            if (count > 0 && lower <= upper) {
                (lower..upper).map { AyahKey(surah, it) }.filter { index.ordinal(it) != null }
            } else emptyList()
        }
        is PageRange -> index.ayatInPages(pages)
        is Juz -> index.ayatOfJuz(number)
        is Ayat -> keys.mapNotNull { key -> index.ordinal(key)?.let { Pair(key, it) } }
            .sortedBy { it.second }.map { it.first }
        is Span -> index.ayatSpan(from, to)
    }

    fun isWholeSurah(index: QuranIndex): Boolean {
        val keys = resolve(index)
        val first = keys.firstOrNull() ?: return false
        return keys.all { it.surah == first.surah } && keys.size == index.ayahCount(first.surah)
    }
}

enum class SurahState { COMPLETE, PARTIAL, NONE }

data class SurahProgress(
    val surah: Int,
    val ayahCount: Int,
    val counts: Map<MemorizationStatus, Int>,
    val strictPercent: Double,
    val learningPercent: Double,
    val state: SurahState,
    val isCompleteIncludingErrors: Boolean,
)

data class JuzProgress(
    val juz: Int,
    val counts: Map<MemorizationStatus, Int>,
    val strictPercent: Double,
    val learningPercent: Double,
    val isComplete: Boolean,
)

data class PageMix(
    val counts: Map<MemorizationStatus, Int>,
    val fractions: Map<MemorizationStatus, Double>,
    val ayahCount: Int,
    val masteredAyahs: Int,
)

data class MemorizationPageProgress(
    val page: Int,
    val state: MemorizationStatus,
    val mix: PageMix,
)

data class MemorizationSnapshot(
    val totalAyahs: Int,
    val counts: Map<MemorizationStatus, Int>,
    val strictPercent: Double,
    val learningPercent: Double,
    val canReciteCount: Int,
    val surahs: List<SurahProgress>,
    val juz: List<JuzProgress>,
    val completedSurahs: Int,
    val partialSurahs: Int,
    val completeIncludingErrorsSurahs: Int,
    val completedJuz: Int,
    val pages: List<MemorizationPageProgress>,
    val pagesFullyMastered: Int,
    val pageEquivalentMastered: Double,
)

sealed interface Milestone {
    data class SurahCompleted(val surah: Int) : Milestone
    data class JuzCompleted(val juz: Int) : Milestone
    data class Percent(val percent: Int) : Milestone
    data object QuranCompleted : Milestone
}

data class StreakSummary(val current: Int, val longest: Int)

sealed interface Suggestion {
    data class ContinueLearning(val surah: Int, val remaining: Int) : Suggestion
    data class Review(val surah: Int, val daysSinceReview: Int?) : Suggestion
}

sealed interface GoalKind {
    data class AyatPerDay(val count: Int) : GoalKind
    data class PageEquivalentsPerWeek(val pages: Double) : GoalKind
    data class CompleteSurah(val surah: Int) : GoalKind
    data class CompleteJuz(val juz: Int) : GoalKind
    data class CompleteQuranBy(val date: Instant) : GoalKind
}

data class GoalDefinition(
    val id: UUID,
    val kind: GoalKind,
    val createdAt: Instant,
)
