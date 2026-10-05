import Combine
import Foundation
import MushafCore
import SwiftUI
import UIKit

@MainActor
final class ReadingTracker: ObservableObject {
    static let shared = ReadingTracker()

    @Published private(set) var activeKhatma: KhatmaRecord
    @Published private(set) var khatmaPercent: Double = 0.0
    @Published private(set) var totalAyahsRead: Int = 0
    @Published private(set) var currentStreak: Int = 0
    @Published private(set) var longestStreak: Int = 0
    @Published private(set) var totalReadingDays: Int = 0
    @Published private(set) var completedKhatmasCount: Int = 0
    @Published var showingKhatmaCelebration: Bool = false
    @Published var completedKhatmaRecord: KhatmaRecord? = nil

    // Cache of bookmarked pages and ayahs for fast render checks
    @Published private(set) var bookmarkedPages: Set<Int> = []
    @Published private(set) var bookmarksVersion: Int = 0

    private let db: QuranReadingDatabase
    private var currentPage: Int?
    private var pageStartTime: Date?
    private var currentPageAyahs: [(surah: Int, ayah: Int, page: Int)] = []
    private var creditedAyahsCount: Int = 0
    private var isFullPageCompleted: Bool = false
    private var fullCompletionTimer: Timer?
    private var periodicTickTimer: Timer?
    private var isAppActive: Bool = true
    private var keepScreenAwake: Bool = true
    private var cachedTotalQuranAyahs: Int = 6236

    init(database: QuranReadingDatabase = .shared) {
        self.db = database
        self.activeKhatma = database.getOrCreateActiveKhatma()
        refreshStats()
        refreshBookmarksCache()
    }

    // MARK: - Screen Awake Lifecycle

    func configureScreenAwake(enabled: Bool, scenePhase: ScenePhase) {
        self.keepScreenAwake = enabled
        self.isAppActive = (scenePhase == .active)
        applyScreenAwakeState()
    }

    func setKeepScreenAwake(_ enabled: Bool) {
        self.keepScreenAwake = enabled
        applyScreenAwakeState()
    }

    func setScenePhase(_ phase: ScenePhase) {
        self.isAppActive = (phase == .active)
        applyScreenAwakeState()
    }

    private func applyScreenAwakeState() {
        let shouldKeepAwake = isAppActive && keepScreenAwake
        if UIApplication.shared.isIdleTimerDisabled != shouldKeepAwake {
            UIApplication.shared.isIdleTimerDisabled = shouldKeepAwake
        }
    }

    // MARK: - Page Dwell & Reading Tracking (30s Page Completion & Proportional Ayah Progress)

