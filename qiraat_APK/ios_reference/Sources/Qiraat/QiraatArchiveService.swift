import Foundation
import MushafCore

/// The whole Qiraat data set (catalog + 604 pages) as one archive: exported for a backup, installed into
/// Application Support on restore. The imported copy takes precedence over the bundled one (`MushafLibrary`).
enum QiraatBackupService {
    private struct Archive: Codable {
        let formatVersion: Int
        let files: [String: Data]
    }

    static let importedDirectory: URL = {
        let root = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return root.appendingPathComponent("QiraatImported", isDirectory: true)
    }()

    static func export(from store: QiraatStore) throws -> Data {
        var files: [String: Data] = [:]
        for name in requiredFilenames {
            files[name] = try Data(contentsOf: store.directory.appendingPathComponent(name))
        }
        return try JSONEncoder().encode(Archive(formatVersion: 1, files: files))
    }

    static func install(_ data: Data) throws -> QiraatStore {
        let archive = try JSONDecoder().decode(Archive.self, from: data)
        guard archive.formatVersion == 1, Set(archive.files.keys) == Set(requiredFilenames),
              archive.files.keys.allSatisfy(ManifestNameGuard.isSafe) else {
            throw BackupError.invalidQiraatArchive
        }

        let fileManager = FileManager.default
        let parent = importedDirectory.deletingLastPathComponent()
        try fileManager.createDirectory(at: parent, withIntermediateDirectories: true)
        let staging = parent.appendingPathComponent("QiraatImport-\(UUID().uuidString)", isDirectory: true)
        let previous = parent.appendingPathComponent("QiraatPrevious-\(UUID().uuidString)", isDirectory: true)
        try fileManager.createDirectory(at: staging, withIntermediateDirectories: true)

        do {
            for name in requiredFilenames {
                guard let contents = archive.files[name] else { throw BackupError.invalidQiraatArchive }
                try contents.write(to: staging.appendingPathComponent(name), options: .atomic)
            }
            _ = try QiraatStore(directory: staging)

            if fileManager.fileExists(atPath: importedDirectory.path) {
                try fileManager.moveItem(at: importedDirectory, to: previous)
            }
            do {
                try fileManager.moveItem(at: staging, to: importedDirectory)
                let store = try QiraatStore(directory: importedDirectory)
                try? fileManager.removeItem(at: previous)
                return store
            } catch {
                if fileManager.fileExists(atPath: previous.path) {
                    try? fileManager.moveItem(at: previous, to: importedDirectory)
                }
                throw error
            }
        } catch {
            try? fileManager.removeItem(at: staging)
            throw error
        }
    }

    private static var requiredFilenames: [String] {
        ["catalog.json"] + (1...604).map { String(format: "page-%03d.json", $0) }
    }

    enum BackupError: LocalizedError {
        case invalidQiraatArchive

        var errorDescription: String? { appLocalized("الملف ليس نسخة قراءات صالحة") }
    }
}
