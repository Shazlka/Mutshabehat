import Foundation
import Testing
@testable import MushafCore

@Suite struct MemorizationMergeTests {
    private let t0 = Date(timeIntervalSince1970: 1_790_000_000)
    private func at(_ seconds: TimeInterval) -> Date { t0.addingTimeInterval(seconds) }

    private func record(_ surah: Int, _ ayah: Int, _ status: MemorizationStatus, updated: Date) -> AyahMemorizationRecord {
        var r = AyahMemorizationRecord.blank(AyahKey(surah: surah, ayah: ayah), now: updated)
        r.status = status
        return r
    }

    private func batch(_ id: UUID, created: Date, undone: Date? = nil) -> BatchRecord {
        BatchRecord(id: id, createdAt: created, kind: .update, label: "x", scopeJSON: "{}", ayahCount: 1, deviceID: "d",
                    countsForStreak: true, gainAyahs: 1, undoneAt: undone, undoesBatchID: nil)
    }

    private func event(_ batchID: UUID, _ surah: Int, _ ayah: Int, at time: Date) -> ChangeEvent {
        ChangeEvent(batchID: batchID, surah: surah, ayah: ayah, at: time, before: nil,
                    after: record(surah, ayah, .mastered, updated: time))
    }

    private func export(records: [AyahMemorizationRecord] = [], batches: [BatchRecord] = [], events: [ChangeEvent] = [],
                        goals: [GoalDefinition] = [], meta: [String: String] = [:], device: String = "local") -> MemorizationExport {
        MemorizationExport(formatVersion: 1, exportedAt: t0, deviceID: device, records: records, batches: batches,
                           events: events, goals: goals, meta: meta)
    }

    @Test func mergeKeepsNewerAyahRow() {
        let local = export(records: [record(1, 1, .needsMushaf, updated: at(10))])
        let incoming = export(records: [record(1, 1, .mastered, updated: at(20)), record(1, 2, .mastered, updated: at(5))])
        let merged = MemorizationMerge.merge(local: local, incoming: incoming)
        #expect(merged.records.count == 2)
        #expect(merged.records.first { $0.ayah == 1 }?.status == .mastered)
        #expect(merged.records.first { $0.ayah == 2 }?.status == .mastered)
    }

    @Test func mergeKeepsLocalRowWhenIncomingIsOlder() {
        let local = export(records: [record(1, 1, .mastered, updated: at(30))])
        let incoming = export(records: [record(1, 1, .needsMushaf, updated: at(10))])
        #expect(MemorizationMerge.merge(local: local, incoming: incoming).records.first?.status == .mastered)
    }

    @Test func mergeKeepsLocalOnTie() {
        let local = export(records: [record(1, 1, .memorizedWithErrors, updated: at(10))])
        let incoming = export(records: [record(1, 1, .mastered, updated: at(10))])
        #expect(MemorizationMerge.merge(local: local, incoming: incoming).records.first?.status == .memorizedWithErrors)
    }

    @Test func mergeUnionsBatchesAndEventsById() {
        let a = UUID(), b = UUID()
        let local = export(batches: [batch(a, created: at(1))], events: [event(a, 1, 1, at: at(1))])
        let incoming = export(batches: [batch(a, created: at(1)), batch(b, created: at(2))],
                              events: [event(a, 1, 1, at: at(1)), event(b, 1, 2, at: at(2))])
        let merged = MemorizationMerge.merge(local: local, incoming: incoming)
        #expect(Set(merged.batches.map(\.id)) == [a, b])
        #expect(merged.events.count == 2)
    }

    @Test func mergeKeepsUndoneFromEitherSide() {
        let id = UUID()
        let undone = at(50)
        let localUndone = MemorizationMerge.merge(local: export(batches: [batch(id, created: at(1), undone: undone)]),
                                                  incoming: export(batches: [batch(id, created: at(1))]))
        #expect(localUndone.batches.first?.undoneAt == undone)
        let incomingUndone = MemorizationMerge.merge(local: export(batches: [batch(id, created: at(1))]),
                                                     incoming: export(batches: [batch(id, created: at(1), undone: undone)]))
        #expect(incomingUndone.batches.first?.undoneAt == undone)
    }

    @Test func mergeUnionsGoalsById() {
        let g1 = GoalDefinition(id: UUID(), kind: .completeSurah(36), createdAt: t0)
        let g2 = GoalDefinition(id: UUID(), kind: .ayatPerDay(5), createdAt: t0)
        let merged = MemorizationMerge.merge(local: export(goals: [g1]), incoming: export(goals: [g1, g2]))
        #expect(Set(merged.goals.map(\.id)) == [g1.id, g2.id])
    }

    @Test func mergeMetaKeepsEarliestCompletionAndUnionsMilestones() {
        let local = export(meta: ["quran_completed_at": "2026-10-05T10:00:00.000Z", "milestones_seen": "surah:1,percent:25",
                                  "device_id": "local", "current_from": "2:1"])
        let incoming = export(meta: ["quran_completed_at": "2026-09-01T10:00:00.000Z", "milestones_seen": "percent:25,juz:30",
                                     "device_id": "other", "current_from": "3:1", "extra": "v"])
        let merged = MemorizationMerge.merge(local: local, incoming: incoming)
        #expect(merged.meta["quran_completed_at"] == "2026-09-01T10:00:00.000Z")
        #expect(Set(merged.meta["milestones_seen"]!.split(separator: ",").map(String.init)) == ["surah:1", "percent:25", "juz:30"])
        #expect(merged.meta["device_id"] == "local")
        #expect(merged.meta["current_from"] == "2:1")
        #expect(merged.meta["extra"] == "v")
        #expect(merged.deviceID == "local")
    }

    @Test func mergeIsIdempotent() {
        let a = UUID(), b = UUID()
        let local = export(records: [record(1, 1, .needsMushaf, updated: at(10)), record(2, 5, .mastered, updated: at(3))],
                           batches: [batch(a, created: at(1))], events: [event(a, 1, 1, at: at(1))],
                           meta: ["milestones_seen": "surah:1"])
        let incoming = export(records: [record(1, 1, .mastered, updated: at(20))],
                              batches: [batch(a, created: at(1), undone: at(40)), batch(b, created: at(2))],
                              events: [event(b, 1, 2, at: at(2))], meta: ["milestones_seen": "percent:25"])
        let once = MemorizationMerge.merge(local: local, incoming: incoming)
        let twice = MemorizationMerge.merge(local: local, incoming: once)
        #expect(once == twice)
        #expect(MemorizationMerge.merge(local: once, incoming: incoming) == once)
    }

    @Test func mergeOfEmptyIsEmpty() {
        let merged = MemorizationMerge.merge(local: export(), incoming: export())
        #expect(merged.records.isEmpty && merged.batches.isEmpty && merged.events.isEmpty && merged.goals.isEmpty)
    }
}
