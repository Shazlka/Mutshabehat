import MushafCore
#if DEBUG
import ReviewEditor
#endif
import SwiftUI
import UIKit

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @Binding var theme: String
    @Binding var language: String
    @Binding var keepScreenAwake: Bool
    @Bindable var qiraat: QiraatPreferences
    let library: MushafLibrary
    let onSelectPage: (Int) -> Void
    let onSelectBookmark: (QuranBookmark) -> Void
    @State private var showingQiraatPicker = false
#if DEBUG
    @State private var showingReviewEditor = false
#endif

    private var appLanguage: AppLanguage {
        AppLanguage(rawValue: language) ?? .arabic
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(appLanguage == .english ? "Quran Reading & Khatma" : "قراءة القرآن والختمة") {
                    NavigationLink {
                        ReadingStatisticsView(library: library) { surah, targetPage in
                            onSelectPage(targetPage)
                        }
                    } label: {
                        Label(
                            appLanguage == .english ? "Reading Statistics & Khatma" : "إحصائيات القراءة والختمة",
                            systemImage: "chart.bar.xaxis"
                        )
                    }
                    .accessibilityIdentifier("open-reading-statistics")

                    NavigationLink {
                        BookmarksView(library: library) { bookmark in
                            onSelectBookmark(bookmark)
                        }
                    } label: {
                        Label(
                            appLanguage == .english ? "Bookmarks" : "الفواصل والعلامات",
                            systemImage: "bookmark.fill"
                        )
                    }
                    .accessibilityIdentifier("open-bookmarks-settings")

                    Toggle(
                        appLanguage == .english ? "Keep Screen Awake" : "إبقاء الشاشة مضاءة أثناء القراءة",
                        isOn: $keepScreenAwake
                    )
                    .accessibilityIdentifier("keep-screen-awake-toggle")
                }

                if library.qiraat?.catalog != nil {
                    Section(appLanguage == .english ? "Ten Qira'at" : "القراءات العشر") {
                        QiraatToggle(isOn: $qiraat.enabled)
                        Button {
                            showingQiraatPicker = true
                        } label: {
                            Label(
                                appLanguage == .english ? "Choose Reader or Narrator" : "اختيار القارئ أو الراوي",
                                systemImage: "person.2.fill"
                            )
                        }
                        .disabled(!qiraat.enabled)
                        .accessibilityIdentifier("open-qiraat-picker")
                        Toggle(
                            appLanguage == .english ? "Farsh only (hide Usul)" : "فرش الحروف فقط (إخفاء الأصول)",
                            isOn: $qiraat.hidesUsul
                        )
                        .disabled(!qiraat.enabled)
                        .accessibilityIdentifier("qiraat-hide-usul-toggle")
                    }
                }
                Section(appLanguage == .english ? "Cloud Synchronization" : "مزامنة السحابة") {
                    NavigationLink {
                        ICloudSyncSettingsView(library: library)
                    } label: {
                        HStack {
                            Label(
                                appLanguage == .english ? "iCloud Sync (Mushaf_Qiraat)" : "مزامنة iCloud (مصحف وقراءات)",
                                systemImage: "icloud.and.arrow.down.fill"
                            )
                            Spacer()
                            Circle()
                                .fill(ICloudDatabaseSyncService.shared.isConnected ? Color.progress : Color.caution)
                                .frame(width: 8, height: 8)
                        }
                    }
                    .accessibilityIdentifier("open-icloud-sync-settings")
                }

                Section(appLanguage == .english ? "Preferences" : "التفضيلات") {
                    NavigationLink {
                        ThemeSettingsView(theme: $theme)
                    } label: {
                        Label(appLanguage == .english ? "Appearance" : "المظهر", systemImage: "circle.lefthalf.filled")
                    }
                    .accessibilityIdentifier("open-theme-settings")

                    NavigationLink {
                        LanguageSettingsView(language: $language)
                    } label: {
                        Label(appLanguage == .english ? "Language" : "اللغة", systemImage: "globe")
                    }
                    .accessibilityIdentifier("open-language-settings")
                }
#if DEBUG
                Section(language == AppLanguage.english.rawValue ? "Developer" : "المطور") {
                    NavigationLink {
                        DeveloperDataSettingsView(
                            library: library,
                            language: AppLanguage(rawValue: language) ?? .arabic
                        )
                    } label: {
                        Label(
                            language == AppLanguage.english.rawValue ? "Databases" : "قواعد البيانات",
                            systemImage: "externaldrive.connected.to.line.below"
                        )
                    }
                    .accessibilityIdentifier("open-database-settings")

                    Button { showingReviewEditor = true } label: {
                        HStack {
                            Label(
                                language == AppLanguage.english.rawValue ? "Qiraat Editor" : "محرر القراءات",
                                systemImage: "checkmark.seal.text.page"
                            )
                            Spacer()
                            Image(systemName: "chevron.forward").font(.footnote.weight(.semibold)).foregroundStyle(.tertiary)
                        }
                    }
                    .foregroundStyle(.primary)
                    .accessibilityIdentifier("open-review-editor")
                }
#endif

                if let memorization = library.memorizationStore {
                    Section(appLanguage == .english ? "Memorization" : "حفظ القرآن") {
                        Toggle(appLanguage == .english ? "Show page status in the top banner" : "إظهار حالة الحفظ في الشريط العلوي",
                               isOn: Binding(get: { memorization.showsBannerMark }, set: { memorization.showsBannerMark = $0 }))
                            .accessibilityIdentifier("memo-setting-banner-mark")
                        Toggle(appLanguage == .english ? "Show memorization marks on the Mushaf" : "إظهار حالة الحفظ على المصحف",
                               isOn: Binding(get: { memorization.showsAyahMarker }, set: { memorization.showsAyahMarker = $0 }))
                            .accessibilityIdentifier("memo-setting-ayah-marker")
                    }
                }
            }
#if DEBUG
            .fullScreenCover(isPresented: $showingReviewEditor) {
                ReviewEditorEntry(host: .make(library: library))
            }
#endif
            .sheet(isPresented: $showingQiraatPicker) {
                if let catalog = library.qiraat?.catalog {
                    QiraatReaderPicker(catalog: catalog, selection: $qiraat.filter)
                }
            }
            .navigationTitle("الإعدادات")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("تم") { dismiss() }
                }
            }
        }
    }
}

struct ThemeSettingsView: View {
    @Binding var theme: String

    var body: some View {
        List(MushafAppearance.allCases) { option in
            Button {
                theme = option.rawValue
            } label: {
                HStack {
                    Text(option.title)
                    Spacer()
                    if theme == option.rawValue {
                        Image(systemName: "checkmark")
                    }
                }
            }
            .accessibilityIdentifier("theme-\(option.rawValue)")
        }
        .navigationTitle("المظهر")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct LanguageSettingsView: View {
    @Binding var language: String

    var body: some View {
        List(AppLanguage.allCases) { option in
            Button {
                language = option.rawValue
            } label: {
                HStack {
                    Text(option.title)
                    Spacer()
                    if language == option.rawValue {
                        Image(systemName: "checkmark")
                    }
                }
            }
            .accessibilityIdentifier("language-\(option.rawValue)")
        }
        .navigationTitle("اللغة")
        .navigationBarTitleDisplayMode(.inline)
    }
}
