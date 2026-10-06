import MushafCore
import XCTest
@testable import Mutshabehat

@MainActor
final class MemorizationStoreTests: XCTestCase {
    private var directory: URL!
    private var now = Date(epochMilliseconds: 1_790_000_000_000)
    private var calendar: Calendar = {
        var value = Calendar(identifier: .gregorian)
        value.timeZone = TimeZone(identifier: "UTC")!
        return value
    }()

    /// Surah 1 (7 ayat) on page 1 and surah 2 (10 ayat) on page 2, both in juz 1.
    private let index = QuranIndex(
        rows: (1...7).map { AyahLayoutRow(key: AyahKey(surah: 1, ayah: $0), page: 1, wordCount: 3) }
            + (1...10).map { AyahLayoutRow(key: AyahKey(surah: 2, ayah: $0), page: 2, wordCount: 3) },
        pageJuz: [1: 1, 2: 1])

    override func setUp() async throws {
        try await super.setUp()
        directory = FileManager.default.temporaryDirectory.appendingPathComponent("store-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    override func tearDown() async throws {
        try? FileManager.default.removeItem(at: directory)
        try await super.tearDown()
    }

    private func makeStore(file: String = "m.sqlite", defaults: UserDefaults? = nil) -> MemorizationStore {
        MemorizationStore(database: MemorizationDatabase(url: directory.appendingPathComponent(file)), index: index,
                          clock: { [unowned self] in self.now }, calendar: calendar,
                          defaults: defaults ?? UserDefaults(suiteName: "store-\(UUID().uuidString)")!)
    }

    func testNewInstallPageMarkIsNotMemorized() {
        // Review focus: a brand-new install has zero everywhere and the page mark reads «غير محفوظ».
        let store = makeStore()
        XCTAssertEqual(store.pageProgress(1).state, .notMemorized)
        XCTAssertEqual(store.snapshot.strictPercent, 0)
        XCTAssertEqual(store.snapshot.learningPercent, 0)
        XCTAssertEqual(store.snapshot.completedSurahs, 0)
        XCTAssertNil(store.suggestion)
        XCTAssertEqual(store.streak, StreakSummary(current: 0, longest: 0))
        XCTAssertNil(store.currentPosition?.from)
    }

    func testVersionBumpsOnApplyAndUndo() throws {
        let store = makeStore()
        let v0 = store.version
        let result = try store.update(.surah(1), label: "الفاتحة", status: .mastered)
        XCTAssertGreaterThan(store.version, v0)
        let v1 = store.version
        try store.undo(batchID: result.batch.id)
        XCTAssertGreaterThan(store.version, v1)
        XCTAssertEqual(store.status(of: AyahKey(surah: 1, ayah: 1)), .notMemorized)
    }

    func testSnapshotRefreshesAfterApplyAndIsCachedBetweenChanges() throws {
        let store = makeStore()
        _ = try store.update(.surah(1), label: "x", status: .mastered)
        XCTAssertEqual(store.snapshot.counts[.mastered], 7)
        XCTAssertEqual(store.snapshot.strictPercent, 7.0 / 17.0 * 100, accuracy: 1e-9)
        XCTAssertEqual(store.snapshot, store.snapshot)
    }

    func testPageProgressReflectsStatuses() throws {
        let store = makeStore()
        _ = try store.update(.surah(1), label: "x", status: .mastered)
        XCTAssertEqual(store.pageProgress(1).state, .mastered)
        XCTAssertEqual(store.pageProgress(2).state, .notMemorized)
        _ = try store.update(.ayahRange(surah: 1, from: 3, to: 3), label: "x", status: .memorizedWithErrors)
        XCTAssertEqual(store.pageProgress(1).state, .memorizedWithErrors)
        XCTAssertEqual(store.statuses(onPage: 1).count, 7)
        XCTAssertTrue(store.statuses(onPage: 2).isEmpty)
    }

    func testMilestoneReportedOnlyOnce() throws {
        let store = makeStore()
        let first = try store.update(.surah(1), label: "x", status: .mastered)
        XCTAssertEqual(first.milestones, [.surahCompleted(1)])
        try store.undo(batchID: first.batch.id)
        let again = try store.update(.surah(1), label: "x", status: .mastered)
        XCTAssertTrue(again.milestones.isEmpty)
    }

    func testQuranCompletedAtIsSetOnceAndNeverCleared() throws {
        let store = makeStore()
        XCTAssertNil(store.quranCompletedAt)
        _ = try store.update(.span(from: AyahKey(surah: 1, ayah: 1), to: AyahKey(surah: 2, ayah: 10)), label: "all", status: .mastered)
        let first = try XCTUnwrap(store.quranCompletedAt)
        XCTAssertEqual(first, now)
        now = now.addingTimeInterval(500)
        _ = try store.update(.ayahRange(surah: 1, from: 1, to: 1), label: "down", status: .needsMushaf)
        XCTAssertEqual(store.quranCompletedAt, first, "downgrading never erases the completion date")
        now = now.addingTimeInterval(500)
        _ = try store.update(.ayahRange(surah: 1, from: 1, to: 1), label: "up", status: .mastered)
        XCTAssertEqual(store.quranCompletedAt, first, "re-mastering keeps the first date")
    }

    func testStreakIgnoresUndoneBatch() throws {
        let store = makeStore()
        let result = try store.update(.surah(1), label: "x", status: .mastered)
        XCTAssertEqual(store.streak.current, 1)
        try store.undo(batchID: result.batch.id)
        XCTAssertEqual(store.streak.current, 0)
    }

    func testReviewDoesNotChangeStatusButCountsForStreak() throws {
        let store = makeStore()
        _ = try store.update(.surah(1), label: "x", status: .mastered)
        now = now.addingTimeInterval(86_400)
        let result = try store.review(.surah(1), label: "مراجعة", result: .forgot)
        XCTAssertEqual(result.batch.kind, .review)
        XCTAssertEqual(store.status(of: AyahKey(surah: 1, ayah: 1)), .mastered)
        XCTAssertEqual(store.record(of: AyahKey(surah: 1, ayah: 1))?.reviewStrength, .weak)
        XCTAssertEqual(store.streak.current, 2)
    }

    func testUndoSurfacesNewerOverlappingChanges() throws {
        let store = makeStore()
        let first = try store.update(.surah(1), label: "a", status: .mastered)
        let second = try store.update(.ayahRange(surah: 1, from: 2, to: 3), label: "b", status: .needsMushaf)
        XCTAssertThrowsError(try store.undo(batchID: first.batch.id)) { error in
            XCTAssertEqual(error as? MemorizationError, .hasNewerChanges([second.batch]))
        }
        XCTAssertEqual(store.status(of: AyahKey(surah: 1, ayah: 2)), .needsMushaf)
        try store.undo(batchID: first.batch.id, force: true)
    }

    func testSettingsDefaults() {
        let store = makeStore()
        XCTAssertTrue(store.showsBannerMark)
        XCTAssertFalse(store.showsAyahMarker)
        let defaults = UserDefaults(suiteName: "store-settings-\(UUID().uuidString)")!
        let first = makeStore(defaults: defaults)
        first.showsBannerMark = false
        first.showsAyahMarker = true
        let second = makeStore(defaults: defaults)
        XCTAssertFalse(second.showsBannerMark)
        XCTAssertTrue(second.showsAyahMarker)
    }

    func testCurrentPositionPersistsAcrossStores() {
        let first = makeStore()
        first.currentPosition = (AyahKey(surah: 2, ayah: 1), AyahKey(surah: 2, ayah: 5))
        let second = makeStore()
        XCTAssertEqual(second.currentPosition?.from, AyahKey(surah: 2, ayah: 1))
        XCTAssertEqual(second.currentPosition?.to, AyahKey(surah: 2, ayah: 5))
        second.currentPosition = nil
        XCTAssertNil(makeStore().currentPosition)
    }

    func testStateSurvivesReopeningTheDatabase() throws {
        let first = makeStore()
        _ = try first.update(.surah(1), label: "x", status: .mastered)
        let second = makeStore()
        XCTAssertEqual(second.snapshot.counts[.mastered], 7)
    }
}
