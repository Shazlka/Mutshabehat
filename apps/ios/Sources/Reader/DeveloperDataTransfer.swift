import CoreTransferable
import Foundation
import MushafCore
import SwiftUI
import UniformTypeIdentifiers

struct DatabaseTransferItem: Transferable, Sendable {
    let data: Data

    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(exportedContentType: .data) { item in
            item.data
        }
    }
}

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
        guard archive.formatVersion == 1, Set(archive.files.keys) == Set(requiredFilenames) else {
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

        var errorDescription: String? { "الملف ليس نسخة قراءات صالحة" }
    }
}

#if DEBUG
struct DeveloperDataSettingsView: View {
    let library: MushafLibrary
    let language: AppLanguage

    @State private var exportItem: DatabaseTransferItem?
    @State private var exportFilename = ""
    @State private var isExporting = false
    @State private var importTarget: ImportTarget?
    @State private var isImporting = false
    @State private var message = ""
    @State private var showsMessage = false

    var body: some View {
        Form {
            Section {
                Button {
                    prepareQiraatExport()
                } label: {
                    Label(copy("تصدير قاعدة القراءات إلى الملفات", "Export Qiraat database to Files"),
                          systemImage: "icloud.and.arrow.up")
                }
                .accessibilityIdentifier("export-qiraat-database")

                Button {
                    importTarget = .qiraat
                    isImporting = true
                } label: {
                    Label(copy("استيراد قاعدة القراءات من الملفات", "Import Qiraat database from Files"),
                          systemImage: "icloud.and.arrow.down")
                }
                .accessibilityIdentifier("import-qiraat-database")
            } header: {
                Text(verbatim: copy("القراءات العشر", "Ten Qiraat"))
            }

            Section {
                Button {
                    prepareMutshabehatExport()
                } label: {
                    Label(copy("تصدير قاعدة المتشابهات إلى الملفات", "Export Mutshabehat database to Files"),
                          systemImage: "externaldrive.badge.icloud")
                }
                .accessibilityIdentifier("export-mutshabehat-database")

                Button {
                    importTarget = .mutshabehat
                    isImporting = true
                } label: {
                    Label(copy("استيراد قاعدة المتشابهات من الملفات", "Import Mutshabehat database from Files"),
                          systemImage: "externaldrive.badge.plus")
                }
                .accessibilityIdentifier("import-mutshabehat-database")
            } header: {
                Text(verbatim: copy("المتشابهات", "Mutshabehat"))
            } footer: {
                Text(verbatim: copy(
                    "تظهر هذه الأدوات في نسخ التطوير فقط. اختر iCloud Drive من نافذة الملفات للحفظ أو الاستيراد.",
                    "These tools appear only in development builds. Choose iCloud Drive in Files to save or import."
                ))
            }
        }
        .navigationTitle(copy("قواعد البيانات", "Databases"))
        .navigationBarTitleDisplayMode(.inline)
        .fileExporter(
            isPresented: $isExporting,
            item: exportItem,
            contentTypes: [.data],
            defaultFilename: exportFilename
        ) { result in
            report(result.map { _ in copy("تم حفظ النسخة بنجاح", "Backup saved successfully") })
        }
        .fileImporter(isPresented: $isImporting, allowedContentTypes: [.data]) { result in
            handleImport(result)
        }
        .alert(copy("نقل قواعد البيانات", "Database Transfer"), isPresented: $showsMessage) {
            Button(copy("حسناً", "OK"), role: .cancel) {}
        } message: {
            Text(message)
        }
    }

    private func prepareQiraatExport() {
        do {
            guard let store = library.qiraat else { throw QiraatBackupService.BackupError.invalidQiraatArchive }
            exportItem = DatabaseTransferItem(data: try QiraatBackupService.export(from: store))
            exportFilename = "qiraat-backup.qiraatdata"
            isExporting = true
        } catch {
            report(.failure(error))
        }
    }

    private func prepareMutshabehatExport() {
        do {
            exportItem = DatabaseTransferItem(data: try MutshabehatDatabase.shared.exportDatabase())
            exportFilename = "mutshabehat.sqlite"
            isExporting = true
        } catch {
            report(.failure(error))
        }
    }

    private func handleImport(_ result: Result<URL, Error>) {
        do {
            let url = try result.get()
            guard url.startAccessingSecurityScopedResource() else { throw CocoaError(.fileReadNoPermission) }
            defer { url.stopAccessingSecurityScopedResource() }
            let data = try Data(contentsOf: url)
            switch importTarget {
            case .qiraat:
                try library.installQiraatBackup(data)
                report(.success(copy("تم استيراد قاعدة القراءات", "Qiraat database imported")))
            case .mutshabehat:
                try MutshabehatDatabase.shared.importDatabase(data)
                report(.success(copy("تم استيراد قاعدة المتشابهات", "Mutshabehat database imported")))
            case nil:
                break
            }
        } catch {
            report(.failure(error))
        }
        importTarget = nil
    }

    private func report(_ result: Result<String, Error>) {
        switch result {
        case .success(let text): message = text
        case .failure(let error): message = error.localizedDescription
        }
        showsMessage = true
    }

    private func copy(_ arabic: String, _ english: String) -> String {
        language == .english ? english : arabic
    }

    private enum ImportTarget {
        case qiraat
        case mutshabehat
    }
}
#endif
