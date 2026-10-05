import Foundation
import MushafCore
import SwiftUI
import XCTest
@testable import Mutshabehat

final class ReadingTests: XCTestCase {
    private var testDB: QuranReadingDatabase!
    private var tempDirectoryURL: URL!

    override func setUp() {
        super.setUp()
        tempDirectoryURL = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try? FileManager.default.createDirectory(at: tempDirectoryURL, withIntermediateDirectories: true)
        let dbURL = tempDirectoryURL.appendingPathComponent("test_reading.sqlite")
        testDB = QuranReadingDatabase(url: dbURL)
    }

    override func tearDown() {
        testDB = nil
        if let url = tempDirectoryURL {
            try? FileManager.default.removeItem(at: url)
        }
        super.tearDown()
    }

    // MARK: - 1. Bookmarks Tests

    func testAddAndQueryBookmarks() {
        // Add ayah bookmark
        testDB.addBookmark(type: .ayah, surah: 2, ayah: 255, page: 42, note: "Ayat Al-Kursi")

        // Add page bookmark
        testDB.addBookmark(type: .page, surah: 3, ayah: 1, page: 50, note: nil)

        let all = testDB.allBookmarks()
        XCTAssertEqual(all.count, 2)

        let ayahsOnly = testDB.allBookmarks(type: .ayah)
        XCTAssertEqual(ayahsOnly.count, 1)
        XCTAssertEqual(ayahsOnly.first?.surah, 2)
        XCTAssertEqual(ayahsOnly.first?.ayah, 255)
        XCTAssertEqual(ayahsOnly.first?.page, 42)
        XCTAssertEqual(ayahsOnly.first?.note, "Ayat Al-Kursi")

        let pagesOnly = testDB.allBookmarks(type: .page)
        XCTAssertEqual(pagesOnly.count, 1)
        XCTAssertEqual(pagesOnly.first?.page, 50)
    }

    func testBookmarkDuplicatePrevention() {
        // Adding the exact same bookmark twice must replace/ignore and NOT duplicate
        testDB.addBookmark(type: .ayah, surah: 18, ayah: 1, page: 293, note: "Surah Al-Kahf")
        testDB.addBookmark(type: .ayah, surah: 18, ayah: 1, page: 293, note: "Updated Note")

        let all = testDB.allBookmarks(type: .ayah)
        XCTAssertEqual(all.count, 1)
        XCTAssertEqual(all.first?.note, "Updated Note")
    }

    func testRemoveBookmark() {
        testDB.addBookmark(type: .ayah, surah: 36, ayah: 1, page: 440)
        XCTAssertTrue(testDB.isAyahBookmarked(surah: 36, ayah: 1))

        testDB.removeBookmark(type: .ayah, surah: 36, ayah: 1, page: 440)
        XCTAssertFalse(testDB.isAyahBookmarked(surah: 36, ayah: 1))
        XCTAssertEqual(testDB.allBookmarks().count, 0)
    }

    func testBookmarkedAyahsOnPage() {
        testDB.addBookmark(type: .ayah, surah: 2, ayah: 1, page: 2)
        testDB.addBookmark(type: .ayah, surah: 2, ayah: 5, page: 2)
        testDB.addBookmark(type: .ayah, surah: 2, ayah: 10, page: 3)

        let page2Marks = testDB.bookmarkedAyahs(on: 2)
        XCTAssertEqual(page2Marks.count, 2)
        XCTAssertTrue(page2Marks.contains(AyahKey(surah: 2, ayah: 1)))
        XCTAssertTrue(page2Marks.contains(AyahKey(surah: 2, ayah: 5)))
        XCTAssertFalse(page2Marks.contains(AyahKey(surah: 2, ayah: 10)))

        let page3Marks = testDB.bookmarkedAyahs(on: 3)
        XCTAssertEqual(page3Marks.count, 1)
        XCTAssertTrue(page3Marks.contains(AyahKey(surah: 2, ayah: 10)))
    }

