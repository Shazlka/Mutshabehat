import Foundation
import Testing
@testable import MushafCore

/// Records every executor call and answers from a script.
private actor Script {
    struct Call: Equatable { let step: SaveStep; let version: String?; let entryId: String? }
    private(set) var calls: [Call] = []
    private var counter = 0
    private var failures: Set<Int> = []        // 0-based call numbers that fail once
    private var gates: [String: CheckedContinuation<Void, Never>] = [:]
    private var released: Set<String> = []
    private var startedKeys: [String] = []

    func failCall(_ n: Int) { failures.insert(n) }

    func run(_ step: SaveStep, _ row: ReviewRow?, createdId: String = "r-new") async -> Result<ReviewRow, ReviewError> {
        let n = counter
        counter += 1
        calls.append(Call(step: step, version: row?.version, entryId: row?.entryId))
        startedKeys.append(row?.entryId ?? "new")
        if failures.contains(n) { failures.remove(n); return .failure(ReviewError(code: .unavailable, status: 0)) }
        let id = row?.entryId ?? createdId
        return .success(Self.row(id: id, version: "v\(n + 1)", status: { if case .setStatus(let s, _) = step { s } else { row?.reviewStatus ?? .unreviewed }}()))
    }

    /// Blocks the caller until `open(key)` is called (a rendezvous used to prove two chains overlap).
    func wait(_ key: String) async {
        if released.contains(key) { return }
        await withCheckedContinuation { gates[key] = $0 }
    }
    func open(_ key: String) { released.insert(key); gates.removeValue(forKey: key)?.resume() }
    func started(_ key: String) -> Bool { startedKeys.contains(key) }

    static func row(id: String, version: String, status: ReviewStatus = .unreviewed) -> ReviewRow {
        try! JSONDecoder().decode(ReviewRow.self, from: Data("""
        {"entryId":"\(id)","locationId":"l","version":"\(version)","kind":"usul","surah":2,"ayah":1,"startWord":1,
         "reviewStatus":"\(status.rawValue)","narrators":[],"flags":[]}
        """.utf8))
    }
}

@Suite struct ReviewQueueTests {
    private func job(_ key: String, _ steps: [SaveStep], row: ReviewRow?) -> SaveJob {
        SaveJob(plan: SaveJobPlan(label: "x", chainKey: key, steps: steps), initialRow: row)
    }

    /// Waits for the next terminal event of `id`.
    private func finish(_ events: AsyncStream<QueueEvent>, _ ids: Set<UUID>) async -> [UUID: QueueEvent] {
        var done: [UUID: QueueEvent] = [:]
        for await event in events {
            switch event {
            case .succeeded(let id), .failed(let id, _, _):
                done[id] = event
                if done.count == ids.count { return done }
            default: continue
            }
        }
        return done
    }

    @Test func sameEntryJobsRunInOrderWithFreshVersion() async throws {
        let script = Script()
        let queue = ReviewQueue { step, row in await script.run(step, row) }
        let base = Script.row(id: "r-1", version: "v0")
        let a = job("entry:r-1", [.setStatus(.reviewed, note: nil)], row: base)
        let b = job("entry:r-1", [.update(EntryFields())], row: base)   // enqueued with the SAME stale row
        let events = await queue.subscribe()
        await queue.enqueue(a)
        await queue.enqueue(b)
        _ = await finish(events, [a.id, b.id])
        let calls = await script.calls
        #expect(calls.count == 2)
        #expect(calls[0].version == "v0")
        #expect(calls[1].version == "v1")      // the version the first step returned, not the stale one
        #expect(calls[1].step == .update(EntryFields()))
    }

