import Foundation
import MushafCore
import Observation

/// The app-facing owner of memorization: it keeps every ayah's state in memory, applies updates and reviews
/// through the database as one atomic batch, and answers every question the screens ask (statistics, page
/// state, streak, suggestion). All numbers come from `MushafCore`; views never compute them.
@MainActor
@Observable
final class MemorizationStore {
    struct ApplyResult: Equatable {
        let batch: BatchRecord
        /// Milestones this batch crossed that had not been reported before.
        let milestones: [Milestone]
    }

    let index: QuranIndex
    let policy: MemorizationPolicy
    let database: MemorizationDatabase
    @ObservationIgnored private let clock: @MainActor () -> Date
    @ObservationIgnored private let calendar: Calendar
    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private var records: [AyahKey: AyahMemorizationRecord]
    @ObservationIgnored private var snapshotCache: (version: Int, value: MemorizationSnapshot)?

    /// Bumped after every successful write, so observers re-read what they show.
    private(set) var version = 0 {
        didSet { onDataChanged?() }
    }
    /// Called after every change of the data (used to schedule a backup).
    @ObservationIgnored var onDataChanged: (() -> Void)?

    static let bannerMarkKey = "memorization:show-banner-mark:v1"
    static let ayahMarkerKey = "memorization:show-ayah-marker:v1"

    var showsBannerMark: Bool {
        didSet { defaults.set(showsBannerMark, forKey: Self.bannerMarkKey) }
    }

    var showsAyahMarker: Bool {
        didSet { defaults.set(showsAyahMarker, forKey: Self.ayahMarkerKey) }
    }

    init(database: MemorizationDatabase, index: QuranIndex, policy: MemorizationPolicy = .standard,
         clock: @escaping @MainActor () -> Date = { Date() }, calendar: Calendar = .current,
         defaults: UserDefaults = .standard) {
        self.database = database
        self.index = index
        self.policy = policy
        self.clock = clock
        self.calendar = calendar
        self.defaults = defaults
        records = database.loadRecords()
        showsBannerMark = defaults.object(forKey: Self.bannerMarkKey) as? Bool ?? true
        showsAyahMarker = defaults.object(forKey: Self.ayahMarkerKey) as? Bool ?? false
    }

    // MARK: Reading state

    func record(of key: AyahKey) -> AyahMemorizationRecord? {
        _ = version
        return records[key]
    }

    func status(of key: AyahKey) -> MemorizationStatus {
        _ = version
        return records[key]?.status ?? .notMemorized
    }

    /// Every statistic of the whole Quran, recomputed once per change.
    var snapshot: MemorizationSnapshot {
        let current = version
        if let cache = snapshotCache, cache.version == current { return cache.value }
        let value = MemorizationStatisticsService.snapshot(records: records, index: index, policy: policy)
        snapshotCache = (current, value)
        return value
    }

    func pageProgress(_ page: Int) -> MemorizationPageProgress {
        _ = version
        return MemorizationStatisticsService.pageProgress(page: page, records: records, index: index)
    }

    /// The statuses of the ayat on one page, for the optional marker in the Mushaf (nil statuses are left out).
    func statuses(onPage page: Int) -> [AyahKey: MemorizationStatus] {
        _ = version
        var result: [AyahKey: MemorizationStatus] = [:]
        for key in index.ayat(onPage: page) {
            if let status = records[key]?.status, status != .notMemorized { result[key] = status }
        }
        return result
    }

    var allRecords: [AyahKey: AyahMemorizationRecord] {
        _ = version
        return records
    }

    var streak: StreakSummary {
        _ = version
        return StreakCalculator.summary(qualifyingDays: database.qualifyingDays(calendar: calendar), now: clock(),
                                        calendar: calendar)
    }

    var suggestion: Suggestion? {
        _ = version
        return SuggestionEngine.suggest(records: records, index: index, now: clock(), calendar: calendar)
    }

    // MARK: Planning

    func plan(_ selection: MemorizationSelection, label: String, status: MemorizationStatus,
              learning: Bool? = nil) -> BatchPlan {
        MemorizationPlanner.planUpdate(selection: selection, label: label, status: status, learning: learning,
                                       records: records, index: index, now: clock())
    }

    func reviewPlan(_ selection: MemorizationSelection, label: String, result: ReviewResult) -> BatchPlan {
        MemorizationPlanner.planReview(selection: selection, label: label, result: result, records: records,
                                       index: index, now: clock(), policy: policy)
    }

    func needsConfirmation(selection: MemorizationSelection, plan: BatchPlan) -> Bool {
        MemorizationPlanner.needsConfirmation(selection: selection, plan: plan, index: index, policy: policy)
    }

    // MARK: Writing

    /// Applies a plan as one atomic batch and reports the milestones it crossed for the first time.
    @discardableResult
    func apply(_ plan: BatchPlan) throws -> ApplyResult {
        let before = snapshot
        let now = clock().normalizedToMilliseconds
        let batch = try database.apply(plan, now: now)
        for change in plan.changes { records[change.key] = change.after }
        version += 1
        let after = snapshot
        let milestones = reportNew(MemorizationPlanner.milestones(before: before, after: after, policy: policy))
        recordCompletionIfNeeded(after: after, now: now)
        return ApplyResult(batch: batch, milestones: milestones)
    }

    @discardableResult
    func update(_ selection: MemorizationSelection, label: String, status: MemorizationStatus,
                learning: Bool? = nil) throws -> ApplyResult {
        try apply(plan(selection, label: label, status: status, learning: learning))
    }

