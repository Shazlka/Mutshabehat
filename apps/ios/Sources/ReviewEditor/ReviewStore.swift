#if DEBUG
import Foundation
import MushafCore
import Observation

/// The one object the developer review editor's views bind to: the page being reviewed, the selection, the
/// optimistic rows and the background save queue. Every write goes through `ReviewAPI` (the web app's own
/// review API), one queued job per entry, so the server's rules and edit log apply unchanged.
@MainActor
@Observable
final class ReviewStore {
    enum LoadState: Equatable { case idle, loading, failed(String) }
    enum SaveStatus: Equatable { case idle, saving(Int), saved(Date), failed(String) }

    struct SaveFailure: Identifiable, Equatable {
        let id: UUID
        let label: String
        let message: String
    }

    // MARK: State

    private(set) var pageNumber = 1
    private(set) var page: ReviewPage? {
        didSet { statuses = page.map(ReviewNavigation.wordStatuses(in:)) ?? [:] }
    }
    private(set) var mushaf: MushafPage?
    private(set) var keyIndex: [String: MushafWord] = [:]
    private(set) var statuses: [String: WordStatus] = [:]
    private(set) var overview: ReviewOverview?
    private(set) var loadState: LoadState = .idle
    private(set) var saveStatus: SaveStatus = .idle
    private(set) var failures: [SaveFailure] = []
    /// A short message to show once (a guard or a refused action); the view clears it.
    var notice: String?
    /// The face just deleted, so the sheet can offer «تراجع».
    var lastDeleted: ReviewRow?

    var selectedKey: String?
    /// The end of a two-word span, when the reviewer linked the next word.
    var spanEndKey: String?

    /// The face being edited (an existing row or a new entry for the selected word).
    struct EditSession: Equatable {
        var draft: ReviewDraftFields
        var original: ReviewDraftFields
        var rowId: String?
        var newEntry: CreateEntryInput?
    }
    var session: EditSession?
    /// A move (word, page or closing the sheet) the reviewer asked for while edits are unsaved; it waits for
    /// a confirmation.
    var pendingSelection: String?
    var pendingPage: Int?
    var pendingClose = false
    /// The part of a reference's suggestion that was not applied; offered as a tap-to-apply chip.
    var pendingSuggestion: ReferenceSuggestion?

    // MARK: Plumbing

    @ObservationIgnored let api: ReviewAPI
    @ObservationIgnored private let queue: ReviewQueue
    @ObservationIgnored private let mushafPage: (Int) -> MushafPage?
    @ObservationIgnored private let liveRefresh: (Int) -> Void
    @ObservationIgnored private var subscription: Task<Void, Never>?
    @ObservationIgnored private var jobs: [UUID: JobInfo] = [:]
    @ObservationIgnored private var pending = 0
    @ObservationIgnored private var settling = false
    @ObservationIgnored private var savedSinceIdle = false
    @ObservationIgnored private var overviewTask: Task<Void, Never>?
    @ObservationIgnored private var tempCounter = 0

    private struct JobInfo {
        let label: String
        /// Puts the optimistic change back before a retry.
        let redo: () -> Void
    }

    init(api: ReviewAPI, mushafPage: @escaping (Int) -> MushafPage?, liveRefresh: @escaping (Int) -> Void) {
        self.api = api
        self.mushafPage = mushafPage
        self.liveRefresh = liveRefresh
        queue = ReviewQueue { step, row in await ReviewStore.execute(step, row: row, api: api) }
        let subscribed = Task { [queue] in await queue.subscribe() }
        self.subscribed = subscribed
        subscription = Task { [weak self] in
            for await event in await subscribed.value { self?.handle(event) }
        }
    }

    /// Resolves once the store listens to the queue, so no event of the first job is missed.
    @ObservationIgnored private var subscribed: Task<AsyncStream<QueueEvent>, Never>?

    deinit { subscription?.cancel() }

