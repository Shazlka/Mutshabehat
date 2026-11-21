package com.shazlka.qiraat.memorization

import com.shazlka.qiraat.core.AyahKey
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.ChronoUnit

object ReviewEngine {
    private const val DAY_MILLIS: Long = 86_400_000L

    fun isMemorized(status: MemorizationStatus): Boolean =
        status == MemorizationStatus.MASTERED || status == MemorizationStatus.MEMORIZED_WITH_ERRORS

    fun apply(
        result: ReviewResult,
        record: AyahMemorizationRecord,
        now: Instant,
        policy: MemorizationPolicy = MemorizationPolicy.standard,
    ): AyahMemorizationRecord {
        val normalizedNow = Instant.ofEpochMilli(now.toEpochMilli())
        var reviewCount = record.reviewCount + 1
        var successfulReviewCount = record.successfulReviewCount
        var consecutiveSuccessfulReviews = record.consecutiveSuccessfulReviews
        var errorCount = record.errorCount
        val reviewStrength: ReviewStrength

        val intervalDays: Int
        when (result) {
            ReviewResult.EXCELLENT, ReviewResult.GOOD -> {
                successfulReviewCount += 1
                consecutiveSuccessfulReviews += 1
                val ladder = policy.intervalLadderDays
                val idx = minOf(consecutiveSuccessfulReviews, ladder.size) - 1
                intervalDays = if (ladder.isNotEmpty() && idx >= 0) ladder[idx] else 1
                reviewStrength = if (result == ReviewResult.EXCELLENT) ReviewStrength.STRONG else ReviewStrength.GOOD
            }
            ReviewResult.MISTAKES -> {
                consecutiveSuccessfulReviews = 0
                errorCount += 1
                intervalDays = policy.mistakesIntervalDays
                reviewStrength = ReviewStrength.NEEDS_REVIEW
            }
            ReviewResult.FORGOT -> {
                consecutiveSuccessfulReviews = 0
                errorCount += 1
                intervalDays = policy.forgotIntervalDays
                reviewStrength = ReviewStrength.WEAK
            }
        }

        val nextReviewAt = normalizedNow.plusMillis(intervalDays * DAY_MILLIS)

        return record.copy(
            reviewStrength = reviewStrength,
            reviewCount = reviewCount,
            successfulReviewCount = successfulReviewCount,
            consecutiveSuccessfulReviews = consecutiveSuccessfulReviews,
            errorCount = errorCount,
            lastReviewedAt = normalizedNow,
            nextReviewAt = nextReviewAt,
            updatedAt = normalizedNow,
        )
    }

    fun isDue(record: AyahMemorizationRecord, now: Instant): Boolean {
        if (!isMemorized(record.status)) return false
        val due = record.nextReviewAt ?: return true
        return due <= now
    }
}

object MemorizationPlanner {

    fun isMemorized(status: MemorizationStatus): Boolean =
        status == MemorizationStatus.MASTERED || status == MemorizationStatus.MEMORIZED_WITH_ERRORS

    fun planUpdate(
        selection: MemorizationSelection,
        label: String,
        status: MemorizationStatus,
        learning: Boolean? = null,
        records: Map<AyahKey, AyahMemorizationRecord>,
        index: QuranIndex,
        now: Instant,
    ): BatchPlan {
        val normalizedNow = Instant.ofEpochMilli(now.toEpochMilli())
        val keys = selection.resolve(index)
        val changes = mutableListOf<AyahChange>()
        var gain = 0
        var improved = false

        for (key in keys) {
            val current = records[key]
            val base = current ?: AyahMemorizationRecord.blank(key, normalizedNow)
            val statusChanges = base.status != status
            var newLearning = base.isCurrentlyLearning
            if (learning != null) {
                newLearning = learning
            } else if (statusChanges && status == MemorizationStatus.MASTERED) {
                newLearning = false
            }

            if (!statusChanges && newLearning == base.isCurrentlyLearning) continue

            var after = base.copy(
                status = status,
                isCurrentlyLearning = newLearning,
                updatedAt = normalizedNow,
            )

            if (statusChanges) {
                var firstMem = after.firstMemorizedAt
                if (isMemorized(status) && firstMem == null) {
                    firstMem = normalizedNow
                }
                if (isMemorized(status) && status.rawValue < base.status.rawValue) {
                    improved = true
                }
                if (isMemorized(status) && !isMemorized(base.status)) {
                    gain += 1
                }
                after = after.copy(
                    lastStatusChangedAt = normalizedNow,
                    firstMemorizedAt = firstMem,
                )
            }
            changes.add(AyahChange(key, current, after))
        }

        return BatchPlan(
            kind = BatchKind.UPDATE,
            label = label,
            scopeJSON = selection.scopeJSON,
            selectionCount = keys.size,
            changes = changes,
            countsForStreak = improved,
            gainAyahs = gain,
        )
    }