    func testBookmarkSearch() {
        testDB.addBookmark(type: .ayah, surah: 1, ayah: 1, page: 1, note: "الفاتحة")
        testDB.addBookmark(type: .page, surah: 2, ayah: 1, page: 2, note: "البقرة")

        let search1 = testDB.allBookmarks(query: "الفاتحة")
        XCTAssertEqual(search1.count, 1)

        let search2 = testDB.allBookmarks(query: "البقرة")
        XCTAssertEqual(search2.count, 1)

        let searchEmpty = testDB.allBookmarks(query: "غير موجود")
        XCTAssertEqual(searchEmpty.count, 0)
    }

    // MARK: - 2. Khatma & Reading Tracking Tests

    func testActiveKhatmaCreation() {
        let khatma = testDB.getOrCreateActiveKhatma()
        XCTAssertEqual(khatma.khatmaNumber, 1)
        XCTAssertEqual(khatma.status, "active")
        XCTAssertEqual(testDB.readAyahsCount(khatmaId: khatma.id), 0)

        // Calling getOrCreateActiveKhatma again returns the same active khatma
        let same = testDB.getOrCreateActiveKhatma()
        XCTAssertEqual(same.id, khatma.id)
    }

    func testRecordReadAyahs() {
        let khatma = testDB.getOrCreateActiveKhatma()

        // Page 1: Al-Fatiha ayahs 1 to 7
        let fatihaAyahs = (1...7).map { (surah: 1, ayah: $0, page: 1) }
        let inserted = testDB.recordReadAyahs(khatmaId: khatma.id, items: fatihaAyahs)
        XCTAssertEqual(inserted, 7)

        let readCount = testDB.readAyahsCount(khatmaId: khatma.id)
        XCTAssertEqual(readCount, 7)

        // Re-reading page 1 should not double count ayahs
        let duplicateInsert = testDB.recordReadAyahs(khatmaId: khatma.id, items: fatihaAyahs)
        XCTAssertEqual(duplicateInsert, 0)
        XCTAssertEqual(testDB.readAyahsCount(khatmaId: khatma.id), 7)
    }

    func testSurahProgressCalculation() {
        let khatma = testDB.getOrCreateActiveKhatma()

        // Read all 7 ayahs of Al-Fatiha
        let fatihaAyahs = (1...7).map { (surah: 1, ayah: $0, page: 1) }
        _ = testDB.recordReadAyahs(khatmaId: khatma.id, items: fatihaAyahs)

        // Read 10 ayahs of Al-Baqarah
        let baqarahAyahs = (1...10).map { (surah: 2, ayah: $0, page: 2) }
        _ = testDB.recordReadAyahs(khatmaId: khatma.id, items: baqarahAyahs)

        let fatihaRead = testDB.readAyahsCountForSurah(khatmaId: khatma.id, surah: 1)
        XCTAssertEqual(fatihaRead, 7)

        let baqarahRead = testDB.readAyahsCountForSurah(khatmaId: khatma.id, surah: 2)
        XCTAssertEqual(baqarahRead, 10)

        let fatihaProgress = SurahProgress(surahNumber: 1, surahName: "الفاتحة", readAyahsCount: fatihaRead, totalAyahsCount: 7, firstPage: 1)
        XCTAssertEqual(fatihaProgress.percentage, 100.0)
        XCTAssertTrue(fatihaProgress.isCompleted)

        let baqarahProgress = SurahProgress(surahNumber: 2, surahName: "البقرة", readAyahsCount: baqarahRead, totalAyahsCount: 286, firstPage: 2)
        XCTAssertEqual(round(baqarahProgress.percentage * 10) / 10, 3.5)
        XCTAssertFalse(baqarahProgress.isCompleted)
    }

    // MARK: - 3. Daily Quran Streak Rules Tests