    /// Runs one queue step against the web API. A create has no row; every other step needs the saved row.
    nonisolated private static func execute(_ step: SaveStep, row: ReviewRow?, api: ReviewAPI) async -> Result<ReviewRow, ReviewError> {
        if case .create(let entry) = step { return await api.create(entry) }
        guard let row else { return .failure(ReviewError(code: .badRequest, status: 0)) }
        switch step {
        case .create: return .failure(ReviewError(code: .badRequest, status: 0))
        case .update(let fields): return await api.update(row, fields)
        case .setNarrators(let narrators): return await api.setNarrators(row, narrators)
        case .setStatus(let status, let note): return await api.setStatus(row, status, note: note)
        case .approve: return await api.setStatus(row, .reviewed, note: nil)
        case .delete(let note): return await api.delete(row, note: note)
        case .restore: return await api.restore(row)
        }
    }

    // MARK: Loading

    func load(page number: Int) async {
        let target = min(mushafPageCount, max(1, number))
        let changed = target != pageNumber
        pageNumber = target
        if changed { selectedKey = nil; spanEndKey = nil }
        loadState = .loading
        switch await api.page(target, includeDeleted: true) {
        case .success(let loaded):
            guard target == pageNumber else { return }
            page = loaded
            mushaf = mushafPage(target)
            keyIndex = mushaf.map(ReviewWordKeys.index(page:)) ?? [:]
            loadState = .idle
        case .failure(let error):
            guard target == pageNumber else { return }
            loadState = .failed(error.messageAr)
        }
        await loadOverview()
    }

    func loadOverview() async {
        if case .success(let value) = await api.overview() { overview = value }
    }

    /// Re-reads the current page without blanking it; skipped while saves are still in flight.
    func reloadSilent() async {
        guard pending == 0 else { return }
        let target = pageNumber
        if case .success(let loaded) = await api.page(target, includeDeleted: true), target == pageNumber, pending == 0 {
            page = loaded
        }
    }

