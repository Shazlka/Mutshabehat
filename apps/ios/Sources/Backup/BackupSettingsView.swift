import MushafCore
import SwiftUI
import UniformTypeIdentifiers

/// «النسخ الاحتياطي»: where backups go, back up now, restore from a set, and export or import the
/// memorization as a JSON file.
struct BackupSettingsView: View {
    let controller: BackupController
    let language: AppLanguage

    @State private var isPickingFolder = false
    @State private var isImportingJSON = false
    @State private var message: String?
    @State private var restoreTarget: SnapshotInfo?
    @State private var exportURL: URL?
    @State private var busy = false
    @State private var pendingImport: Data?
    @State private var refresh = 0

    private func copy(_ ar: String, _ en: String) -> String { language == .arabic ? ar : en }

    private var snapshots: [SnapshotInfo] {
        _ = refresh
        return controller.service.listSnapshots()
    }

    var body: some View {
        List {
            statusSection
            actionsSection
            snapshotsSection
            jsonSection
        }
        .navigationTitle(copy("النسخ الاحتياطي", "Backup"))
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("memo-backup")
        .fileImporter(isPresented: $isPickingFolder, allowedContentTypes: [.folder]) { result in
            if case let .success(url) = result {
                do {
                    try ICloudDatabaseSyncService.shared.setCustomFolder(url: url)
                    controller.refreshFolder()
                    message = copy("تم اختيار المجلد", "Folder selected")
                } catch {
                    message = error.localizedDescription
                }
            }
        }
        .fileImporter(isPresented: $isImportingJSON, allowedContentTypes: [.json]) { result in
            if case let .success(url) = result {
                let access = url.startAccessingSecurityScopedResource()
                defer { if access { url.stopAccessingSecurityScopedResource() } }
                do {
                    let data = try Data(contentsOf: url)
                    _ = try MemorizationExport.decode(data)
                    pendingImport = data
                } catch {
                    message = copy("الملف ليس نسخة حفظ صالحة", "This is not a valid memorization file")
                }
            }
        }
        .confirmationDialog(copy("استيراد الحفظ", "Import memorization"), isPresented: Binding(
            get: { pendingImport != nil }, set: { if !$0 { pendingImport = nil } }), titleVisibility: .visible) {
            Button(copy("دمج مع الحالي (الأحدث يفوز)", "Merge with current (newer wins)")) { importJSON(.merge) }
                .accessibilityIdentifier("memo-import-merge")
            Button(copy("استبدال الحالي", "Replace current"), role: .destructive) { importJSON(.replace) }
                .accessibilityIdentifier("memo-import-replace")
            Button(copy("إلغاء", "Cancel"), role: .cancel) { pendingImport = nil }
        }
        .alert(message ?? "", isPresented: Binding(get: { message != nil }, set: { if !$0 { message = nil } })) {
            Button(copy("حسنًا", "OK"), role: .cancel) {}
        }
        .sheet(item: $restoreTarget) { info in
            RestoreView(controller: controller, info: info, language: language) { refresh += 1 }
        }
    }

    // MARK: Sections

    private var statusSection: some View {
        Section {
            HStack {
                Text(verbatim: copy("المجلد", "Folder"))
                Spacer()
                Text(verbatim: controller.folderAvailable ? copy("متصل", "Connected") : copy("غير محدد", "Not set"))
                    .foregroundStyle(controller.folderAvailable ? .green : .orange)
                    .accessibilityIdentifier("memo-backup-folder-state")
            }
            HStack {
                Text(verbatim: copy("آخر نسخة", "Last backup"))
                Spacer()
                Text(verbatim: controller.lastSuccess.map { $0.formatted(date: .abbreviated, time: .shortened) }
                     ?? copy("لا توجد", "None"))
                    .foregroundStyle(.secondary)
                    .accessibilityIdentifier("memo-backup-last")
            }
            if let error = controller.lastError {
                Text(verbatim: error).font(.footnote).foregroundStyle(.red)
            }
        } footer: {
            Text(verbatim: copy("تشمل النسخة الحفظ والقراءة والمتشابهات وبيانات القراءات في مجلد iCloud Drive الذي تختاره.",
                                "Backups cover memorization, reading, mutashabihat and the Qiraat data, in the iCloud Drive folder you pick."))
        }
    }