    @discardableResult
    func review(_ selection: MemorizationSelection, label: String, result: ReviewResult) throws -> ApplyResult {
        try apply(reviewPlan(selection, label: label, result: result))
    }

    /// Undoes a batch. When newer batches touched the same ayat this throws `.hasNewerChanges` unless `force`.
    func undo(batchID: UUID, force: Bool = false) throws {
        _ = try database.undo(batchID: batchID, force: force, now: clock().normalizedToMilliseconds)
        records = database.loadRecords()
        version += 1
    }

    /// After a restore or import changed the database underneath the store.
    func reloadFromDatabase() {
        records = database.loadRecords()
        version += 1
    }

    // MARK: History

    func batches(limit: Int, offset: Int = 0) -> [BatchRecord] {
        _ = version
        return database.batches(limit: limit, offset: offset)
    }

    func undoConflicts(batchID: UUID) -> [BatchRecord] { database.undoConflicts(batchID: batchID) }

    func events(batchID: UUID) -> [ChangeEvent] { database.events(batchID: batchID) }

    func events(since: Date?) -> [ChangeEvent] { database.events(since: since) }

    // MARK: Goals and progress over time

    var goals: [GoalDefinition] {
        _ = version
        return database.goals()
    }

    func addGoal(_ kind: GoalKind) throws {
        try database.saveGoal(GoalDefinition(id: UUID(), kind: kind, createdAt: clock().normalizedToMilliseconds))
        version += 1
    }

    func deleteGoal(_ id: UUID) {
        database.deleteGoal(id: id)
        version += 1
    }

    func goalProgress(_ goal: GoalDefinition) -> GoalProgress {
        let now = clock()
        let weekStart = calendar.dateInterval(of: .weekOfYear, for: now)?.start ?? calendar.startOfDay(for: now)
        let since = min(weekStart, calendar.startOfDay(for: now)).addingTimeInterval(-1)
        return GoalEngine.progress(goal, snapshot: snapshot, records: records, events: database.events(since: since),
                                   index: index, now: now, calendar: calendar)
    }

    /// What was gained between `start` and now: new ayat, page-equivalents and surahs completed.
    func gains(since start: Date) -> PeriodGains {
        let before = Date(epochMilliseconds: start.epochMilliseconds - 1)
        return HistoryAnalytics.gains(from: before, to: clock(), current: records, events: database.events(since: before),
                                      index: index, policy: policy)
    }

    var weekStart: Date {
        let now = clock()
        return calendar.dateInterval(of: .weekOfYear, for: now)?.start ?? calendar.startOfDay(for: now)
    }

    var monthStart: Date {
        let now = clock()
        return calendar.dateInterval(of: .month, for: now)?.start ?? calendar.startOfDay(for: now)
    }

    /// Strict and learning percentages over time for a chart.
    func series(_ range: ProgressRange) -> [ProgressPoint] {
        let now = clock()
        let first: Date? = range == .all
            ? nil
            : HistoryAnalytics.sampleDates(range: range, now: now, firstEventAt: nil, calendar: calendar).first
        return HistoryAnalytics.series(range: range, now: now, current: records, events: database.events(since: first),
                                       index: index, policy: policy, calendar: calendar)
    }

    // MARK: Current position and completion

    private static let currentFromKey = "current_from"
    private static let currentToKey = "current_to"

    /// The range being learned now, shown on the dashboard.
    var currentPosition: (from: AyahKey, to: AyahKey)? {
        get {
            _ = version
            guard let from = database.meta(Self.currentFromKey).flatMap(AyahKey.init),
                  let to = database.meta(Self.currentToKey).flatMap(AyahKey.init) else { return nil }
            return (from, to)
        }
        set {
            database.setMeta(Self.currentFromKey, newValue?.from.description ?? "")
            database.setMeta(Self.currentToKey, newValue?.to.description ?? "")
            version += 1
        }
    }

    /// The first time every ayah was mastered; kept for good, never reset (memorization is not a khatma).
    var quranCompletedAt: Date? {
        _ = version
        return database.meta("quran_completed_at").flatMap(BackupCoding.date(from:))
    }

    private func recordCompletionIfNeeded(after: MemorizationSnapshot, now: Date) {
        guard after.totalAyahs > 0, after.counts[.mastered] == after.totalAyahs,
              database.meta("quran_completed_at").map(\.isEmpty) ?? true else { return }
        database.setMeta("quran_completed_at", BackupCoding.string(from: now))
    }

    // MARK: Milestones

    private static let seenKey = "milestones_seen"

    private func token(_ milestone: Milestone) -> String {
        switch milestone {
        case let .surahCompleted(number): "surah:\(number)"
        case let .juzCompleted(number): "juz:\(number)"
        case let .percent(value): "percent:\(value)"
        case .quranCompleted: "quran"
        }
    }

    /// Keeps only the milestones that were never reported, and remembers them.
    private func reportNew(_ milestones: [Milestone]) -> [Milestone] {
        guard !milestones.isEmpty else { return [] }
        var seen = Set((database.meta(Self.seenKey) ?? "").split(separator: ",").map(String.init))
        var fresh: [Milestone] = []
        for milestone in milestones where seen.insert(token(milestone)).inserted { fresh.append(milestone) }
        if !fresh.isEmpty { database.setMeta(Self.seenKey, seen.sorted().joined(separator: ",")) }
        return fresh
    }
}
