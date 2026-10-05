import Foundation

/// One entry's worth of save steps. `initialRow` is the saved row the steps act on (nil for a create);
/// `placeholderId` names the optimistic row a create stands in for.
public struct SaveJob: Sendable, Identifiable {
    public let id: UUID
    public let plan: SaveJobPlan
    public let initialRow: ReviewRow?
    public let placeholderId: String?

    public init(plan: SaveJobPlan, initialRow: ReviewRow?, placeholderId: String? = nil) {
        self.id = UUID()
        self.plan = plan
        self.initialRow = initialRow
        self.placeholderId = placeholderId
    }
}

public enum QueueEvent: Sendable {
    case started(UUID)
    /// A step returned the server's row; a create also names the placeholder it replaces.
    case rowUpdated(jobId: UUID, row: ReviewRow, placeholderId: String?)
    case succeeded(UUID)
    /// The job stopped at step `resumeFrom`; `retry` continues from there, never repeating finished steps.
    case failed(UUID, ReviewError, resumeFrom: Int)
}

/// The background save queue of the review editor. Jobs sharing a `chainKey` (one entry, or one word for
/// creates) run one after another; others run in parallel. Before each step the executor receives the
/// newest row the queue knows for that entry, so a second quick edit never sends a stale version.
public actor ReviewQueue {
    public typealias Executor = @Sendable (SaveStep, ReviewRow?) async -> Result<ReviewRow, ReviewError>

    private struct State {
        let job: SaveJob
        var row: ReviewRow?
        var nextStep = 0
    }

    private let executor: Executor
    private var states: [UUID: State] = [:]
    private var failed: Set<UUID> = []
    private var tails: [String: Task<Void, Never>] = [:]
    private var latest: [String: ReviewRow] = [:]
    private var subscribers: [UUID: AsyncStream<QueueEvent>.Continuation] = [:]

    /// Jobs queued or running (a failed job is not pending: it waits for `retry` or `dismiss`).
    public private(set) var pending = 0

    public init(executor: @escaping Executor) { self.executor = executor }

    /// A fresh event stream; each consumer should subscribe before enqueueing so it misses nothing.
    public func subscribe() -> AsyncStream<QueueEvent> {
        let id = UUID()
        let (stream, continuation) = AsyncStream<QueueEvent>.makeStream()
        subscribers[id] = continuation
        continuation.onTermination = { [weak self] _ in Task { await self?.unsubscribe(id) } }
        return stream
    }

    private func unsubscribe(_ id: UUID) { subscribers[id] = nil }

    public func enqueue(_ job: SaveJob) {
        states[job.id] = State(job: job, row: job.initialRow)
        schedule(job.id)
    }

    public func retry(_ id: UUID) {
        guard failed.remove(id) != nil else { return }
        schedule(id)
    }

    public func dismiss(_ id: UUID) {
        failed.remove(id)
        states[id] = nil
    }

    private func emit(_ event: QueueEvent) { for continuation in subscribers.values { continuation.yield(event) } }

    private func schedule(_ id: UUID) {
        guard let key = states[id]?.job.plan.chainKey else { return }
        pending += 1
        let previous = tails[key]
        tails[key] = Task { [weak self] in
            await previous?.value
            await self?.run(id)
        }
    }

    private func run(_ id: UUID) async {
        guard var state = states[id] else { pending -= 1; return }
        emit(.started(id))
        let steps = state.job.plan.steps
        while state.nextStep < steps.count {
            let step = steps[state.nextStep]
            if let row = state.row, let fresh = latest[row.entryId] { state.row = fresh }
            if step == .approve, state.row?.reviewStatus == .reviewed { state.nextStep += 1; continue }
            switch await executor(step, state.row) {
            case .success(let row):
                state.row = row
                latest[row.entryId] = row
                state.nextStep += 1
                states[id] = state
                emit(.rowUpdated(jobId: id, row: row, placeholderId: state.job.placeholderId))
            case .failure(let error):
                states[id] = state
                failed.insert(id)
                pending -= 1
                emit(.failed(id, error, resumeFrom: state.nextStep))
                return
            }
        }
        states[id] = nil
        pending -= 1
        emit(.succeeded(id))
    }
}