    func testStreaksConsecutiveDays() {
        let calendar = Calendar.current
        let today = Date()
        guard let yesterday = calendar.date(byAdding: .day, value: -1, to: today),
              let twoDaysAgo = calendar.date(byAdding: .day, value: -2, to: today) else {
            XCTFail("Date calculation failed")
            return
        }

        testDB.recordDailyReadingActivity(ayahsCount: 15, pagesCount: 2, on: twoDaysAgo)
        testDB.recordDailyReadingActivity(ayahsCount: 20, pagesCount: 3, on: yesterday)
        testDB.recordDailyReadingActivity(ayahsCount: 10, pagesCount: 1, on: today)

        let streaks = testDB.calculateStreaks(asOf: today)
        XCTAssertEqual(streaks.currentStreak, 3)
        XCTAssertEqual(streaks.longestStreak, 3)
        XCTAssertEqual(streaks.totalReadingDays, 3)
    }

    func testStreakResetOnMissedDayPreservingLongestAndTotal() {
        let calendar = Calendar.current
        let today = Date()
        guard let fourDaysAgo = calendar.date(byAdding: .day, value: -4, to: today),
              let threeDaysAgo = calendar.date(byAdding: .day, value: -3, to: today),
              let twoDaysAgo = calendar.date(byAdding: .day, value: -2, to: today) else {
            XCTFail("Date calculation failed")
            return
        }

        // Streak of 3 days in the past
        testDB.recordDailyReadingActivity(ayahsCount: 10, pagesCount: 1, on: fourDaysAgo)
        testDB.recordDailyReadingActivity(ayahsCount: 10, pagesCount: 1, on: threeDaysAgo)
        testDB.recordDailyReadingActivity(ayahsCount: 10, pagesCount: 1, on: twoDaysAgo)

        // Yesterday was missed! Today user reads:
        testDB.recordDailyReadingActivity(ayahsCount: 10, pagesCount: 1, on: today)

        let streaks = testDB.calculateStreaks(asOf: today)
        // Current streak reset to 1 (started anew today)
        XCTAssertEqual(streaks.currentStreak, 1)
        // Longest streak preserved at 3
        XCTAssertEqual(streaks.longestStreak, 3)
        // Total reading days incremented to 4
        XCTAssertEqual(streaks.totalReadingDays, 4)
    }

    // MARK: - 4. Khatma Completion & Restart Tests

    func testCompleteKhatmaAndRestartNew() {
        let first = testDB.getOrCreateActiveKhatma()
        XCTAssertEqual(first.khatmaNumber, 1)

        // Add a bookmark before completion
        testDB.addBookmark(type: .ayah, surah: 2, ayah: 255, page: 42)

        // Complete the first khatma
        let completed = testDB.completeActiveKhatma(khatmaId: first.id)
        XCTAssertNotNil(completed)
        XCTAssertEqual(completed?.status, "completed")
        XCTAssertEqual(completed?.khatmaNumber, 1)

        // Lifetime completed khatmas count incremented
        XCTAssertEqual(testDB.completedKhatmasCount(), 1)

        // Starting new khatma automatically creates Khatma #2
        let second = testDB.getOrCreateActiveKhatma()
        XCTAssertEqual(second.khatmaNumber, 2)
        XCTAssertEqual(second.status, "active")
        XCTAssertEqual(testDB.readAyahsCount(khatmaId: second.id), 0)

        // Bookmarks must remain intact across khatmas
        XCTAssertEqual(testDB.allBookmarks().count, 1)
        XCTAssertTrue(testDB.isAyahBookmarked(surah: 2, ayah: 255))
    }

    // MARK: - 5. Reading Tracker & Screen Awake Tests