    private func scheduleOverviewRefresh() {
        overviewTask?.cancel()
        overviewTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(1))
            guard !Task.isCancelled else { return }
            await self?.loadOverview()
        }
    }

    // MARK: Reading the page

    func rows(forKey key: String) -> [ReviewRow] {
        (page?.rows ?? []).filter { $0.isActive && $0.startKey <= key && key <= $0.endKey }
            .sorted { ($0.entryOrder, $0.entryId) < ($1.entryOrder, $1.entryId) }
    }

    func status(forKey key: String) -> WordStatus? { statuses[key] }

    func word(forKey key: String) -> ReviewWord? { page?.words.first { $0.key == key } }

    func nextReviewKey(after key: String?) -> String? {
        page.flatMap { ReviewNavigation.nextReviewKey(in: $0, after: key) }
    }

    func nextPageNeedingReview() -> Int? {
        overview.flatMap { ReviewNavigation.nextPage(in: $0, after: pageNumber, needing: .unreviewed) }
    }

    func nextFlaggedPage() -> Int? {
        overview.flatMap { ReviewNavigation.nextPage(in: $0, after: pageNumber, needing: .flagged) }
    }

    /// Moves the selection and drops any edit session (the guard against losing edits is `requestSelect`).
    func select(key: String?, extendingSpan: Bool = false) {
        if extendingSpan, let anchor = selectedKey, let key, key != anchor { spanEndKey = key; return }
        selectedKey = key
        spanEndKey = nil
        session = nil
        pendingSuggestion = nil
    }

    // MARK: Saving

    func upsert(_ row: ReviewRow, replacing placeholder: String? = nil) {
        guard var current = page else { return }
        ReviewPageEditing.upsert(row, replacing: placeholder, into: &current)
        page = current
    }

    /// Refuses edits of a row whose first save has not finished (its id is still a placeholder).
    func canEdit(_ row: ReviewRow) -> Bool {
        if ReviewPageEditing.isPlaceholder(row) {
            notice = "هذا الوجه ما زال قيد الحفظ — انتظر لحظة ثم أعد المحاولة"
            return false
        }
        return true
    }

    /// Applies `redo` (the optimistic change) now and runs `plan` in the background.
    func submit(_ plan: SaveJobPlan, row: ReviewRow?, placeholderId: String? = nil, redo: @escaping () -> Void) {
        let job = SaveJob(plan: plan, initialRow: row, placeholderId: placeholderId)
        jobs[job.id] = JobInfo(label: plan.label, redo: redo)
        pending += 1
        saveStatus = .saving(pending)
        redo()
        Task { [queue, subscribed] in
            _ = await subscribed?.value
            await queue.enqueue(job)
        }
    }

    func approve(_ row: ReviewRow) {
        guard canEdit(row) else { return }
        var optimistic = row
        optimistic.reviewStatus = .reviewed
        optimistic.locationReviewStatus = .reviewed
        submit(SaveJobPlan(label: "اعتماد", chainKey: "entry:\(row.entryId)", steps: [.approve]), row: row) { [weak self] in
            self?.upsert(optimistic)
        }
    }

    func flag(_ row: ReviewRow, note: String?) {
        guard canEdit(row) else { return }
        var optimistic = row
        optimistic.reviewStatus = .flagged
        submit(SaveJobPlan(label: "تعليم", chainKey: "entry:\(row.entryId)", steps: [.setStatus(.flagged, note: note)]), row: row) { [weak self] in
            self?.upsert(optimistic)
        }
    }

    func delete(_ row: ReviewRow) {
        guard canEdit(row) else { return }
        lastDeleted = row
        var optimistic = row
        optimistic.deleted = true
        submit(SaveJobPlan(label: "حذف", chainKey: "entry:\(row.entryId)", steps: [.delete(note: nil)]), row: row) { [weak self] in
            self?.upsert(optimistic)
        }
    }

    func restore(_ row: ReviewRow) {
        guard canEdit(row) else { return }
        if lastDeleted?.entryId == row.entryId { lastDeleted = nil }
        var optimistic = row
        optimistic.deleted = false
        submit(SaveJobPlan(label: "استرجاع", chainKey: "entry:\(row.entryId)", steps: [.restore]), row: row) { [weak self] in
            self?.upsert(optimistic)
        }
    }

    func nextTempId() -> String {
        tempCounter += 1
        return "\(ReviewPageEditing.placeholderPrefix)\(tempCounter)"
    }

    func retry(_ failure: SaveFailure) {
        guard jobs[failure.id] != nil else { return }
        failures.removeAll { $0.id == failure.id }
        jobs[failure.id]?.redo()
        pending += 1
        saveStatus = .saving(pending)
        Task { [queue] in await queue.retry(failure.id) }
    }

    func dismiss(_ failure: SaveFailure) {
        failures.removeAll { $0.id == failure.id }
        jobs[failure.id] = nil
        Task { [queue] in await queue.dismiss(failure.id) }
    }

    // MARK: Queue events

    private func handle(_ event: QueueEvent) {
        switch event {
        case .started: break
        case .rowUpdated(_, let row, let placeholder):
            if row.page == 0 || row.page == pageNumber { upsert(row, replacing: placeholder) }
        case .succeeded(let id):
            jobs[id] = nil
            pending -= 1
            savedSinceIdle = true
            saveStatus = pending > 0 ? .saving(pending) : .saved(Date())
            settleIfIdle()
        case .failed(let id, let error, _):
            pending -= 1
            let label = jobs[id]?.label ?? "حفظ"
            failures.append(SaveFailure(id: id, label: label, message: error.messageAr))
            saveStatus = pending > 0 ? .saving(pending) : .failed(error.messageAr)
            settleIfIdle()
        }
    }

    /// Once the queue is empty, reconcile with the server in the background and let the reader redraw.
    private func settleIfIdle() {
        guard pending == 0 else { return }
        settling = true
        let refreshReader = savedSinceIdle
        savedSinceIdle = false
        Task { [weak self] in
            guard let self else { return }
            await reloadSilent()
            if refreshReader { liveRefresh(pageNumber) }
            scheduleOverviewRefresh()
            settling = false
        }
    }

    /// Waits until saves and the follow-up re-read are finished (used by tests and UI hooks).
    func waitUntilIdle(timeout: Duration = .seconds(10)) async {
        let deadline = ContinuousClock.now.advanced(by: timeout)
        while (pending > 0 || settling) && ContinuousClock.now < deadline {
            try? await Task.sleep(for: .milliseconds(10))
        }
    }
}
#endif
