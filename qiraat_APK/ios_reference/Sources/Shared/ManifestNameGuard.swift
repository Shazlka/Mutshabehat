import Foundation

/// Names that come out of a backup manifest are joined onto a folder path. Anything that could climb out of that
/// folder is refused before a file is touched.
enum ManifestNameGuard {
    nonisolated static func isSafe(_ name: String) -> Bool {
        !name.isEmpty && !name.contains("..") && !name.hasPrefix("/") && !name.contains("\\")
    }
}