    @MainActor
    func testReadingTrackerScreenAwakeLogic() {
        let tracker = ReadingTracker(database: testDB)

        // Active scene with keepScreenAwake enabled
        tracker.configureScreenAwake(enabled: true, scenePhase: .active)
        XCTAssertTrue(UIApplication.shared.isIdleTimerDisabled)

        // Backgrounded app restores normal system auto-lock
        tracker.configureScreenAwake(enabled: true, scenePhase: .background)
        XCTAssertFalse(UIApplication.shared.isIdleTimerDisabled)

        // Inactive app restores normal system auto-lock
        tracker.configureScreenAwake(enabled: true, scenePhase: .inactive)
        XCTAssertFalse(UIApplication.shared.isIdleTimerDisabled)

        // User disables keepScreenAwake in Settings
        tracker.configureScreenAwake(enabled: false, scenePhase: .active)
        XCTAssertFalse(UIApplication.shared.isIdleTimerDisabled)

        // Re-enabling keepScreenAwake while active disables idle timer
        tracker.configureScreenAwake(enabled: true, scenePhase: .active)
        XCTAssertTrue(UIApplication.shared.isIdleTimerDisabled)

        // Cleanup: ensure idle timer is re-enabled
        tracker.configureScreenAwake(enabled: false, scenePhase: .background)
        XCTAssertFalse(UIApplication.shared.isIdleTimerDisabled)
    }

    // MARK: - 6. Surah Banner Tests

    func testSurahBannerMetadataAndAssets() {
        // Verify banner template image is present in app bundle or assets
        let hasImage = UIImage(named: "SurahBannerTemplate") != nil
            || Bundle.main.path(forResource: "SurahBannerTemplate", ofType: "png") != nil
            || Bundle(for: MushafPageView.self).path(forResource: "SurahBannerTemplate", ofType: "png") != nil
        XCTAssertTrue(hasImage, "SurahBannerTemplate asset must be loadable in app bundle")

        // Verify surah metadata for prominent surahs matches Quran canonical counts and types
        let fatiha = AdvancedQuranSearchData.surahMetadata[1]
        XCTAssertEqual(fatiha?.name, "الفاتحة")
        XCTAssertEqual(fatiha?.ayahCount, 7)
        XCTAssertEqual(fatiha?.type, .makkiyah)

        let baqarah = AdvancedQuranSearchData.surahMetadata[2]
        XCTAssertEqual(baqarah?.name, "البقرة")
        XCTAssertEqual(baqarah?.ayahCount, 286)
        XCTAssertEqual(baqarah?.type, .madaniyah)

        let aalImran = AdvancedQuranSearchData.surahMetadata[3]
        XCTAssertEqual(aalImran?.name, "آل عمران")
        XCTAssertEqual(aalImran?.ayahCount, 200)
        XCTAssertEqual(aalImran?.type, .madaniyah)

        let nas = AdvancedQuranSearchData.surahMetadata[114]
        XCTAssertEqual(nas?.name, "الناس")
        XCTAssertEqual(nas?.ayahCount, 6)
        XCTAssertEqual(nas?.type, .makkiyah)
    }

    // MARK: - 7. Proportional Page Dwell & Reading Progress Tests

    func testProportionalPageDwellCalculation() {
        let totalAyahsOnPage = 6

        // Less than 1 second (flick/swipe): 0 ayahs
        let zeroAyahs = Int(Double(totalAyahsOnPage) * min(1.0, 0.5 / 30.0))
        XCTAssertEqual(zeroAyahs, 0)

        // User's exact example: 6 ayahs on page, 12 seconds stayed -> 2 ayahs completed
        let twelveSecondsAyahs = Int(Double(totalAyahsOnPage) * min(1.0, 12.0 / 30.0))
        XCTAssertEqual(twelveSecondsAyahs, 2)

        // 15 seconds: 3 ayahs completed
        let fifteenSecondsAyahs = Int(Double(totalAyahsOnPage) * min(1.0, 15.0 / 30.0))
        XCTAssertEqual(fifteenSecondsAyahs, 3)

        // 30 seconds: all 6 ayahs completed
        let thirtySecondsAyahs = Int(Double(totalAyahsOnPage) * min(1.0, 30.0 / 30.0))
        XCTAssertEqual(thirtySecondsAyahs, 6)

        // Greater than 30 seconds (e.g. 45s): capped at 6 ayahs
        let fortyFiveSecondsAyahs = Int(Double(totalAyahsOnPage) * min(1.0, 45.0 / 30.0))
        XCTAssertEqual(fortyFiveSecondsAyahs, 6)
    }