    private var actionsSection: some View {
        Section {
            Button(copy("اختيار مجلد iCloud", "Choose iCloud folder")) { isPickingFolder = true }
                .accessibilityIdentifier("memo-backup-choose-folder")
            Button {
                backupNow()
            } label: {
                HStack {
                    Text(verbatim: copy("نسخ احتياطي الآن", "Back up now"))
                    if busy { Spacer(); ProgressView() }
                }
            }
            .disabled(busy)
            .accessibilityIdentifier("memo-backup-now")
        }
    }

    private var snapshotsSection: some View {
        Section(copy("النسخ المحفوظة", "Saved backups")) {
            if snapshots.isEmpty {
                Text(verbatim: copy("لا توجد نسخ بعد", "No backups yet")).foregroundStyle(.secondary)
            }
            ForEach(snapshots) { info in
                Button {
                    restoreTarget = info
                } label: {
                    HStack {
                        Text(verbatim: info.createdAt.formatted(date: .abbreviated, time: .shortened))
                        Spacer()
                        Text(verbatim: copy("استعادة", "Restore")).foregroundStyle(.tint)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("memo-backup-snapshot-\(info.name)")
            }
        }
    }

    private var jsonSection: some View {
        Section(copy("ملف الحفظ (JSON)", "Memorization file (JSON)")) {
            if let url = exportURL {
                ShareLink(item: url) { Text(verbatim: copy("مشاركة الملف", "Share the file")) }
                    .accessibilityIdentifier("memo-export-share")
            }
            Button(copy("تصدير الحفظ", "Export memorization")) { exportJSON() }
                .accessibilityIdentifier("memo-export-json")
            Button(copy("استيراد الحفظ", "Import memorization")) { isImportingJSON = true }
                .accessibilityIdentifier("memo-import-json")
        }
    }

    // MARK: Actions

    private func backupNow() {
        busy = true
        Task {
            defer { busy = false }
            do {
                let result = try await controller.backupNow()
                message = result.skipped
                    ? copy("لا تغييرات منذ آخر نسخة", "Nothing changed since the last backup")
                    : copy("تمت النسخة الاحتياطية", "Backup complete")
                refresh += 1
            } catch {
                message = error.localizedDescription
            }
        }
    }

    private func exportJSON() {
        do {
            let service = try? controller.makeRestoreService()
            let data = try service?.exportJSON() ?? controller.service.memorizationExportData()
            let name = "memorization-\(Int(Date().timeIntervalSince1970)).json"
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(name)
            try data.write(to: url)
            exportURL = url
        } catch {
            message = error.localizedDescription
        }
    }

    private func importJSON(_ mode: MemorizationRestoreMode) {
        guard let data = pendingImport else { return }
        pendingImport = nil
        do {
            let service = try controller.makeRestoreService()
            try service.importJSON(data, mode: mode)
            controller.didRestore()
            message = copy("تم استيراد الحفظ", "Memorization imported")
        } catch {
            message = error.localizedDescription
        }
    }
}

/// Preview of one backup set and the restore itself: choose what to restore and how memorization is combined.
struct RestoreView: View {
    let controller: BackupController
    let info: SnapshotInfo
    let language: AppLanguage
    let onFinished: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var preview: RestorePreview?
    @State private var selected: Set<BackupStore> = []
    @State private var replaceMemorization = false
    @State private var errorMessage: String?
    @State private var report: RestoreReport?
    @State private var confirming = false

    private func copy(_ ar: String, _ en: String) -> String { language == .arabic ? ar : en }

    private func name(_ store: BackupStore) -> String {
        switch store {
        case .memorization: copy("الحفظ", "Memorization")
        case .reading: copy("القراءة", "Reading")
        case .mutshabehat: copy("المتشابهات", "Mutashabihat")
        case .qiraat: copy("القراءات", "Qiraat")
        }
    }

    var body: some View {
        NavigationStack {
            List {
                if let preview {
                    Section {
                        Text(verbatim: info.createdAt.formatted(date: .abbreviated, time: .shortened))
                        Text(verbatim: copy("\(MemorizationTheme.number(preview.ayahRecords, language: language)) آية · \(MemorizationTheme.number(preview.batches, language: language)) تحديث",
                                            "\(preview.ayahRecords) ayat · \(preview.batches) updates"))
                            .foregroundStyle(.secondary)
                    }
                    Section(copy("ما يُستعاد", "What to restore")) {
                        ForEach(BackupStore.allCases.filter { preview.stores.contains($0) }, id: \.self) { store in
                            Toggle(name(store), isOn: Binding(
                                get: { selected.contains(store) },
                                set: { if $0 { selected.insert(store) } else { selected.remove(store) } }))
                                .accessibilityIdentifier("memo-restore-store-\(String(describing: store))")
                        }
                    }
                    if selected.contains(.memorization) {
                        Section {
                            Toggle(copy("استبدال الحفظ الحالي", "Replace current memorization"), isOn: $replaceMemorization)
                                .accessibilityIdentifier("memo-restore-replace")
                        } footer: {
                            Text(verbatim: copy("الافتراضي هو الدمج: يبقى الأحدث لكل آية. تُحفظ نسخة أمان قبل أي استعادة.",
                                                "Merging is the default: the newer row of each ayah stays. A safety copy is kept before any restore."))
                        }
                    }
                    Section {
                        Button(copy("استعادة", "Restore")) { confirming = true }
                            .disabled(selected.isEmpty)
                            .accessibilityIdentifier("memo-restore-apply")
                    }
                }
                if let report {
                    Section(copy("النتيجة", "Result")) {
                        ForEach(Array(report.restored), id: \.self) { Text(verbatim: "✓ " + name($0)) }
                        ForEach(Array(report.failed.keys), id: \.self) { store in
                            Text(verbatim: "✕ \(name(store)): \(report.failed[store] ?? "")").foregroundStyle(.red)
                        }
                    }
                    .accessibilityIdentifier("memo-restore-report")
                }
                if let errorMessage {
                    Section { Text(verbatim: errorMessage).foregroundStyle(.red) }
                }
            }
            .navigationTitle(copy("استعادة نسخة", "Restore a backup"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button(copy("إغلاق", "Close")) { dismiss() } } }
            .confirmationDialog(copy("تأكيد الاستعادة", "Confirm restore"), isPresented: $confirming, titleVisibility: .visible) {
                Button(copy("استعادة", "Restore"), role: .destructive) { restore() }
                    .accessibilityIdentifier("memo-restore-confirm")
                Button(copy("إلغاء", "Cancel"), role: .cancel) {}
            } message: {
                Text(verbatim: copy("ستُستبدل البيانات المختارة. تُحفظ نسخة أمان أولًا.", "The chosen data will be replaced. A safety copy is saved first."))
            }
        }
        .environment(\.layoutDirection, language.layoutDirection)
        .presentationDetents([.large])
        .task { load() }
    }

    private func load() {
        do {
            let service = try controller.makeRestoreService()
            let value = try service.preview(info)
            preview = value
            selected = [.memorization]
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func restore() {
        do {
            let service = try controller.makeRestoreService()
            report = try service.restore(info, stores: selected, memorizationMode: replaceMemorization ? .replace : .merge)
            controller.didRestore()
            onFinished()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
