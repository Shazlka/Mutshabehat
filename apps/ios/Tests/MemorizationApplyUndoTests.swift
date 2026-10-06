import MushafCore
import SQLite3
import XCTest
@testable import Mutshabehat

final class MemorizationApplyUndoTests: XCTestCase {
    private var directory: URL!
    private var db: MemorizationDatabase!
    private var clock = Date(epochMilliseconds: 1_790_000_000_000)

    /// Surah 1 (7 ayat) on page 1 and surah 2 (10 ayat) on page 2, both in juz 1.
    private let index = QuranIndex(
        rows: (1...7).map { AyahLayoutRow(key: AyahKey(surah: 1, ayah: $0), page: 1, wordCount: 3) }
            + (1...10).map { AyahLayoutRow(key: AyahKey(surah: 2, ayah: $0), page: 2, wordCount: 3) },
        pageJuz: [1: 1, 2: 1])

    private var utc: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        return calendar
    }

    override func setUp() {
        super.setUp()
        directory = FileManager.default.temporaryDirectory.appendingPathComponent("apply-\(UUID().uuidString)")
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        db = MemorizationDatabase(url: directory.appendingPathComponent("m.sqlite"))
    }

    override func tearDown() {
        db = nil
        try? FileManager.default.removeItem(at: directory)
        super.tearDown()
    }

    // MARK: Helpers

    private func tick(_ seconds: TimeInterval = 60) { clock = clock.addingTimeInterval(seconds) }

    private func plan(_ selection: MemorizationSelection, _ status: MemorizationStatus, learning: Bool? = nil) -> BatchPlan {
        MemorizationPlanner.planUpdate(selection: selection, label: "test", status: status, learning: learning,
                                       records: db.loadRecords(), index: index, now: clock)
    }

    @discardableResult
    private func apply(_ selection: MemorizationSelection, _ status: MemorizationStatus) throws -> BatchRecord {
        tick()
        return try db.apply(plan(selection, status), now: clock)
    }

    private func rawExec(_ sql: String) {
        var handle: OpaquePointer?
        XCTAssertEqual(sqlite3_open(db.fileURL.path, &handle), SQLITE_OK)
        sqlite3_exec(handle, sql, nil, nil, nil)
        sqlite3_close(handle)
    }

    // MARK: Apply

    func testApplyWritesStateBatchAndEvents() throws {
        let p = plan(.surah(1), .mastered)
        let batch = try db.apply(p, now: clock)
        XCTAssertEqual(db.loadRecords(), Dictionary(uniqueKeysWithValues: p.changes.map { ($0.key, $0.after) }))
        let batches = db.batches(limit: 10, offset: 0)
        XCTAssertEqual(batches, [batch])
        XCTAssertEqual(batch.ayahCount, 7)
        XCTAssertEqual(batch.kind, .update)
        XCTAssertTrue(batch.countsForStreak)
        XCTAssertEqual(batch.gainAyahs, 7)
        let events = db.events(batchID: batch.id)
        XCTAssertEqual(events.count, 7)
        XCTAssertTrue(events.allSatisfy { $0.before == nil && $0.after.status == .mastered })
    }

    func testApplyOfAnEmptyPlanIsRefused() {
        let empty = plan(.surah(1), .notMemorized)
        XCTAssertThrowsError(try db.apply(empty, now: clock)) { XCTAssertEqual($0 as? MemorizationError, .nothingToApply) }
        XCTAssertTrue(db.batches(limit: 5, offset: 0).isEmpty)
    }

    func testApplyIsAtomic() {
        let p = plan(.surah(1), .mastered)
        rawExec("DROP TABLE memorization_events")   // the batch and ayah rows are written before the events
        XCTAssertThrowsError(try db.apply(p, now: clock)) { error in
            guard case MemorizationError.writeFailed = error else { return XCTFail("\(error)") }
        }
        XCTAssertTrue(db.loadRecords().isEmpty)
        XCTAssertTrue(db.batches(limit: 10, offset: 0).isEmpty)
    }

    func testWholeQuranApplyIsOneBatchAndFast() throws {
        var changes: [AyahChange] = []
        for surah in 1...100 {
            for ayah in 1...60 {
                let key = AyahKey(surah: surah, ayah: ayah)
                var after = AyahMemorizationRecord.blank(key, now: clock)
                after.status = .mastered
                changes.append(AyahChange(key: key, before: nil, after: after))
            }
        }
        let plan = BatchPlan(kind: .update, label: "all", scopeJSON: "{}", selectionCount: changes.count, changes: changes,
                             countsForStreak: true, gainAyahs: changes.count)
        let started = Date()
        _ = try db.apply(plan, now: clock)
        XCTAssertLessThan(Date().timeIntervalSince(started), 2)
        XCTAssertEqual(db.loadRecords().count, 6000)
        XCTAssertEqual(db.batches(limit: 10, offset: 0).count, 1)
    }

    func testDatesRoundTripExactly() throws {
        let key = AyahKey(surah: 1, ayah: 1)
        var record = AyahMemorizationRecord.blank(key, now: clock)
        record.status = .mastered
        record.firstMemorizedAt = clock
        record.lastReviewedAt = Date(epochMilliseconds: 1_789_999_999_123)
        record.nextReviewAt = Date(epochMilliseconds: 1_790_086_400_999)
        let change = AyahChange(key: key, before: nil, after: record)
        _ = try db.apply(BatchPlan(kind: .review, label: "x", scopeJSON: "{}", selectionCount: 1, changes: [change],
                                   countsForStreak: true, gainAyahs: 0), now: clock)
        XCTAssertEqual(db.loadRecords()[key], record)
        XCTAssertEqual(db.events(batchID: db.batches(limit: 1, offset: 0)[0].id)[0].after, record)
    }

    // MARK: Undo

    func testUndoRestoresExactPriorRows() throws {
        let a = try apply(.surah(1), .needsMushaf)
        let afterA = db.loadRecords()
        let b = try apply(.surah(2), .mastered)
        tick()
        _ = try db.undo(batchID: b.id, force: false, now: clock)   // surah 2 rows did not exist before
        XCTAssertEqual(db.loadRecords(), afterA)

        try apply(.ayahRange(surah: 1, from: 1, to: 2), .memorizedWithErrors)   // sets firstMemorizedAt on 1:1…2
        let c = db.batches(limit: 1, offset: 0)[0]
        XCTAssertNotEqual(db.loadRecords(), afterA)
        tick()
        _ = try db.undo(batchID: c.id, force: false, now: clock)
        XCTAssertEqual(db.loadRecords(), afterA, "the whole row dictionary returns to batch A's state")
        _ = a
    }

    func testUndoTwiceIsRefused() throws {
        let a = try apply(.surah(1), .mastered)
        tick()
        _ = try db.undo(batchID: a.id, force: false, now: clock)
        let afterFirst = db.loadRecords()
        XCTAssertThrowsError(try db.undo(batchID: a.id, force: false, now: clock)) {
            XCTAssertEqual($0 as? MemorizationError, .alreadyUndone)
        }
        XCTAssertEqual(db.loadRecords(), afterFirst)
    }

    func testUndoWithNewerOverlappingBatchWarns() throws {
        let a = try apply(.surah(1), .mastered)
        let b = try apply(.ayahRange(surah: 1, from: 3, to: 4), .needsMushaf)
        let before = db.loadRecords()
        tick()
        XCTAssertThrowsError(try db.undo(batchID: a.id, force: false, now: clock)) { error in
            guard case let MemorizationError.hasNewerChanges(newer) = error else { return XCTFail("\(error)") }
            XCTAssertEqual(newer.map(\.id), [b.id])
        }
        XCTAssertEqual(db.loadRecords(), before)
        XCTAssertEqual(db.undoConflicts(batchID: a.id).map(\.id), [b.id])

        tick()
        _ = try db.undo(batchID: a.id, force: true, now: clock)
        XCTAssertTrue(db.loadRecords().isEmpty, "A's before-state was 'no rows'")
    }

    func testUndoWithNewerBatchOnOtherAyatDoesNotWarn() throws {
        let a = try apply(.surah(1), .mastered)
        try apply(.surah(2), .mastered)
        XCTAssertTrue(db.undoConflicts(batchID: a.id).isEmpty)
        tick()
        XCTAssertNoThrow(try db.undo(batchID: a.id, force: false, now: clock))
        XCTAssertEqual(db.loadRecords().count, 10)
    }

    func testUndoIsRecordedAsABatchAndStaysVisible() throws {
        let a = try apply(.surah(1), .mastered)
        tick()
        let undo = try db.undo(batchID: a.id, force: false, now: clock)
        let listed = db.batches(limit: 10, offset: 0)
        XCTAssertEqual(listed.count, 2)
        XCTAssertNotNil(listed.first { $0.id == a.id }?.undoneAt)
        XCTAssertEqual(undo.kind, .undo)
        XCTAssertEqual(undo.undoesBatchID, a.id)
        XCTAssertEqual(undo.ayahCount, 7)
        XCTAssertFalse(undo.countsForStreak)
        XCTAssertEqual(db.events(batchID: undo.id).count, 7)
    }

    func testCannotUndoAnUndoAndUnknownIDIsNotFound() throws {
        let a = try apply(.surah(1), .mastered)
        tick()
        let undo = try db.undo(batchID: a.id, force: false, now: clock)
        XCTAssertThrowsError(try db.undo(batchID: undo.id, force: false, now: clock)) {
            XCTAssertEqual($0 as? MemorizationError, .notUndoable)
        }
        XCTAssertThrowsError(try db.undo(batchID: UUID(), force: false, now: clock)) {
            XCTAssertEqual($0 as? MemorizationError, .notFound)
        }
    }

    func testUndoRollsBackWhenTheWriteFails() throws {
        let a = try apply(.surah(1), .mastered)
        let before = db.loadRecords()
        rawExec("DROP TABLE memorization_events")
        tick()
        XCTAssertThrowsError(try db.undo(batchID: a.id, force: false, now: clock))
        XCTAssertEqual(db.loadRecords(), before)
    }

    // MARK: Streak days and history

    func testUndoneBatchNoLongerCountsForStreak() throws {
        let a = try apply(.surah(1), .mastered)
        XCTAssertEqual(db.qualifyingDays(calendar: utc), [utc.startOfDay(for: clock)])
        tick()
        _ = try db.undo(batchID: a.id, force: false, now: clock)
        XCTAssertTrue(db.qualifyingDays(calendar: utc).isEmpty)
    }

    func testDowngradesDoNotQualify() throws {
        try apply(.surah(1), .mastered)
        tick(86_400)
        try apply(.surah(1), .needsMushaf)     // a downgrade
        XCTAssertEqual(db.qualifyingDays(calendar: utc).count, 1)
    }

    func testEventsSinceFilters() throws {
        try apply(.surah(1), .mastered)
        tick(3_600)
        let cutoff = clock
        try apply(.surah(2), .mastered)
        XCTAssertEqual(db.events(since: nil).count, 17)
        XCTAssertEqual(db.events(since: cutoff).count, 10)
    }

    func testBatchesPageNewestFirst() throws {
        let first = try apply(.surah(1), .mastered)
        let second = try apply(.surah(2), .mastered)
        XCTAssertEqual(db.batches(limit: 1, offset: 0).map(\.id), [second.id])
        XCTAssertEqual(db.batches(limit: 1, offset: 1).map(\.id), [first.id])
        XCTAssertEqual(db.batch(id: first.id), first)
        XCTAssertNil(db.batch(id: UUID()))
    }

    // MARK: Transfer and goals

    func testExportAllThenReplaceAllRoundTrip() throws {
        let a = try apply(.surah(1), .mastered)
        try apply(.surah(2), .needsMushaf)
        tick()
        _ = try db.undo(batchID: a.id, force: true, now: clock)
        try db.saveGoal(GoalDefinition(id: UUID(), kind: .completeSurah(1), createdAt: clock))
        db.setMeta("current_from", "2:1")
        let export = db.exportAll(now: clock)

        let other = MemorizationDatabase(url: directory.appendingPathComponent("other.sqlite"))
        let otherDevice = other.deviceID
        try other.replaceAll(with: export)
        let copy = other.exportAll(now: clock)
        XCTAssertEqual(copy.records, export.records)
        XCTAssertEqual(copy.batches, export.batches)
        XCTAssertEqual(copy.events, export.events)
        XCTAssertEqual(copy.goals, export.goals)
        XCTAssertEqual(copy.meta["current_from"], "2:1")
        XCTAssertEqual(other.deviceID, otherDevice, "a restore never changes this device's identity")
    }

    func testReplaceAllFailureKeepsPreviousData() throws {
        try apply(.surah(1), .mastered)
        let before = db.loadRecords()
        var export = db.exportAll(now: clock)
        let duplicate = export.batches[0]
        export.batches.append(duplicate)   // the same batch id twice violates the primary key
        XCTAssertThrowsError(try db.replaceAll(with: export)) { error in
            guard case MemorizationError.writeFailed = error else { return XCTFail("\(error)") }
        }
        XCTAssertEqual(db.loadRecords(), before)
        XCTAssertEqual(db.batches(limit: 5, offset: 0).count, 1)
    }

    func testMergeKeepsNewerRows() throws {
        try apply(.ayahRange(surah: 1, from: 1, to: 1), .mastered)
        let local = db.loadRecords()[AyahKey(surah: 1, ayah: 1)]!
        var older = local
        older.status = .needsMushaf
        older.updatedAt = Date(epochMilliseconds: local.updatedAt.epochMilliseconds - 10_000)
        var extra = AyahMemorizationRecord.blank(AyahKey(surah: 1, ayah: 2), now: clock)
        extra.status = .mastered
        extra.updatedAt = Date(epochMilliseconds: 1_000)
        let incoming = MemorizationExport(exportedAt: clock, deviceID: "other", records: [older, extra], batches: [],
                                          events: [], goals: [], meta: [:])
        tick()
        try db.merge(incoming, now: clock)
        let records = db.loadRecords()
        XCTAssertEqual(records[AyahKey(surah: 1, ayah: 1)]?.status, .mastered)
        XCTAssertNotNil(records[AyahKey(surah: 1, ayah: 2)])
    }

    func testGoalsCRUDAndSurviveExport() throws {
        let goal = GoalDefinition(id: UUID(), kind: .ayatPerDay(10), createdAt: clock)
        try db.saveGoal(goal)
        XCTAssertEqual(db.goals(), [goal])
        var changed = goal
        changed.kind = .completeJuz(30)
        try db.saveGoal(changed)
        XCTAssertEqual(db.goals(), [changed])
        let export = db.exportAll(now: clock)
        XCTAssertEqual(export.goals, [changed])
        db.deleteGoal(id: goal.id)
        XCTAssertTrue(db.goals().isEmpty)
        try db.replaceAll(with: export)
        XCTAssertEqual(db.goals(), [changed])
    }
}