    // MARK: - 8. Manual Reading Session Tests

    func testManualReadingSessionRecording() {
        let khatma = testDB.getOrCreateActiveKhatma()

        // Manually record Surah Al-Fatiha (Ayahs 1 to 7 on Page 1)
        var items: [(surah: Int, ayah: Int, page: Int)] = []
        for a in 1...7 {
            items.append((surah: 1, ayah: a, page: 1))
        }

        let recorded = testDB.recordReadAyahs(khatmaId: khatma.id, items: items)
        XCTAssertEqual(recorded, 7)

        let fatihaCount = testDB.readAyahsCountForSurah(khatmaId: khatma.id, surah: 1)
        XCTAssertEqual(fatihaCount, 7)

        let totalRead = testDB.readAyahsCount(khatmaId: khatma.id)
        XCTAssertEqual(totalRead, 7)

        // Verify daily reading activity was recorded
        let streaks = testDB.recordDailyReadingActivity(ayahsCount: recorded, pagesCount: 1, on: Date())
        XCTAssertGreaterThanOrEqual(streaks.currentStreak, 1)
    }

    // MARK: - 9. Surah Progress Filter Tests

    func testSurahProgressRemainingFilter() {
        let khatma = testDB.getOrCreateActiveKhatma()

        // Al-Fatiha: 7/7 ayahs (100% completed)
        var fatihaItems: [(surah: Int, ayah: Int, page: Int)] = []
        for a in 1...7 { fatihaItems.append((surah: 1, ayah: a, page: 1)) }
        testDB.recordReadAyahs(khatmaId: khatma.id, items: fatihaItems)

        // Al-Baqarah: 10/286 ayahs (partially read)
        var baqarahItems: [(surah: Int, ayah: Int, page: Int)] = []
        for a in 1...10 { baqarahItems.append((surah: 2, ayah: a, page: 2)) }
        testDB.recordReadAyahs(khatmaId: khatma.id, items: baqarahItems)

        let fatihaProg = SurahProgress(
            surahNumber: 1,
            surahName: "الفاتحة",
            readAyahsCount: testDB.readAyahsCountForSurah(khatmaId: khatma.id, surah: 1),
            totalAyahsCount: 7,
            firstPage: 1
        )
        let baqarahProg = SurahProgress(
            surahNumber: 2,
            surahName: "البقرة",
            readAyahsCount: testDB.readAyahsCountForSurah(khatmaId: khatma.id, surah: 2),
            totalAyahsCount: 286,
            firstPage: 2
        )
        let aalImranProg = SurahProgress(
            surahNumber: 3,
            surahName: "آل عمران",
            readAyahsCount: 0,
            totalAyahsCount: 200,
            firstPage: 50
        )

        let all = [fatihaProg, baqarahProg, aalImranProg]

        // Remaining filter must EXCLUDE completed Al-Fatiha and INCLUDE Al-Baqarah & Aal-Imran
        let remaining = all.filter { !$0.isCompleted }
        XCTAssertEqual(remaining.count, 2)
        XCTAssertTrue(remaining.contains { $0.surahNumber == 2 })
        XCTAssertTrue(remaining.contains { $0.surahNumber == 3 })
        XCTAssertFalse(remaining.contains { $0.surahNumber == 1 })

        // Completed filter must contain only Al-Fatiha
        let completed = all.filter(\.isCompleted)
        XCTAssertEqual(completed.count, 1)
        XCTAssertEqual(completed.first?.surahNumber, 1)

        // Started filter must contain only Al-Baqarah
        let started = all.filter(\.isStarted)
        XCTAssertEqual(started.count, 1)
        XCTAssertEqual(started.first?.surahNumber, 2)

        // Remaining count checks
        XCTAssertEqual(fatihaProg.remainingAyahsCount, 0)
        XCTAssertEqual(baqarahProg.remainingAyahsCount, 276)
        XCTAssertEqual(aalImranProg.remainingAyahsCount, 200)
    }