    func pageDidChange(to page: Int, library: MushafLibrary) {
        // 1. Flush any uncredited dwell progress on the previous page
        flushCurrentPageDwell(library: library)

        // 2. Set up new page tracking
        self.currentPage = page
        self.pageStartTime = Date()
        self.creditedAyahsCount = 0
        self.isFullPageCompleted = false

        guard let mushafPage = library.page(page) else {
            self.currentPageAyahs = []
            return
        }

        // Ordered unique ayahs on this page (top to bottom)
        var seen = Set<AyahKey>()
        var items: [(surah: Int, ayah: Int, page: Int)] = []
        for line in mushafPage.lines {
            for word in line.words {
                let key = word.ayahKey
                if !seen.contains(key) {
                    seen.insert(key)
                    items.append((surah: key.surah, ayah: key.ayah, page: page))
                }
            }
        }
        self.currentPageAyahs = items

        guard !items.isEmpty else { return }

        // Schedule timer to mark 100% page completion at exactly 30 seconds
        fullCompletionTimer?.invalidate()
        fullCompletionTimer = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: false) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self = self, self.currentPage == page else { return }
                self.completeFullPage(page: page, library: library)
            }
        }

        // Schedule periodic tick every 1.0s to credit ayahs proportionally as user reads
        periodicTickTimer?.invalidate()
        periodicTickTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self = self, self.currentPage == page, !self.isFullPageCompleted else { return }
                self.checkProportionalDwellTick(library: library)
            }
        }
    }

    private func checkProportionalDwellTick(library: MushafLibrary) {
        guard let startTime = pageStartTime, let page = currentPage, !isFullPageCompleted else { return }
        let elapsed = Date().timeIntervalSince(startTime)
        let total = currentPageAyahs.count
        guard total > 0 else { return }

        if elapsed >= 30.0 {
            completeFullPage(page: page, library: library)
            return
        }

        guard elapsed >= 1.0 else { return }

        let ratio = min(1.0, elapsed / 30.0)
        let targetCount = Int(Double(total) * ratio)
        if targetCount > creditedAyahsCount {
            let ayahsToCredit = Array(currentPageAyahs.prefix(targetCount))
            recordEarnedAyahs(ayahsToCredit, page: page, library: library, isFullPage: false)
            creditedAyahsCount = targetCount
        }
    }

    /// Flushes earned reading progress for the current page when switching pages or backgrounding.
    /// Formula:
    /// - 30 seconds or more = page completed (100% of ayahs on page).
    /// - Less than 30 seconds = proportional completion:
    ///   e.g. 6 ayahs on page, 12 seconds elapsed -> Int(6 * 12/30) = 2 ayahs completed.
    func flushCurrentPageDwell(library: MushafLibrary) {
        fullCompletionTimer?.invalidate()
        fullCompletionTimer = nil
        periodicTickTimer?.invalidate()
        periodicTickTimer = nil

        guard let page = currentPage,
              let startTime = pageStartTime,
              !currentPageAyahs.isEmpty,
              !isFullPageCompleted else {
            self.pageStartTime = nil
            return
        }

        let elapsed = Date().timeIntervalSince(startTime)
        self.pageStartTime = nil

        // Prevent accidental swiping (< 1.0s)
        guard elapsed >= 1.0 else { return }

        let total = currentPageAyahs.count
        let dwellSeconds = min(300, max(1, Int(elapsed)))
        if elapsed >= 30.0 {
            completeFullPage(page: page, library: library, elapsedSeconds: dwellSeconds)
        } else {
            let ratio = min(1.0, elapsed / 30.0)
            let targetCount = Int(Double(total) * ratio)
            if targetCount > creditedAyahsCount {
                let ayahsToCredit = Array(currentPageAyahs.prefix(targetCount))
                recordEarnedAyahs(ayahsToCredit, page: page, library: library, isFullPage: false, seconds: dwellSeconds)
                creditedAyahsCount = targetCount
            }
        }
    }

    private func completeFullPage(page: Int, library: MushafLibrary, elapsedSeconds: Int = 30) {
        guard !isFullPageCompleted, !currentPageAyahs.isEmpty else { return }
        isFullPageCompleted = true
        creditedAyahsCount = currentPageAyahs.count
        fullCompletionTimer?.invalidate()
        fullCompletionTimer = nil
        periodicTickTimer?.invalidate()
        periodicTickTimer = nil
        recordEarnedAyahs(currentPageAyahs, page: page, library: library, isFullPage: true, seconds: max(30, elapsedSeconds))
    }

    private func recordEarnedAyahs(
        _ items: [(surah: Int, ayah: Int, page: Int)],
        page: Int,
        library: MushafLibrary,
        isFullPage: Bool,
        seconds: Int = 0
    ) {
        guard !items.isEmpty else { return }
        let totalQuranAyahs = library.surahs.map(\.ayahCount).reduce(0, +)
        self.cachedTotalQuranAyahs = totalQuranAyahs > 0 ? totalQuranAyahs : 6236

        let newAyahsCount = db.recordReadAyahs(khatmaId: activeKhatma.id, items: items)
        if newAyahsCount > 0 {
            db.recordDailyReadingActivity(ayahsCount: newAyahsCount, pagesCount: isFullPage ? 1 : 0, seconds: seconds, on: Date())
            refreshStats()

            // Check Khatma completion (100%)
            if totalAyahsRead >= cachedTotalQuranAyahs {
                triggerKhatmaCompletion()
            }
        }
    }

    func triggerKhatmaCompletion() {
        if let completed = db.completeActiveKhatma(khatmaId: activeKhatma.id) {
            completedKhatmaRecord = completed
            showingKhatmaCelebration = true
            // Start next Khatma at 0%
            activeKhatma = db.getOrCreateActiveKhatma()
            refreshStats()
        }
    }

    func startNewKhatmaManually() {
        _ = db.completeActiveKhatma(khatmaId: activeKhatma.id)
        activeKhatma = db.getOrCreateActiveKhatma()
        refreshStats()
    }

    // MARK: - Manual Reading Session Recording

    @discardableResult
    func recordManualSession(
        fromSurah: Int,
        fromAyah: Int,
        toSurah: Int,
        toAyah: Int,
        sessionDate: Date,
        durationMinutes: Int,
        fromMemory: Bool,
        library: MushafLibrary
    ) -> Int {
        var items: [(surah: Int, ayah: Int, page: Int)] = []

        let startS = min(fromSurah, toSurah)
        let endS = max(fromSurah, toSurah)

        for s in startS...endS {
            let maxAyahs = library.surahAyahCounts[s] ?? 0
            let startA = (s == startS) ? max(1, fromAyah) : 1
            let endA = (s == endS) ? min(maxAyahs, toAyah) : maxAyahs

            guard startA <= endA else { continue }
            for a in startA...endA {
                let p = library.page(of: AyahKey(surah: s, ayah: a)) ?? 1
                items.append((surah: s, ayah: a, page: p))
            }
        }

        guard !items.isEmpty else { return 0 }

        let newAyahsCount = db.recordReadAyahs(khatmaId: activeKhatma.id, items: items, at: sessionDate)
        let distinctPages = Set(items.map(\.page)).count
        let sessionSeconds = max(60, durationMinutes * 60)
        db.recordDailyReadingActivity(ayahsCount: max(1, newAyahsCount > 0 ? newAyahsCount : items.count), pagesCount: distinctPages, seconds: sessionSeconds, on: sessionDate)
        refreshStats()

        if totalAyahsRead >= cachedTotalQuranAyahs {
            triggerKhatmaCompletion()
        }

        return items.count
    }

    @discardableResult
    func recordManualPageRangeSession(
        fromPage: Int,
        toPage: Int,
        sessionDate: Date,
        durationMinutes: Int,
        fromMemory: Bool,
        library: MushafLibrary
    ) -> Int {
        let p1 = max(1, min(fromPage, toPage))
        let p2 = min(604, max(fromPage, toPage))

        var items: [(surah: Int, ayah: Int, page: Int)] = []
        for p in p1...p2 {
            if let mushafPage = library.page(p) {
                var seen = Set<AyahKey>()
                for line in mushafPage.lines {
                    for word in line.words {
                        let key = word.ayahKey
                        if !seen.contains(key) {
                            seen.insert(key)
                            items.append((surah: key.surah, ayah: key.ayah, page: p))
                        }
                    }
                }
            }
        }

        guard !items.isEmpty else { return 0 }

        let newAyahsCount = db.recordReadAyahs(khatmaId: activeKhatma.id, items: items, at: sessionDate)
        let distinctPages = p2 - p1 + 1
        let sessionSeconds = max(60, durationMinutes * 60)
        db.recordDailyReadingActivity(ayahsCount: max(1, newAyahsCount > 0 ? newAyahsCount : items.count), pagesCount: distinctPages, seconds: sessionSeconds, on: sessionDate)
        refreshStats()

        if totalAyahsRead >= cachedTotalQuranAyahs {
            triggerKhatmaCompletion()
        }

        return items.count
    }

    func currentWeekReadingDays() -> [WeeklyDayStatus] {
        let calendar = Calendar.current
        let today = Date()
        let dayFormatter = DateFormatter()
        dayFormatter.dateFormat = "yyyy-MM-dd"
        dayFormatter.locale = Locale(identifier: "en_US_POSIX")

        let dayNameFormatter = DateFormatter()
        dayNameFormatter.locale = Locale(identifier: "ar")
        dayNameFormatter.dateFormat = "EEEE"

        let dayNumberFormatter = DateFormatter()
        dayNumberFormatter.locale = Locale(identifier: "ar")
        dayNumberFormatter.dateFormat = "d"

        // Last 7 days ending with today
        guard let sevenDaysAgo = calendar.date(byAdding: .day, value: -6, to: today) else { return [] }
        let readSet = db.readingDaysSet(startingFrom: sevenDaysAgo, endingAt: today)
        let secondsMap = db.readingSecondsMap(startingFrom: sevenDaysAgo, endingAt: today)

        var result: [WeeklyDayStatus] = []
        for offset in 0..<7 {
            guard let d = calendar.date(byAdding: .day, value: offset, to: sevenDaysAgo) else { continue }
            let dateStr = dayFormatter.string(from: d)
            let dayName = dayNameFormatter.string(from: d)
            let dayNum = dayNumberFormatter.string(from: d)
            let isToday = calendar.isDate(d, inSameDayAs: today)
            let isRead = readSet.contains(dateStr)
            let sec = secondsMap[dateStr] ?? 0

            result.append(WeeklyDayStatus(
                dateString: dateStr,
                dayNameAr: dayName,
                dayNumber: dayNum,
                isRead: isRead,
                isToday: isToday,
                readingSeconds: sec
            ))
        }
        return result
    }

    // MARK: - Surah Resume & Unread Navigation

    func nextUnreadAyah(for surahNumber: Int, library: MushafLibrary) -> Int {
        let total = library.surahAyahCounts[surahNumber] ?? 0
        guard total > 0 else { return 1 }
        let readAyahs = db.allReadAyahsForSurah(khatmaId: activeKhatma.id, surah: surahNumber)
        guard !readAyahs.isEmpty else { return 1 }
        guard readAyahs.count < total else { return 1 }

        for a in 1...total {
            if !readAyahs.contains(a) {
                return a
            }
        }
        return 1
    }

    func nextUnreadPage(for surah: Surah, library: MushafLibrary) -> Int {
        let unreadAyah = nextUnreadAyah(for: surah.number, library: library)
        if unreadAyah > 1, let targetPage = library.page(of: AyahKey(surah: surah.number, ayah: unreadAyah)) {
            return targetPage
        }
        return surah.firstPage
    }

    // MARK: - Bookmarks

    func refreshBookmarksCache() {
        bookmarkedPages = db.bookmarkedPageNumbers()
        bookmarksVersion += 1
    }

    func isAyahBookmarked(surah: Int, ayah: Int) -> Bool {
        db.isAyahBookmarked(surah: surah, ayah: ayah)
    }

    func isPageBookmarked(page: Int) -> Bool {
        db.isPageBookmarked(page: page)
    }

    func bookmarkedAyahs(on page: Int) -> Set<AyahKey> {
        db.bookmarkedAyahs(on: page)
    }

    func toggleAyahBookmark(surah: Int, ayah: Int, page: Int, note: String? = nil) {
        if isAyahBookmarked(surah: surah, ayah: ayah) {
            db.removeBookmark(type: .ayah, surah: surah, ayah: ayah, page: page)
        } else {
            db.addBookmark(type: .ayah, surah: surah, ayah: ayah, page: page, note: note)
        }
        refreshBookmarksCache()
    }

    func togglePageBookmark(page: Int, surah: Int, ayah: Int, note: String? = nil) {
        if isPageBookmarked(page: page) {
            db.removeBookmark(type: .page, surah: surah, ayah: ayah, page: page)
        } else {
            db.addBookmark(type: .page, surah: surah, ayah: ayah, page: page, note: note)
        }
        refreshBookmarksCache()
    }

    func removeBookmark(id: String) {
        db.removeBookmark(id: id)
        refreshBookmarksCache()
    }

    func allBookmarks(type: BookmarkType? = nil, query: String? = nil) -> [QuranBookmark] {
        db.allBookmarks(type: type, query: query)
    }

    // MARK: - Statistics & Queries

    func refreshStats() {
        totalAyahsRead = db.readAyahsCount(khatmaId: activeKhatma.id)
        let pct = cachedTotalQuranAyahs > 0 ? (Double(totalAyahsRead) / Double(cachedTotalQuranAyahs)) * 100.0 : 0.0
        khatmaPercent = min(100.0, pct)

        let streaks = db.calculateStreaks(asOf: Date())
        currentStreak = streaks.currentStreak
        longestStreak = streaks.longestStreak
        totalReadingDays = streaks.totalReadingDays
        completedKhatmasCount = db.completedKhatmasCount()
    }

    func surahProgress(surahNumber: Int, totalAyahs: Int) -> SurahProgress {
        let readCount = db.readAyahsCountForSurah(khatmaId: activeKhatma.id, surah: surahNumber)
        return SurahProgress(
            surahNumber: surahNumber,
            surahName: "",
            readAyahsCount: readCount,
            totalAyahsCount: totalAyahs,
            firstPage: 1
        )
    }

    func allSurahProgress(library: MushafLibrary) -> [SurahProgress] {
        library.surahs.map { surah in
            let readCount = db.readAyahsCountForSurah(khatmaId: activeKhatma.id, surah: surah.number)
            return SurahProgress(
                surahNumber: surah.number,
                surahName: surah.name,
                readAyahsCount: readCount,
                totalAyahsCount: surah.ayahCount,
                firstPage: surah.firstPage
            )
        }
    }

    func statsOverview(library: MushafLibrary) -> ReadingStatsOverview {
        let totalQuranAyahs = library.surahs.map(\.ayahCount).reduce(0, +)
        let pagesRead = db.readPagesCount(khatmaId: activeKhatma.id)
        let completedSurahs = db.completedSurahsCount(khatmaId: activeKhatma.id, surahAyahCounts: library.surahAyahCounts)

        let lifetimeAyahs = max(totalAyahsRead, db.lifetimeReadAyahsCount())
        let lifetimeSeconds = db.lifetimeReadingSeconds()

        return ReadingStatsOverview(
            currentKhatma: activeKhatma,
            currentStreak: currentStreak,
            longestStreak: longestStreak,
            totalReadingDays: totalReadingDays,
            completedKhatmasCount: completedKhatmasCount,
            totalAyahsReadInCurrentKhatma: totalAyahsRead,
            totalQuranAyahs: totalQuranAyahs > 0 ? totalQuranAyahs : 6236,
            totalPagesReadInCurrentKhatma: pagesRead,
            completedSurahsCount: completedSurahs,
            lifetimeAyahsRead: lifetimeAyahs,
            lifetimeReadingSeconds: lifetimeSeconds
        )
    }
}

extension QuranReadingDatabase {
    func bookmarkedPageNumbers() -> Set<Int> {
        var pages = Set<Int>()
        for b in allBookmarks(type: .page) {
            pages.insert(b.page)
        }
        return pages
    }
}
