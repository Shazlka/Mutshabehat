import Foundation

/// One gate for the work that reads or replaces the on-disk stores as a whole: a backup run (which snapshots the
/// database files from a background thread) and a restore (which closes a database, deletes its `-wal`/`-shm`
/// files and swaps it). They must never overlap, so both hold the gate for their whole duration. Waiters are
/// served in the order they arrived.
actor StoreMaintenanceGate {
    static let shared = StoreMaintenanceGate()

    private var busy = false
    private var waiters: [CheckedContinuation<Void, Never>] = []

    func acquire() async {
        if !busy {
            busy = true
            return
        }
        await withCheckedContinuation { waiters.append($0) }
    }

    func release() {
        if waiters.isEmpty {
            busy = false
        } else {
            // The gate stays busy and passes straight to the next waiter.
            waiters.removeFirst().resume()
        }
    }

    /// Runs `body` while holding the gate; `body` keeps the caller's isolation.
    nonisolated(nonsending) func hold<T>(_ body: () async throws -> T) async throws -> T {
        await acquire()
        do {
            let value = try await body()
            await release()
            return value
        } catch {
            await release()
            throw error
        }
    }
}

/// Names that come out of a backup manifest are joined onto a folder path. Anything that could climb out of that
/// folder is refused before a file is touched.
enum ManifestNameGuard {
    nonisolated static func isSafe(_ name: String) -> Bool {
        !name.isEmpty && !name.contains("..") && !name.hasPrefix("/") && !name.contains("\\")
    }
}

/// Which safety copies to delete: the newest two and the very first one are kept, so the first copy ever made
/// (usually the person's data before any restore) is never lost to pruning.
enum SafetyCopyRetention {
    nonisolated static let keptCount = 3

    /// `sortedNames` is oldest first.
    nonisolated static func namesToDelete(sortedNames: [String]) -> [String] {
        guard sortedNames.count > keptCount else { return [] }
        return Array(sortedNames[1..<(sortedNames.count - 2)])
    }
}