    // MARK: - 8. Mutshabehat Magazine View Tests

    func testMutshabehatMagazineThemeColors() {
        // Palette must have 12 vibrant editorial colors
        XCTAssertEqual(MutshabehatMagazineTheme.palette.count, 12)

        // Custom colors must be respected if specified and non-default
        let customColor = MutshabehatMagazineTheme.color(for: "group-1", customColor: "#FF5733")
        XCTAssertEqual(customColor, Color(hex: "#FF5733"))

        // Default or empty colors must map to the rich magazine palette based on ID hash
        let colorA = MutshabehatMagazineTheme.color(for: "group-1", customColor: "#55b94f")
        let colorB = MutshabehatMagazineTheme.color(for: "group-2", customColor: "")
        XCTAssertNotNil(colorA)
        XCTAssertNotNil(colorB)
    }

    // MARK: - 9. iCloud Sync Tests

    func testSyncManifestParsing() throws {
        let json = """
        {
          "schema_version": 1,
          "exported_at": "2026-10-03T06:22:13Z",
          "source_of_truth": "https://mutshabehat-v2.vercel.app",
          "databases": {
            "mutshabehat": {
              "file": "mutshabehat.sqlite",
              "json_file": "mutshabehat.json",
              "groups_count": 251,
              "verses_count": 943,
              "parts_count": 3054,
              "sha256": "8c084fc661838c9257854b51c89ef96bbff3dd8991cde2d0fbed01b677b78985",
              "size_bytes": 1298432
            },
            "qiraat": {
              "file": "qiraat.sqlite",
              "page_count": 604,
              "variants_count": 3819,
              "rulings_count": 12391,
              "sha256": "17b0f553259bb923e55e2ae92c5e159d70c5e6366a1914129b63bad644d3d705",
              "size_bytes": 30466048
            }
          }
        }
        """.data(using: .utf8)!

        let manifest = try JSONDecoder().decode(SyncManifest.self, from: json)
        XCTAssertEqual(manifest.schemaVersion, 1)
        XCTAssertEqual(manifest.sourceOfTruth, "https://mutshabehat-v2.vercel.app")
        XCTAssertEqual(manifest.databases["mutshabehat"]?.groupsCount, 251)
        XCTAssertEqual(manifest.databases["mutshabehat"]?.versesCount, 943)
        XCTAssertEqual(manifest.databases["mutshabehat"]?.partsCount, 3054)
        XCTAssertEqual(manifest.databases["qiraat"]?.pageCount, 604)
        XCTAssertEqual(manifest.databases["qiraat"]?.rulingsCount, 12391)
    }

    func testICloudSyncFolderDiscovery() {
        let service = ICloudDatabaseSyncService.shared
        service.refreshConnectionStatus()
        let folder = service.resolveSyncFolder()
        // On macOS with iCloud Drive, folder should resolve to Mushaf_Qiraat
        XCTAssertNotNil(folder)
        if let folder {
            XCTAssertTrue(folder.path.contains("Mushaf_Qiraat"))
        }
    }

    func testMutshabehatDatabaseHotReloadNotification() {
        let expectation = expectation(forNotification: .mutshabehatDatabaseDidUpdate, object: nil)
        NotificationCenter.default.post(name: .mutshabehatDatabaseDidUpdate, object: nil)
        wait(for: [expectation], timeout: 1.0)
    }

