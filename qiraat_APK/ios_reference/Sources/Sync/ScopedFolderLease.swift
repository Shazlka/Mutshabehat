import Foundation

/// One balanced security-scoped access to a folder picked in Files. `startAccessingSecurityScopedResource()` must be
/// paired with exactly one `stop…`; the lease starts the access when it is made, remembers whether the system granted
/// it, and stops it once: on `end()` or when it goes away.
final class ScopedFolderLease: @unchecked Sendable {
    let url: URL
    private let lock = NSLock()
    private var held: Bool

    init(url: URL) {
        self.url = url
        self.held = url.startAccessingSecurityScopedResource()
    }

    /// False when the system refused the access: the folder cannot be used and nothing needs to be stopped.
    var isActive: Bool {
        lock.lock()
        defer { lock.unlock() }
        return held
    }

    func end() {
        lock.lock()
        let wasHeld = held
        held = false
        lock.unlock()
        if wasHeld { url.stopAccessingSecurityScopedResource() }
    }

    deinit { end() }
}

/// A `.name.icloud` stand-in for a cloud file that is not on the device yet.
enum ICloudPlaceholder {
    /// The file the placeholder stands for (`ReadingDevices/.a.sqlite.icloud` → `ReadingDevices/a.sqlite`), or nil
    /// when `url` is not a placeholder. The download has to be requested for that file, not for the placeholder.
    nonisolated static func destination(of url: URL) -> URL? {
        let name = url.lastPathComponent
        guard name.hasPrefix("."), name.hasSuffix(".icloud"), name.count > ".icloud".count + 1 else { return nil }
        let original = String(name.dropFirst().dropLast(".icloud".count))
        return url.deletingLastPathComponent().appendingPathComponent(original)
    }
}