    @Test func differentEntriesRunConcurrently() async throws {
        let script = Script()
        // Entry A blocks until entry B has started: only possible if the two chains overlap.
        let queue = ReviewQueue { step, row in
            if row?.entryId == "r-A" { await script.wait("B-started") }
            let result = await script.run(step, row)
            if row?.entryId == "r-B" { await script.open("B-started") }
            return result
        }
        let a = job("entry:r-A", [.approve], row: Script.row(id: "r-A", version: "v0"))
        let b = job("entry:r-B", [.approve], row: Script.row(id: "r-B", version: "v0"))
        let events = await queue.subscribe()
        await queue.enqueue(a)
        await queue.enqueue(b)
        let done = await finish(events, [a.id, b.id])
        #expect(done.count == 2)
        for event in done.values { if case .failed = event { Issue.record("job failed") } }
    }

    @Test func failureReportsResumeIndexAndRetryContinuesFromIt() async throws {
        let script = Script()
        await script.failCall(1)                     // the update after the create fails once
        let queue = ReviewQueue { step, row in await script.run(step, row) }
        let entry = CreateEntryInput(surah: 2, ayah: 1, startWord: 1, kind: .usul, categoryCode: "USUL_NAQL", narrators: [])
        let j = job("loc:2:1:1", [.create(entry), .update(EntryFields()), .approve], row: nil)
        let firstEvents = await queue.subscribe()
        await queue.enqueue(j)
        let first = await finish(firstEvents, [j.id])
        guard case .failed(_, let error, let resume) = try #require(first[j.id]) else { Issue.record("expected failure"); return }
        #expect(error.code == .unavailable)
        #expect(resume == 1)
        #expect(await queue.pending == 0)

        let secondEvents = await queue.subscribe()
        await queue.retry(j.id)
        let second = await finish(secondEvents, [j.id])
        guard case .succeeded = try #require(second[j.id]) else { Issue.record("expected success"); return }
        let calls = await script.calls
        #expect(calls.filter { if case .create = $0.step { true } else { false } }.count == 1)   // never duplicated
        #expect(calls.count == 4)       // create, failed update, update again, approve
        #expect(calls[2].entryId == "r-new")           // the retry works on the row the create returned
    }

    @Test func approveIsSkippedWhenTheSavedRowIsAlreadyReviewed() async throws {
        let script = Script()
        let queue = ReviewQueue { step, row in await script.run(step, row) }
        let j = job("entry:r-1", [.approve], row: Script.row(id: "r-1", version: "v0", status: .reviewed))
        let events = await queue.subscribe()
        await queue.enqueue(j)
        _ = await finish(events, [j.id])
        #expect(await script.calls.isEmpty)
    }

    @Test func rowUpdatedEventsCarryTheServerRowAndPlaceholder() async throws {
        let script = Script()
        let queue = ReviewQueue { step, row in await script.run(step, row, createdId: "r-server") }
        let entry = CreateEntryInput(surah: 2, ayah: 1, startWord: 1, kind: .usul, categoryCode: "USUL_NAQL", narrators: [])
        let j = SaveJob(plan: SaveJobPlan(label: "x", chainKey: "loc:2:1:1", steps: [.create(entry)]), initialRow: nil, placeholderId: "tmp-1")
        let events = await queue.subscribe()
        await queue.enqueue(j)
        var updated: (ReviewRow, String?)?
        for await event in events {
            if case .rowUpdated(_, let row, let placeholder) = event { updated = (row, placeholder) }
            if case .succeeded = event { break }
        }
        #expect(updated?.0.entryId == "r-server")
        #expect(updated?.1 == "tmp-1")
    }

    @Test func pendingCountsQueuedAndRunningJobs() async throws {
        let script = Script()
        let queue = ReviewQueue { step, row in
            await script.wait("go")
            return await script.run(step, row)
        }
        let a = job("entry:r-1", [.approve], row: Script.row(id: "r-1", version: "v0"))
        let b = job("entry:r-1", [.approve], row: Script.row(id: "r-1", version: "v0"))
        let events = await queue.subscribe()
        await queue.enqueue(a)
        await queue.enqueue(b)
        #expect(await queue.pending == 2)
        await script.open("go")
        _ = await finish(events, [a.id, b.id])
        #expect(await queue.pending == 0)
    }
}