    func testPage008QiraatRulingsMatchWebapp() throws {
        let qiraatDir = URL(fileURLWithPath: "/Users/amrelshazly/Projects/qiraat-ios/apps/ios/Generated/Qiraat")
        let store = try QiraatStore(directory: qiraatDir)
        guard let page8 = store.page(8) else {
            XCTFail("Page 8 must load from QiraatStore")
            return
        }

        // Webapp parity check: 44 rulings and 6 variants
        XCTAssertEqual(page8.variants.count, 6)
        XCTAssertEqual(page8.rulings.count, 44)

        // Check specific rulings that were previously missing in iOS:
        // Ayah 49: وَإِذْ (1), نَجَّيْنَـٰكُم (2), مِّنْ (3), ءَالِ (4), يَسُومُونَكُمْ (6), سُوٓءَ (7), أَبْنَآءَكُمْ (10)
        let ayah49Rulings = page8.rulings.filter { $0.surah == 2 && $0.ayah == 49 }
        XCTAssertGreaterThanOrEqual(ayah49Rulings.count, 15)

        let marks = store.marks(page: 8)
        XCTAssertNotNil(marks)

        // Verify ruling markers for Ayah 49, words 1, 2, 6, 7
        let w1Ruling = marks?.rulingMarker(surah: 2, ayah: 49, token: 1, filter: .all)
        XCTAssertEqual(w1Ruling?.color, "#DC2626") // USUL_TAHQIQ (Red)

        let w2Ruling = marks?.rulingMarker(surah: 2, ayah: 49, token: 2, filter: .all)
        XCTAssertEqual(w2Ruling?.color, "#DB2777") // USUL_MIM_JAM (Pink/Magenta)

        let w6Ruling = marks?.rulingMarker(surah: 2, ayah: 49, token: 6, filter: .all)
        XCTAssertEqual(w6Ruling?.color, "#DB2777") // USUL_MIM_JAM (Pink/Magenta)

        let w7Ruling = marks?.rulingMarker(surah: 2, ayah: 49, token: 7, filter: .all)
        XCTAssertEqual(w7Ruling?.color, "#DC2626") // USUL_TAHQIQ (Red)
    }

    @MainActor
    func testNextUnreadAyahAndPageNavigation() throws {
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("test_reading_\(UUID().uuidString).sqlite")
        let db = QuranReadingDatabase(url: tempURL)
        let tracker = ReadingTracker(database: db)
        let library = try MushafLibrary()

        guard let surah7 = library.surahs.first(where: { $0.number == 7 }) else {
            XCTFail("Surah 7 must exist in library")
            return
        }

        // Initially with 0 ayahs read: should start from ayah 1 / page 151
        XCTAssertEqual(tracker.nextUnreadAyah(for: 7, library: library), 1)
        XCTAssertEqual(tracker.nextUnreadPage(for: surah7, library: library), 151)

        // Simulate user reading ayahs 1..34 of Surah 7
        var readItems: [(surah: Int, ayah: Int, page: Int)] = []
        for a in 1...34 {
            let p = library.page(of: AyahKey(surah: 7, ayah: a)) ?? 151
            readItems.append((surah: 7, ayah: a, page: p))
        }
        _ = db.recordReadAyahs(khatmaId: tracker.activeKhatma.id, items: readItems)

        // User requirement: When pressing Surah 7 in statistics tab, go directly to ayah 35 / page 154
        let nextAyah = tracker.nextUnreadAyah(for: 7, library: library)
        XCTAssertEqual(nextAyah, 35)

        let targetPage = tracker.nextUnreadPage(for: surah7, library: library)
        XCTAssertEqual(targetPage, 154) // Ayah 7:35 is on page 154, NOT beginning of surah (151)
    }

    @MainActor
    func testMushafFontLoadsProperly() {
        let font = MushafLibrary.mushafFont(size: 24)
        XCTAssertEqual(font.fontName, "KFGQPCUthmanicScriptHAFS")
    }

