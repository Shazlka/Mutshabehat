import Foundation
import MushafCore

// TEMPORARY: compile-time stand-in for Task 9's database API; deleted when the real implementation merges.
public enum MemorizationError: LocalizedError, Equatable {
    case alreadyUndone, notFound, notUndoable, nothingToApply, hasNewerChanges([BatchRecord]), writeFailed(String)
}

extension MemorizationDatabase {
    public func apply(_ plan: BatchPlan, now: Date) throws -> BatchRecord { fatalError("shim") }
    public func batches(limit: Int, offset: Int) -> [BatchRecord] { [] }
    public func batch(id: UUID) -> BatchRecord? { nil }
    public func events(since: Date?) -> [ChangeEvent] { [] }
    public func events(batchID: UUID) -> [ChangeEvent] { [] }
    public func undoConflicts(batchID: UUID) -> [BatchRecord] { [] }
    public func undo(batchID: UUID, force: Bool, now: Date) throws -> BatchRecord { fatalError("shim") }
    public func qualifyingDays(calendar: Calendar) -> Set<Date> { [] }
    public func exportAll(now: Date) -> MemorizationExport { fatalError("shim") }
    public func replaceAll(with export: MemorizationExport) throws {}
    public func merge(_ incoming: MemorizationExport, now: Date) throws {}
    public func goals() -> [GoalDefinition] { [] }
    public func saveGoal(_ goal: GoalDefinition) throws {}
    public func deleteGoal(id: UUID) {}
}
