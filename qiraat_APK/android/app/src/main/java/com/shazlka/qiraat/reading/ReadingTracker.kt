package com.shazlka.qiraat.reading

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.shazlka.qiraat.core.AyahKey
import com.shazlka.qiraat.core.MUSHAF_PAGE_COUNT
import com.shazlka.qiraat.core.Surah
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

class ReadingTracker(
    val db: ReadingStore,
    private val scope: CoroutineScope = CoroutineScope(Dispatchers.Main),
) {
    var activeKhatma: KhatmaRecord by mutableStateOf(db.getOrCreateActiveKhatma())
        private set
    var khatmaPercent: Double by mutableDoubleStateOf(0.0)
        private set
    var totalAyahsRead: Int by mutableIntStateOf(0)
        private set
    var currentStreak: Int by mutableIntStateOf(0)
        private set
    var longestStreak: Int by mutableIntStateOf(0)
        private set
    var totalReadingDays: Int by mutableIntStateOf(0)
        private set
    var completedKhatmasCount: Int by mutableIntStateOf(0)
        private set

    var showingKhatmaCelebration: Boolean by mutableStateOf(false)
    var completedKhatmaRecord: KhatmaRecord? by mutableStateOf(null)

    var bookmarkedPages: Set<Int> by mutableStateOf(emptySet())
        private set
    var bookmarkedAyahs: Set<AyahKey> by mutableStateOf(emptySet())
        private set
    var bookmarksVersion: Int by mutableIntStateOf(0)
        private set

    private var currentPage: Int? = null
    private var pageStartTime: Instant? = null
    private var currentPageAyahs: List<Triple<Int, Int, Int>> = emptyList()
    private var creditedAyahsCount: Int = 0
    private var isFullPageCompleted: Boolean = false
    private var dwellTimerJob: Job? = null
    private var cachedTotalQuranAyahs: Int = 6236

    init {
        refreshStats()
        refreshBookmarksCache()
    }

    fun refreshStats() {
        totalAyahsRead = db.readAyahsCount(activeKhatma.id)
        khatmaPercent = if (cachedTotalQuranAyahs > 0) {
            (totalAyahsRead.toDouble() / cachedTotalQuranAyahs.toDouble()) * 100.0
        } else 0.0

        val (current, longest, totalDays) = db.calculateStreaks(Instant.now())
        currentStreak = current
        longestStreak = longest
        totalReadingDays = totalDays
        completedKhatmasCount = db.completedKhatmasCount()
    }

    fun refreshBookmarksCache() {
        val all = db.allBookmarks()
        bookmarkedPages = all.filter { it.type == BookmarkType.PAGE }.map { it.page }.toSet()
        bookmarkedAyahs = all.filter { it.type == BookmarkType.AYAH }.map { it.ayahKey }.toSet()
        bookmarksVersion++
    }

    // MARK: - Page Dwell & Reading Tracking

    fun pageDidChange(
        page: Int,
        pageAyahs: List<AyahKey>,
        totalQuranAyahs: Int = 6236,
    ) {
        flushCurrentPageDwell()

        currentPage = page
        pageStartTime = Instant.now()
        creditedAyahsCount = 0
        isFullPageCompleted = false
        cachedTotalQuranAyahs = totalQuranAyahs

        currentPageAyahs = pageAyahs.distinct().map { Triple(it.surah, it.ayah, page) }
        if (currentPageAyahs.isEmpty()) return

        startDwellTimers(page)
    }

    private fun startDwellTimers(page: Int) {
        dwellTimerJob?.cancel()
        dwellTimerJob = scope.launch {
            val startTime = pageStartTime ?: return@launch
            while (isActive && currentPage == page && !isFullPageCompleted) {
                delay(1000)
                val elapsedSeconds = Instant.now().epochSecond - startTime.epochSecond
                if (elapsedSeconds >= 30) {
                    completeFullPage(page, elapsedSeconds.toInt())
                    break
                } else if (elapsedSeconds >= 1) {
                    val total = currentPageAyahs.size
                    if (total > 0) {
                        val ratio = elapsedSeconds.toDouble() / 30.0
                        val targetCount = minOf(total, (total * ratio).toInt())
                        if (targetCount > creditedAyahsCount) {
                            val ayahsToCredit = currentPageAyahs.take(targetCount)
                            recordEarnedAyahs(ayahsToCredit, page, isFullPage = false, seconds = 1)
                            creditedAyahsCount = targetCount
                        }
                    }
                }
            }
        }
    }

    private fun completeFullPage(page: Int, elapsedSeconds: Int = 30) {
        if (isFullPageCompleted || currentPageAyahs.isEmpty()) return
        recordEarnedAyahs(currentPageAyahs, page, isFullPage = true, seconds = maxOf(30, elapsedSeconds))
        isFullPageCompleted = true
        creditedAyahsCount = currentPageAyahs.size
        dwellTimerJob?.cancel()
        dwellTimerJob = null
    }

    fun flushCurrentPageDwell() {
        dwellTimerJob?.cancel()
        dwellTimerJob = null

        val page = currentPage ?: return
        val startTime = pageStartTime ?: return
        if (currentPageAyahs.isEmpty() || isFullPageCompleted) {
            pageStartTime = null
            return
        }

        val elapsed = Instant.now().epochSecond - startTime.epochSecond
        pageStartTime = null

        if (elapsed < 1) return

        val dwellSeconds = minOf(300, maxOf(1, elapsed.toInt()))
        if (elapsed >= 30) {
            completeFullPage(page, dwellSeconds)
        } else {
            val total = currentPageAyahs.size
            val ratio = elapsed.toDouble() / 30.0
            val targetCount = minOf(total, (total * ratio).toInt())
            if (targetCount > creditedAyahsCount) {
                val ayahsToCredit = currentPageAyahs.take(targetCount)
                recordEarnedAyahs(ayahsToCredit, page, isFullPage = false, seconds = dwellSeconds)
                creditedAyahsCount = targetCount
            }
        }
    }

    private fun recordEarnedAyahs(
        items: List<Triple<Int, Int, Int>>,
        page: Int,
        isFullPage: Boolean,
        seconds: Int = 0,
    ) {
        if (items.isEmpty()) return
        val newAyahs = db.recordReading(
            khatmaId = activeKhatma.id,
            items = items,
            at = Instant.now(),
            pagesCount = if (isFullPage) 1 else 0,
            seconds = seconds,
            activityAyahs = { it },
        ) ?: return

        if (newAyahs > 0) {
            refreshStats()
            if (totalAyahsRead >= cachedTotalQuranAyahs) {
                triggerKhatmaCompletion()
            }
        }
    }

    fun triggerKhatmaCompletion() {
        val completed = db.completeActiveKhatma(activeKhatma.id)
        if (completed != null) {
            completedKhatmaRecord = completed
            showingKhatmaCelebration = true
            activeKhatma = db.getOrCreateActiveKhatma()
            refreshStats()
        }
    }

    // MARK: - Surah Completion Toggle

    fun markSurahCompleted(
        surahNumber: Int,
        completed: Boolean,
        surahAyahCounts: Map<Int, Int>,
        pageResolver: (Int, Int) -> Int,
    ) {
        val maxAyahs = surahAyahCounts[surahNumber] ?: 0
        if (maxAyahs <= 0) return

        if (completed) {
            val currentRead = db.readAyahsCountForSurah(activeKhatma.id, surahNumber)
            if (currentRead >= maxAyahs) return

            val items = (1..maxAyahs).map { a ->
                Triple(surahNumber, a, pageResolver(surahNumber, a))
            }
            val inserted = db.recordReadAyahs(activeKhatma.id, items, Instant.now())
            if (inserted > 0) {
                val distinctPages = items.map { it.third }.toSet().size
                val estimatedSeconds = maxOf(60, inserted * 15)
                db.recordDailyReadingActivity(
                    ayahsCount = inserted,
                    pagesCount = distinctPages,
                    seconds = estimatedSeconds,
                    on = Instant.now(),
                )
            }
        } else {
            val currentRead = db.readAyahsCountForSurah(activeKhatma.id, surahNumber)
            if (currentRead <= 0) return
            db.removeReadAyahsForSurah(activeKhatma.id, surahNumber)
        }

        refreshStats()
        if (completed && totalAyahsRead >= cachedTotalQuranAyahs) {
            triggerKhatmaCompletion()
        }
    }

    // MARK: - Manual Session Recording

    fun recordManualSession(
        fromSurah: Int,
        fromAyah: Int,
        toSurah: Int,
        toAyah: Int,
        sessionDate: Instant,
        durationMinutes: Int,
        surahAyahCounts: Map<Int, Int>,
        pageResolver: (Int, Int) -> Int,
    ): Int {
        val startS = minOf(fromSurah, toSurah)
        val endS = maxOf(fromSurah, toSurah)
        val items = mutableListOf<Triple<Int, Int, Int>>()

        for (s in startS..endS) {
            val maxAyahs = surahAyahCounts[s] ?: 0
            val startA = if (s == startS) maxOf(1, fromAyah) else 1
            val endA = if (s == endS) minOf(maxAyahs, toAyah) else maxAyahs

            if (startA <= endA) {
                for (a in startA..endA) {
                    items.add(Triple(s, a, pageResolver(s, a)))
                }
            }
        }
        return commitManualSession(items, sessionDate, durationMinutes, items.map { it.third }.toSet().size)
    }

    fun recordManualPageRangeSession(
        fromPage: Int,
        toPage: Int,
        sessionDate: Instant,
        durationMinutes: Int,
        pageAyahsResolver: (Int) -> List<AyahKey>,
    ): Int {
        val p1 = maxOf(1, minOf(fromPage, toPage))
        val p2 = minOf(MUSHAF_PAGE_COUNT, maxOf(fromPage, toPage))
        val items = mutableListOf<Triple<Int, Int, Int>>()

        for (p in p1..p2) {
            val ayahs = pageAyahsResolver(p)
            for (key in ayahs.distinct()) {
                items.add(Triple(key.surah, key.ayah, p))
            }
        }
        return commitManualSession(items, sessionDate, durationMinutes, p2 - p1 + 1)
    }

    private fun commitManualSession(
        items: List<Triple<Int, Int, Int>>,
        sessionDate: Instant,
        durationMinutes: Int,
        pageCount: Int,
    ): Int {
        if (items.isEmpty()) return 0
        val sessionSeconds = maxOf(60, durationMinutes * 60)
        val itemCount = items.size
        val saved = db.recordReading(
            khatmaId = activeKhatma.id,
            items = items,
            at = sessionDate,
            pagesCount = pageCount,
            seconds = sessionSeconds,
            activityAyahs = { maxOf(1, if (it > 0) it else itemCount) },
        ) ?: return 0

        refreshStats()
        if (totalAyahsRead >= cachedTotalQuranAyahs) {
            triggerKhatmaCompletion()
        }
        return items.size
    }

    // MARK: - Bookmarks

    fun toggleAyahBookmark(surah: Int, ayah: Int, page: Int, note: String? = null) {
        if (db.isAyahBookmarked(surah, ayah)) {
            db.removeBookmark(BookmarkType.AYAH, surah, ayah, page)
        } else {
            db.addBookmark(BookmarkType.AYAH, surah, ayah, page, note)
        }
        refreshBookmarksCache()
    }

    fun togglePageBookmark(page: Int, surah: Int, ayah: Int, note: String? = null) {
        if (db.isPageBookmarked(page)) {
            db.removeBookmark(BookmarkType.PAGE, surah, ayah, page)
        } else {
            db.addBookmark(BookmarkType.PAGE, surah, ayah, page, note)
        }
        refreshBookmarksCache()
    }

    fun removeBookmark(id: String) {
        db.removeBookmark(id)
        refreshBookmarksCache()
    }

    fun isAyahBookmarked(surah: Int, ayah: Int): Boolean = bookmarkedAyahs.contains(AyahKey(surah, ayah))
    fun isPageBookmarked(page: Int): Boolean = bookmarkedPages.contains(page)

    fun allBookmarks(type: BookmarkType? = null, query: String? = null): List<QuranBookmark> {
        return db.allBookmarks(type, query)
    }

    // MARK: - Stats Views Helpers

    fun currentWeekReadingDays(): List<WeeklyDayStatus> {
        val today = LocalDate.now()
        val sevenDaysAgo = today.minusDays(6)

        val readSet = db.readingDaysSet(sevenDaysAgo, today)
        val secondsMap = db.readingSecondsMap(sevenDaysAgo, today)

        val arabicLocale = Locale("ar")
        return (0..6).map { offset ->
            val d = sevenDaysAgo.plusDays(offset.toLong())
            val dateStr = d.format(DateTimeFormatter.ISO_LOCAL_DATE)
            val dayName = d.dayOfWeek.getDisplayName(TextStyle.FULL, arabicLocale)
            val dayNum = ArabicDigits.formatWhole(d.dayOfMonth.toLong())
            val isToday = d == today
            val isRead = readSet.contains(dateStr)
            val sec = secondsMap[dateStr] ?: 0

            WeeklyDayStatus(
                dateString = dateStr,
                dayNameAr = dayName,
                dayNumber = dayNum,
                isRead = isRead,
                isToday = isToday,
                readingSeconds = sec,
            )
        }
    }

    fun readingStatsOverview(totalQuranAyahs: Int = 6236): ReadingStatsOverview {
        val pagesCount = (activeKhatma.percentComplete * 604.0 / 100.0).toInt()
        return ReadingStatsOverview(
            currentKhatma = activeKhatma,
            currentStreak = currentStreak,
            longestStreak = longestStreak,
            totalReadingDays = totalReadingDays,
            completedKhatmasCount = completedKhatmasCount,
            totalAyahsReadInCurrentKhatma = totalAyahsRead,
            totalQuranAyahs = totalQuranAyahs,
            totalPagesReadInCurrentKhatma = pagesCount,
            completedSurahsCount = 0, // Computed by UI from Surah list
            lifetimeAyahsRead = db.lifetimeReadAyahsCount(),
            lifetimeReadingSeconds = db.lifetimeReadingSeconds(),
        )
    }

    fun surahProgressList(surahs: List<Surah>): List<SurahProgress> {
        return surahs.map { s ->
            val readCount = db.readAyahsCountForSurah(activeKhatma.id, s.number)
            SurahProgress(
                surahNumber = s.number,
                surahName = s.name,
                readAyahsCount = readCount,
                totalAyahsCount = s.ayahCount,
                firstPage = s.firstPage,
            )
        }
    }
}
