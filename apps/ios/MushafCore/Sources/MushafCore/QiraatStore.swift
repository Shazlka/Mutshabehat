import Foundation

/// Reads the bundled snapshot of the web app's Qiraat data (Generated/Qiraat: catalog.json and
/// page-001.json … page-604.json, written by scripts/fetch_qiraat.py) and keeps recent pages decoded.
/// A page that is missing or does not decode is nil: that page shows no Qiraat marks, nothing more.
/// `@unchecked Sendable`: the catalog is immutable and the cache is only touched under `lock`.
public final class QiraatStore: @unchecked Sendable {
    public enum Failure: Error, Equatable { case missingCatalog, unreadableCatalog(String) }

    public let directory: URL
    public let catalog: QiraatCatalog
    private let capacity: Int
    private let lock = NSLock()
    private var pages: [Int: QiraatPageData?] = [:]
    /// Least recently used first.
    private var order: [Int] = []

    public init(directory: URL, capacity: Int = 16) throws {
        self.directory = directory
        self.capacity = capacity
        guard let data = try? Data(contentsOf: directory.appendingPathComponent("catalog.json")) else {
            throw Failure.missingCatalog
        }
        do {
            catalog = try JSONDecoder().decode(QiraatCatalog.self, from: data)
        } catch {
            throw Failure.unreadableCatalog(String(describing: error))
        }
    }

    public func fileURL(page: Int) -> URL {
        directory.appendingPathComponent(String(format: "page-%03d.json", page))
    }

    public func page(_ number: Int) -> QiraatPageData? {
        guard (1...mushafPageCount).contains(number) else { return nil }
        if let hit = lock.withLock({ () -> QiraatPageData?? in
            guard let cached = pages[number] else { return nil }
            touch(number)
            return .some(cached)
        }) { return hit }

        let decoded = (try? Data(contentsOf: fileURL(page: number)))
            .flatMap { try? JSONDecoder().decode(QiraatPageData.self, from: $0) }
            .flatMap { $0.pageNumber == number ? $0 : nil }
        lock.withLock {
            pages[number] = .some(decoded)
            touch(number)
            while order.count > capacity { pages[order.removeFirst()] = nil }
        }
        return decoded
    }

    public func marks(page number: Int) -> QiraatMarks? {
        page(number).map { QiraatMarks(catalog: catalog, page: $0) }
    }

    /// Call with `lock` held.
    private func touch(_ number: Int) {
        order.removeAll { $0 == number }
        order.append(number)
    }
}
