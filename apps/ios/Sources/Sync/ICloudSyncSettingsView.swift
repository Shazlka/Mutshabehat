import MushafCore
import SwiftUI
import UniformTypeIdentifiers

struct ICloudSyncSettingsView: View {
    let library: MushafLibrary?

    @State private var syncService = ICloudDatabaseSyncService.shared
    @State private var isShowingFolderPicker: Bool = false
    @State private var alertMessage: String = ""
    @State private var isShowingAlert: Bool = false

    @AppStorage("app:language:v1") private var appLanguage: String = "ar"
    private var isArabic: Bool { appLanguage != "en" }

    init(library: MushafLibrary? = nil) {
        self.library = library
    }

    var body: some View {
        Form {
            // Status Section
            Section {
                HStack(spacing: 12) {
                    Image(systemName: syncService.isConnected ? "checkmark.icloud.fill" : "exclamationmark.icloud.fill")
                        .font(.system(size: 28))
                        .foregroundStyle(syncService.isConnected ? .green : .orange)

                    VStack(alignment: .leading, spacing: 4) {
                        Text(syncService.isConnected ? copy("متصل بـ iCloud Drive", "Connected to iCloud Drive") : copy("بانتظار الربط بـ iCloud", "Awaiting iCloud Connection"))
                            .font(.headline)

                        Text(copy("مجلد المزامنة: Mushaf_Qiraat", "Sync Folder: Mushaf_Qiraat"))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 4)

                if let date = syncService.lastSyncDate {
                    HStack {
                        Text(copy("آخر مزامنة", "Last Synced"))
                            .foregroundStyle(.secondary)
                        Spacer()
                        Text(date.formatted(date: .abbreviated, time: .shortened))
                            .font(.subheadline)
                    }
                }
            } header: {
                Text(copy("حالة الاتصال", "Connection Status"))
            }

            // Database Details
            Section {
                HStack {
                    Label(copy("المتشابهات (مجموعات شخصية)", "Mutshabehat Groups"), systemImage: "rectangle.3.group")
                    Spacer()
                    let count = syncService.manifest?.databases["mutshabehat"]?.groupsCount ?? MutshabehatDatabase.shared.fetchPersonalGroups().count
                    Text("\(count) \(copy("مجموعة", "groups"))")
                        .font(.subheadline.bold())
                        .foregroundStyle(.secondary)
                }

                HStack {
                    Label(copy("القراءات العشر (المصحف)", "Ten Qira'at Pages"), systemImage: "text.book.closed")
                    Spacer()
                    let pages = syncService.manifest?.databases["qiraat"]?.pageCount ?? 604
                    Text("\(pages) \(copy("صفحة", "pages"))")
                        .font(.subheadline.bold())
                        .foregroundStyle(.secondary)
                }

                HStack {
                    Label(copy("المصدر المعتمد", "Source of Truth"), systemImage: "server.rack")
                    Spacer()
                    Text(copy("خادم الويب المباشر", "Live Web App Database"))
                        .font(.subheadline)
                        .foregroundStyle(Color.accentColor)
                }
            } header: {
                Text(copy("بيانات المزامنة في المجلد", "Database Files in Folder"))
            }

            // Sync Actions
            Section {
                Button {
                    Task {
                        await triggerSync()
                    }
                } label: {
                    HStack {
                        if syncService.isSyncing {
                            ProgressView()
                                .padding(.trailing, 6)
                        } else {
                            Image(systemName: "arrow.triangle.2.circlepath.icloud")
                        }
                        Text(syncService.isSyncing ? copy("جاري المزامنة...", "Syncing...") : copy("مزامنة الآن من iCloud", "Sync Now from iCloud"))
                            .bold()
                    }
                }
                .disabled(syncService.isSyncing)

                Button {
                    Task {
                        await triggerDirectWebSync()
                    }
                } label: {
                    HStack {
                        Image(systemName: "arrow.down.circle")
                        Text(copy("تحديث من خادم الويب مباشرة", "Fetch Directly from Web App"))
                    }
                }
                .disabled(syncService.isSyncing)

                Button {
                    isShowingFolderPicker = true
                } label: {
                    HStack {
                        Image(systemName: "folder.badge.gearshape")
                        Text(copy("تحديد مجلد مزامنة مخصص", "Select Custom Sync Folder"))
                    }
                }
            } header: {
                Text(copy("إجراءات المزامنة", "Sync Actions"))
            } footer: {
                Text(copy(
                    "المصدر المعتمد هو خادم الويب. يتم حفظ نسخ قواعد البيانات (المتشابهات والقراءات) كملفات منفصلة في مجلد Mushaf_Qiraat على iCloud لتتطابق تلقائياً على كل أجهزتك (الآيفون والآيباد).",
                    "The web app is the authoritative source of truth. Separate database files (Mutshabehat and Qiraat) are kept in the Mushaf_Qiraat iCloud folder to stay synchronized across all your devices."
                ))
            }

            // Automation Toggle
            Section {
                Toggle(copy("المزامنة التلقائية عند الفتح", "Auto-Sync on Launch & Resume"), isOn: Binding(
                    get: { syncService.autoSyncEnabled },
                    set: { syncService.autoSyncEnabled = $0 }
                ))
            } footer: {
                Text(copy(
                    "يقوم التطبيق بالتحقق من وجود تحديثات جديدة في iCloud Drive وتحديث شاشات المتشابهات والقراءات تلقائياً.",
                    "The app automatically checks for database updates in iCloud Drive and refreshes data on app resume."
                ))
            }
        }
        .navigationTitle(copy("مزامنة السحابة (iCloud)", "iCloud Sync"))
        .navigationBarTitleDisplayMode(.inline)
        .fileImporter(isPresented: $isShowingFolderPicker, allowedContentTypes: [.folder]) { result in
            handleCustomFolder(result)
        }
        .alert(copy("مزامنة البيانات", "Database Sync"), isPresented: $isShowingAlert) {
            Button(copy("حسناً", "OK"), role: .cancel) {}
        } message: {
            Text(alertMessage)
        }
        .onAppear {
            syncService.refreshConnectionStatus()
        }
    }

    private func triggerSync() async {
        do {
            let summary = try await syncService.syncFromICloud(library: library, force: true)
            alertMessage = summary.message
            isShowingAlert = true
        } catch {
            alertMessage = error.localizedDescription
            isShowingAlert = true
        }
    }

    private func triggerDirectWebSync() async {
        do {
            let summary = try await syncService.syncDirectlyFromWeb(library: library)
            alertMessage = summary.message
            isShowingAlert = true
        } catch {
            alertMessage = error.localizedDescription
            isShowingAlert = true
        }
    }

    private func handleCustomFolder(_ result: Result<URL, Error>) {
        do {
            let url = try result.get()
            try syncService.setCustomFolder(url: url)
            alertMessage = copy("تم ربط المجلد المخصص بنجاح", "Custom folder linked successfully")
            isShowingAlert = true
        } catch {
            alertMessage = error.localizedDescription
            isShowingAlert = true
        }
    }

    private func copy(_ ar: String, _ en: String) -> String {
        isArabic ? ar : en
    }
}
