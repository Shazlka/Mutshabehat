#if DEBUG
import Foundation
import MushafCore

/// Deterministic data for UI tests, applied through the real store so history and undo work as usual.
@MainActor
enum MemorizationSeed {
    static func apply(_ name: String, to store: MemorizationStore) {
        switch name {
        case "demo":
            let steps: [(MemorizationSelection, MemorizationStatus, Bool?)] = [
                (.surah(1), .mastered, nil),
                (.ayahRange(surah: 2, from: 1, to: 20), .mastered, nil),
                (.ayahRange(surah: 2, from: 21, to: 35), .memorizedWithErrors, nil),
                (.ayahRange(surah: 2, from: 36, to: 50), .needsMushaf, nil),
                (.surah(36), .needsMushaf, true)
            ]
            for (selection, status, learning) in steps {
                _ = try? store.update(selection, label: "seed", status: status, learning: learning)
            }
        case "complete":
            let keys = store.index.ayahKeys
            if let first = keys.first, let last = keys.last {
                _ = try? store.update(.span(from: first, to: last), label: "seed", status: .mastered)
            }
        default:
            break
        }
    }
}
#endif