    fun planReview(
        selection: MemorizationSelection,
        label: String,
        result: ReviewResult,
        records: Map<AyahKey, AyahMemorizationRecord>,
        index: QuranIndex,
        now: Instant,
        policy: MemorizationPolicy = MemorizationPolicy.standard,
    ): BatchPlan {
        val keys = selection.resolve(index)
        val changes = mutableListOf<AyahChange>()
        for (key in keys) {
            val current = records[key] ?: continue
            if (current.status == MemorizationStatus.NOT_MEMORIZED) continue
            val after = ReviewEngine.apply(result, current, now, policy)
            changes.add(AyahChange(key, current, after))
        }
        return BatchPlan(
            kind = BatchKind.REVIEW,
            label = label,
            scopeJSON = selection.scopeJSON,
            selectionCount = keys.size,
            changes = changes,
            countsForStreak = changes.isNotEmpty(),
            gainAyahs = 0,
        )
    }

    fun needsConfirmation(
        selection: MemorizationSelection,
        plan: BatchPlan,
        index: QuranIndex,
        policy: MemorizationPolicy = MemorizationPolicy.standard,
    ): Boolean {
        return selection.isWholeSurah(index) || plan.selectionCount > policy.confirmationAyahThreshold
    }

    fun milestones(
        before: MemorizationSnapshot,
        after: MemorizationSnapshot,
        policy: MemorizationPolicy = MemorizationPolicy.standard,
    ): List<Milestone> {
        val result = mutableListOf<Milestone>()

        val surahsBefore = before.surahs.associate { it.surah to it.state }
        for (surah in after.surahs) {
            if (surah.state == SurahState.COMPLETE && surahsBefore[surah.surah] != SurahState.COMPLETE) {
                result.add(Milestone.SurahCompleted(surah.surah))
            }
        }

        val juzBefore = before.juz.associate { it.juz to it.isComplete }
        for (juz in after.juz) {
            if (juz.isComplete && juzBefore[juz.juz] != true) {
                result.add(Milestone.JuzCompleted(juz.juz))
            }
        }

        val epsilon = 1e-9
        for (percent in policy.milestonePercents.sorted()) {
            if (percent < 100) {
                val threshold = percent.toDouble()
                if (before.strictPercent < threshold - epsilon && after.strictPercent >= threshold - epsilon) {
                    result.add(Milestone.Percent(percent))
                }
            }
        }

        val beforeComplete = before.totalAyahs > 0 && (before.counts[MemorizationStatus.MASTERED] ?: 0) == before.totalAyahs
        val afterComplete = after.totalAyahs > 0 && (after.counts[MemorizationStatus.MASTERED] ?: 0) == after.totalAyahs
        if (afterComplete && !beforeComplete) {
            result.add(Milestone.QuranCompleted)
        }

        return result
    }
}

object StreakCalculator {
    fun summary(qualifyingDays: Set<LocalDate>, now: LocalDate): StreakSummary {
        if (qualifyingDays.isEmpty()) return StreakSummary(0, 0)

        var longest = 0
        var run = 0
        var previous: LocalDate? = null

        val sortedDays = qualifyingDays.sorted()
        for (day in sortedDays) {
            if (previous != null && previous.plusDays(1) == day) {
                run += 1
            } else {
                run = 1
            }
            longest = maxOf(longest, run)
            previous = day
        }

        var cursor: LocalDate? = when {
            qualifyingDays.contains(now) -> now
            qualifyingDays.contains(now.minusDays(1)) -> now.minusDays(1)
            else -> null
        }

        var current = 0
        while (cursor != null && qualifyingDays.contains(cursor)) {
            current += 1
            cursor = cursor.minusDays(1)
        }

        return StreakSummary(current = current, longest = longest)
    }
}

object SuggestionEngine {
    fun suggest(
        records: Map<AyahKey, AyahMemorizationRecord>,
        index: QuranIndex,
        now: Instant,
    ): Suggestion? {
        val learning = records.values
            .filter { it.isCurrentlyLearning && it.status != MemorizationStatus.MASTERED }
            .groupBy { it.surah }

        val minSurah = learning.keys.minOrNull()
        if (minSurah != null) {
            return Suggestion.ContinueLearning(minSurah, learning[minSurah]?.size ?: 0)
        }

        val bySurah = records.values.groupBy { it.surah }
        var bestSurah: Int? = null
        var bestOverdue: Double = -1.0

        for ((surah, surahRecords) in bySurah) {
            val due = surahRecords.filter { ReviewEngine.isDue(it, now) }
            if (due.isEmpty()) continue
            val overdue = due.map { overdueDays(it, now) }.sum() / due.size.toDouble()
            if (bestSurah == null || overdue > bestOverdue || (overdue == bestOverdue && surah < bestSurah)) {
                bestSurah = surah
                bestOverdue = overdue
            }
        }

        if (bestSurah == null) return null

        val lastReview = bySurah[bestSurah]?.mapNotNull { it.lastReviewedAt }?.maxOrNull()
        val sinceReview = lastReview?.let {
            ChronoUnit.DAYS.between(it.atZone(ZoneId.systemDefault()).toLocalDate(), now.atZone(ZoneId.systemDefault()).toLocalDate()).toInt()
        }
        return Suggestion.Review(bestSurah, sinceReview)
    }

    private fun overdueDays(record: AyahMemorizationRecord, now: Instant): Double {
        val ref = record.nextReviewAt ?: record.firstMemorizedAt ?: record.lastStatusChangedAt ?: record.updatedAt
        val seconds = maxOf(0L, now.epochSecond - ref.epochSecond)
        return seconds.toDouble() / 86400.0
    }
}