    func testLifetimeReadAyahsAccumulation() {
        // Record 10 ayahs in khatma 1
        let khatma1 = testDB.getOrCreateActiveKhatma()
        let items1 = (1...10).map { (surah: 1, ayah: $0, page: 1) }
        _ = testDB.recordReadAyahs(khatmaId: khatma1.id, items: items1)
        testDB.recordDailyReadingActivity(ayahsCount: 10, pagesCount: 1, on: Date())

        XCTAssertGreaterThanOrEqual(testDB.lifetimeReadAyahsCount(), 10)

        // Complete khatma 1
        _ = testDB.completeActiveKhatma(khatmaId: khatma1.id)

        // Record 15 ayahs in khatma 2
        let khatma2 = testDB.getOrCreateActiveKhatma()
        let items2 = (1...15).map { (surah: 2, ayah: $0, page: 2) }
        _ = testDB.recordReadAyahs(khatmaId: khatma2.id, items: items2)
        testDB.recordDailyReadingActivity(ayahsCount: 15, pagesCount: 2, on: Date())

        // Cumulative count must reflect total ayahs across all sessions/khatmas
        let total = testDB.lifetimeReadAyahsCount()
        XCTAssertGreaterThanOrEqual(total, 25)
    }

    @MainActor
    func testFullSurahManualSessionRecording() throws {
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("test_full_surah_\(UUID().uuidString).sqlite")
        let db = QuranReadingDatabase(url: tempURL)
        let tracker = ReadingTracker(database: db)
        let library = try MushafLibrary()

        // Record full Surah Al-Fatiha (7 ayahs)
        let count = tracker.recordManualSession(
            fromSurah: 1,
            fromAyah: 1,
            toSurah: 1,
            toAyah: 7,
            sessionDate: Date(),
            durationMinutes: 5,
            fromMemory: false,
            library: library
        )

        XCTAssertEqual(count, 7)
        let stats = tracker.statsOverview(library: library)
        XCTAssertEqual(stats.totalAyahsReadInCurrentKhatma, 7)
        XCTAssertGreaterThanOrEqual(stats.lifetimeAyahsRead, 7)
        XCTAssertEqual(stats.completedSurahsCount, 1)
        XCTAssertGreaterThanOrEqual(stats.lifetimeReadingSeconds, 300) // 5 minutes = 300 seconds
        XCTAssertFalse(stats.formattedLifetimeDuration.isEmpty)
    }

    func testReadingDurationTrackingAndAccumulation() {
        let today = Date()
        let calendar = Calendar.current
        guard let yesterday = calendar.date(byAdding: .day, value: -1, to: today) else {
            XCTFail("Date calculation failed")
            return
        }

        // Record 1800 seconds (30 mins) yesterday
        testDB.recordDailyReadingActivity(ayahsCount: 20, pagesCount: 2, seconds: 1800, on: yesterday)
        // Record 900 seconds (15 mins) today
        testDB.recordDailyReadingActivity(ayahsCount: 15, pagesCount: 1, seconds: 900, on: today)

        let totalSeconds = testDB.lifetimeReadingSeconds()
        XCTAssertEqual(totalSeconds, 2700) // 45 mins total

        let dayFormatter = DateFormatter()
        dayFormatter.dateFormat = "yyyy-MM-dd"
        let todayStr = dayFormatter.string(from: today)
        let yesterdayStr = dayFormatter.string(from: yesterday)

        let todaySec = testDB.readingSeconds(for: todayStr)
        XCTAssertEqual(todaySec, 900)

        let yesterdaySec = testDB.readingSeconds(for: yesterdayStr)
        XCTAssertEqual(yesterdaySec, 1800)

        let map = testDB.readingSecondsMap(startingFrom: yesterday, endingAt: today)
        XCTAssertEqual(map[todayStr], 900)
        XCTAssertEqual(map[yesterdayStr], 1800)

        // Test WeeklyDayStatus formatting
        let status = WeeklyDayStatus(dateString: todayStr, dayNameAr: "الأحد", dayNumber: "١", isRead: true, isToday: true, readingSeconds: 900)
        XCTAssertTrue(status.formattedDuration.contains("١٥") && status.formattedDuration.contains("د"))

        let statusLong = WeeklyDayStatus(dateString: yesterdayStr, dayNameAr: "السبت", dayNumber: "٣٠", isRead: true, isToday: false, readingSeconds: 3900) // 1h 5m
        XCTAssertTrue(statusLong.formattedDuration.contains("١") && statusLong.formattedDuration.contains("س"))
    }
}


