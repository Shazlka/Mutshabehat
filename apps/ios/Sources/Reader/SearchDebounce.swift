import Foundation

/// How long typing must pause before a search runs.
enum SearchDebounce {
    static let interval: Duration = .milliseconds(250)
}

/// Runs the latest scheduled piece of work after a pause and drops the ones scheduled before it, so a search field
/// that fires on every keystroke starts one search per pause, not one per letter.
@MainActor
final class Debouncer {
    private var task: Task<Void, Never>?

    /// Replaces any work still waiting (or running) with `work`, which starts after `delay` unless replaced again.
    func schedule(after delay: Duration = SearchDebounce.interval, _ work: @escaping @MainActor () async -> Void) {
        task?.cancel()
        task = Task { @MainActor in
            do { try await Task.sleep(for: delay) } catch { return }
            guard !Task.isCancelled else { return }
            await work()
        }
    }

    func cancel() {
        task?.cancel()
        task = nil
    }
}

/// Says "run" the first time it sees a key and each time the key changes, "skip" for a repeat; `reset` makes the next
/// key run again. For work that several setters ask for in one pass but that needs doing once per state.
struct ChangeGate<Key: Equatable> {
    private var last: Key?

    mutating func shouldRun(_ key: Key) -> Bool {
        if last == key { return false }
        last = key
        return true
    }

    mutating func reset() { last = nil }
}

/// Remembers one computed value together with the key it was computed for, and hands it back only for that key.
/// A view that cannot write state while it draws reads it with `value(for:)` and refreshes it with `store` from a
/// handler, so a stale value is never shown: a different key is a miss.
struct KeyedCache<Key: Equatable, Value> {
    private var entry: (key: Key, value: Value)?

    func value(for key: Key) -> Value? {
        guard let entry, entry.key == key else { return nil }
        return entry.value
    }

    mutating func store(_ value: Value, for key: Key) { entry = (key, value) }

    mutating func clear() { entry = nil }
}
