import Foundation

public enum GoalKind: Codable, Equatable, Sendable {
    case ayatPerDay(Int)
    case pageEquivalentsPerWeek(Double)
    case completeSurah(Int)
    case completeJuz(Int)
    case completeQuranBy(Date)
}

/// An optional memorization goal. Only the definition is stored; progress is always derived.
public struct GoalDefinition: Codable, Equatable, Sendable {
    public var id: UUID
    public var kind: GoalKind
    public var createdAt: Date

    public init(id: UUID, kind: GoalKind, createdAt: Date) {
        self.id = id
        self.kind = kind
        self.createdAt = createdAt
    }
}

public enum MemorizationExportError: LocalizedError, Equatable {
    case newerFormat(Int)
    case corrupt

    public var errorDescription: String? {
        switch self {
        case let .newerFormat(version): "الملف من إصدار أحدث من التطبيق (\(version)). حدّث التطبيق ثم أعد المحاولة."
        case .corrupt: "الملف تالف أو غير مكتمل."
        }
    }
}

/// Everything memorization stores, as one versioned, human-readable document. It is the manual export
/// file and the memorization part of every backup set.
public struct MemorizationExport: Codable, Equatable, Sendable {
    public static let currentFormatVersion = 1

    public var formatVersion: Int
    public var exportedAt: Date
    public var deviceID: String
    public var records: [AyahMemorizationRecord]
    public var batches: [BatchRecord]
    public var events: [ChangeEvent]
    public var goals: [GoalDefinition]
    public var meta: [String: String]

    public init(formatVersion: Int = MemorizationExport.currentFormatVersion, exportedAt: Date, deviceID: String,
                records: [AyahMemorizationRecord], batches: [BatchRecord], events: [ChangeEvent],
                goals: [GoalDefinition], meta: [String: String]) {
        self.formatVersion = formatVersion
        self.exportedAt = exportedAt
        self.deviceID = deviceID
        self.records = records
        self.batches = batches
        self.events = events
        self.goals = goals
        self.meta = meta
    }

    public func encode() throws -> Data {
        try BackupCoding.encoder().encode(self)
    }

    /// Refuses a newer format and anything that is not a complete document of this one.
    public static func decode(_ data: Data) throws -> MemorizationExport {
        struct Header: Decodable { let formatVersion: Int }
        guard let header = try? JSONDecoder().decode(Header.self, from: data) else { throw MemorizationExportError.corrupt }
        if header.formatVersion > currentFormatVersion { throw MemorizationExportError.newerFormat(header.formatVersion) }
        do { return try BackupCoding.decoder().decode(MemorizationExport.self, from: data) } catch {
            throw MemorizationExportError.corrupt
        }
    }
}

public enum MemorizationMerge {
    /// Merges `incoming` into `local`: per ayah the newer `updatedAt` wins (a tie keeps local); batches,
    /// events and goals are unioned by id; a batch undone on either side stays undone; the earliest
    /// completion date and the union of seen milestones are kept; every other local setting wins.
    /// The result is deterministic, so merging the same data twice changes nothing.
    public static func merge(local: MemorizationExport, incoming: MemorizationExport) -> MemorizationExport {
        var records: [AyahKey: AyahMemorizationRecord] = Dictionary(uniqueKeysWithValues: local.records.map { ($0.key, $0) })
        for record in incoming.records {
            if let existing = records[record.key], existing.updatedAt >= record.updatedAt { continue }
            records[record.key] = record
        }

        var batches: [UUID: BatchRecord] = Dictionary(uniqueKeysWithValues: local.batches.map { ($0.id, $0) })
        for batch in incoming.batches {
            if let existing = batches[batch.id] {
                if existing.undoneAt == nil, batch.undoneAt != nil { batches[batch.id] = batch }
            } else {
                batches[batch.id] = batch
            }
        }

        func eventKey(_ event: ChangeEvent) -> String { "\(event.batchID.uuidString)|\(event.surah)|\(event.ayah)" }
        var events: [String: ChangeEvent] = [:]
        for event in local.events { events[eventKey(event)] = event }
        for event in incoming.events where events[eventKey(event)] == nil { events[eventKey(event)] = event }

        var goals: [UUID: GoalDefinition] = Dictionary(uniqueKeysWithValues: local.goals.map { ($0.id, $0) })
        for goal in incoming.goals where goals[goal.id] == nil { goals[goal.id] = goal }

        var meta = local.meta
        for (key, value) in incoming.meta {
            switch key {
            case "device_id":
                continue
            case "quran_completed_at":
                meta[key] = meta[key].map { min($0, value) } ?? value
            case "milestones_seen":
                let union = Set((meta[key] ?? "").split(separator: ",").map(String.init))
                    .union(value.split(separator: ",").map(String.init))
                meta[key] = union.sorted().joined(separator: ",")
            default:
                if meta[key] == nil { meta[key] = value }
            }
        }

        return MemorizationExport(
            formatVersion: MemorizationExport.currentFormatVersion,
            exportedAt: max(local.exportedAt, incoming.exportedAt),
            deviceID: local.deviceID,
            records: records.values.sorted { ($0.surah, $0.ayah) < ($1.surah, $1.ayah) },
            batches: batches.values.sorted { ($0.createdAt, $0.id.uuidString) < ($1.createdAt, $1.id.uuidString) },
            events: events.values.sorted {
                ($0.at, $0.batchID.uuidString, $0.surah, $0.ayah) < ($1.at, $1.batchID.uuidString, $1.surah, $1.ayah)
            },
            goals: goals.values.sorted { ($0.createdAt, $0.id.uuidString) < ($1.createdAt, $1.id.uuidString) },
            meta: meta)
    }
}
