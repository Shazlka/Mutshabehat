import Foundation

/// The launch-argument hooks the UI tests use (`-page`, `-show-chrome`, `-open-…`). They exist in DEBUG builds only: a
/// Release build ignores every one of them, so a launch argument cannot move or open anything in a shipped app.
enum LaunchHooks {
#if DEBUG
    static func has(_ flag: String) -> Bool { CommandLine.arguments.contains(flag) }

    static func intValue(after flag: String) -> Int? {
        guard let idx = CommandLine.arguments.firstIndex(of: flag),
              CommandLine.arguments.indices.contains(idx + 1) else { return nil }
        return Int(CommandLine.arguments[idx + 1])
    }
#else
    static func has(_ flag: String) -> Bool { false }
    static func intValue(after flag: String) -> Int? { nil }
#endif
}
