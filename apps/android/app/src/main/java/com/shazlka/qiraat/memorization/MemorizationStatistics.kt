package com.shazlka.qiraat.memorization

import com.shazlka.qiraat.core.AyahKey

object MemorizationStatisticsService {

    private class StatusTotals {
        val counts = mutableMapOf(
            MemorizationStatus.MASTERED to 0,
            MemorizationStatus.MEMORIZED_WITH_ERRORS to 0,
            MemorizationStatus.NEEDS_MUSHAF to 0,
            MemorizationStatus.NOT_MEMORIZED to 0,
        )
        var ayahCount = 0
        var learningWeight = 0.0

        val mastered: Int get() = counts[MemorizationStatus.MASTERED] ?: 0
        val canReciteCount: Int get() = mastered + (counts[MemorizationStatus.MEMORIZED_WITH_ERRORS] ?: 0)
        val isComplete: Boolean get() = ayahCount > 0 && mastered == ayahCount
        val strictPercent: Double get() = if (ayahCount > 0) (mastered.toDouble() / ayahCount.toDouble()) * 100.0 else 0.0
        val learningPercent: Double get() = if (ayahCount > 0) (learningWeight / ayahCount.toDouble()) * 100.0 else 0.0

        fun add(status: MemorizationStatus, weight: Double) {
            counts[status] = (counts[status] ?: 0) + 1
            ayahCount += 1
            learningWeight += weight
        }
    }

    private class PageTotals {
        val counts = mutableMapOf(
            MemorizationStatus.MASTERED to 0,
            MemorizationStatus.MEMORIZED_WITH_ERRORS to 0,
            MemorizationStatus.NEEDS_MUSHAF to 0,
            MemorizationStatus.NOT_MEMORIZED to 0,
        )
        val fractions = mutableMapOf(
            MemorizationStatus.MASTERED to 0.0,
            MemorizationStatus.MEMORIZED_WITH_ERRORS to 0.0,
            MemorizationStatus.NEEDS_MUSHAF to 0.0,
            MemorizationStatus.NOT_MEMORIZED to 0.0,
        )
        var ayahCount = 0

        fun add(status: MemorizationStatus, wordShare: Double) {
            counts[status] = (counts[status] ?: 0) + 1
            fractions[status] = (fractions[status] ?: 0.0) + wordShare
            ayahCount += 1
        }

        fun progress(page: Int): MemorizationPageProgress {
            val state = when {
                (counts[MemorizationStatus.NOT_MEMORIZED] ?: 0) > 0 -> MemorizationStatus.NOT_MEMORIZED
                (counts[MemorizationStatus.NEEDS_MUSHAF] ?: 0) > 0 -> MemorizationStatus.NEEDS_MUSHAF
                (counts[MemorizationStatus.MEMORIZED_WITH_ERRORS] ?: 0) > 0 -> MemorizationStatus.MEMORIZED_WITH_ERRORS
                (counts[MemorizationStatus.MASTERED] ?: 0) == ayahCount && ayahCount > 0 -> MemorizationStatus.MASTERED
                else -> MemorizationStatus.NOT_MEMORIZED
            }
            val mix = PageMix(
                counts = counts.toMap(),
                fractions = fractions.toMap(),
                ayahCount = ayahCount,
                masteredAyahs = counts[MemorizationStatus.MASTERED] ?: 0,
            )
            return MemorizationPageProgress(page, state, mix)
        }
    }

    fun snapshot(
        records: Map<AyahKey, AyahMemorizationRecord>,
        index: QuranIndex,
        policy: MemorizationPolicy = MemorizationPolicy.standard,
    ): MemorizationSnapshot {
        val total = StatusTotals()
        val surahTotals = mutableMapOf<Int, StatusTotals>()
        val juzTotals = mutableMapOf<Int, StatusTotals>()
        val pageTotals = mutableMapOf<Int, PageTotals>()
        var pageEquivalentMastered = 0.0

        for (key in index.ayahKeys) {
            val status = records[key]?.status ?: MemorizationStatus.NOT_MEMORIZED
            val learningWeight = policy.weight(status)
            total.add(status, learningWeight)
            surahTotals.getOrPut(key.surah) { StatusTotals() }.add(status, learningWeight)

            val page = index.page(key)
            if (page != null) {
                val wordShare = index.weight(key)
                pageTotals.getOrPut(page) { PageTotals() }.add(status, wordShare)
                if (status == MemorizationStatus.MASTERED) {
                    pageEquivalentMastered += wordShare
                }
                val juz = index.juz(page)
                if (juz != null) {
                    juzTotals.getOrPut(juz) { StatusTotals() }.add(status, learningWeight)
                }
            }
        }

        val surahs = index.surahNumbers.map { surahNum ->
            val st = surahTotals[surahNum] ?: StatusTotals()
            val state: SurahState = when {
                st.isComplete -> SurahState.COMPLETE
                (st.counts[MemorizationStatus.NOT_MEMORIZED] ?: 0) == st.ayahCount -> SurahState.NONE
                else -> SurahState.PARTIAL
            }
            SurahProgress(
                surah = surahNum,
                ayahCount = st.ayahCount,
                counts = st.counts.toMap(),
                strictPercent = st.strictPercent,
                learningPercent = st.learningPercent,
                state = state,
                isCompleteIncludingErrors = st.ayahCount > 0 && st.canReciteCount == st.ayahCount,
            )
        }

        val juz = index.juzNumbers.map { juzNum ->
            val jt = juzTotals[juzNum] ?: StatusTotals()
            JuzProgress(
                juz = juzNum,
                counts = jt.counts.toMap(),
                strictPercent = jt.strictPercent,
                learningPercent = jt.learningPercent,
                isComplete = jt.isComplete,
            )
        }

        val pages = index.pageNumbers.map { pageNum ->
            (pageTotals[pageNum] ?: PageTotals()).progress(pageNum)
        }

        return MemorizationSnapshot(
            totalAyahs = total.ayahCount,
            counts = total.counts.toMap(),
            strictPercent = total.strictPercent,
            learningPercent = total.learningPercent,
            canReciteCount = total.canReciteCount,
            surahs = surahs,
            juz = juz,
            completedSurahs = surahs.count { it.state == SurahState.COMPLETE },
            partialSurahs = surahs.count { it.state == SurahState.PARTIAL },
            completeIncludingErrorsSurahs = surahs.count { it.isCompleteIncludingErrors },
            completedJuz = juz.count { it.isComplete },
            pages = pages,
            pagesFullyMastered = pages.count { it.state == MemorizationStatus.MASTERED },
            pageEquivalentMastered = pageEquivalentMastered,
        )
    }

    fun pageProgress(
        page: Int,
        records: Map<AyahKey, AyahMemorizationRecord>,
        index: QuranIndex,
    ): MemorizationPageProgress {
        val pageTotals = PageTotals()
        for (key in index.ayatOnPage(page)) {
            val status = records[key]?.status ?: MemorizationStatus.NOT_MEMORIZED
            val wordShare = index.weight(key)
            pageTotals.add(status, wordShare)
        }
        return pageTotals.progress(page)
    }
}
