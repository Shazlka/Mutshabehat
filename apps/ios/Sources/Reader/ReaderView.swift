import MushafCore
import SwiftUI
import UIKit

struct ReaderView: View {
    let library: MushafLibrary
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var tracker = ReadingTracker.shared
    @State private var page: Int = {
        if let idx = CommandLine.arguments.firstIndex(of: "-page"),
           CommandLine.arguments.indices.contains(idx + 1),
           let p = Int(CommandLine.arguments[idx + 1]) {
            return clampPage(p)
        }
        return ReadingPosition().page
    }()
    @State private var chromeVisible = CommandLine.arguments.contains("-show-chrome")
    @State private var showingIndex = false
    @State private var showingSearch = false
    @State private var showingSettings = false
    @State private var showingBookmarks = CommandLine.arguments.contains("-open-bookmarks")
    @State private var showingStatistics = CommandLine.arguments.contains("-open-statistics")
    @State private var showingMutshabehat = CommandLine.arguments.contains("-open-mutshabehat")
    @State private var highlightedWordIDs: Set<String> = []
    @State private var qiraat = QiraatPreferences()
    @State private var qiraatSelection: QiraatWordSelection?
    @State private var bookmarkActionTarget: (page: MushafPage, ayah: AyahKey)? = nil
    @AppStorage("mushaf1441:theme:v1") private var theme = MushafAppearance.system.rawValue
    @AppStorage("app:language:v1") private var language = AppLanguage.arabic.rawValue
    @AppStorage("mushaf:keepScreenAwake") private var keepScreenAwake = true

    var body: some View {
        GeometryReader { geometry in
            let spread = Spread.isSpread(width: geometry.size.width, height: geometry.size.height)
            ZStack {
                Color(uiColor: appearance.desk(for: interfaceTraits)).ignoresSafeArea()
                MushafPager(library: library, page: $page, spread: spread,
                            appearance: appearance,
                            qiraat: library.qiraat == nil ? .off : qiraat.display,
                            highlightedWordIDs: highlightedWordIDs,
                            bookmarkedAyahs: { tracker.bookmarkedAyahs(on: $0) },
                            isPageBookmarked: { tracker.isPageBookmarked(page: $0) },
                            chromeVisible: chromeVisible,
                            onTapCentre: { withAnimation(.easeInOut(duration: 0.2)) { chromeVisible.toggle() } },
                            onTapWord: openQiraat,
                            onLongPressAyah: { pressedPage, ayahKey in
                                bookmarkActionTarget = (pressedPage, ayahKey)
                            })
                .id(spread)  // single ↔ spread needs a different spine: rebuild the pager, keep the page
            }
        }
        .overlay(alignment: .top) {
            ReaderTopBar(
                chromeVisible: chromeVisible,
                surahTitle: surahTitle,
                detailsText: detailsText,
                sectionText: sectionText,
                appearance: appearance,
                traits: interfaceTraits,
                openIndex: { showingIndex = true },
                openSearch: { showingSearch = true },
                openBookmarks: { showingBookmarks = true },
                openMutshabehat: { showingMutshabehat = true },
                openSettings: { showingSettings = true },
                onTapHeader: {
                    withAnimation(.easeInOut(duration: 0.2)) { chromeVisible.toggle() }
                }
            )
        }
        .onChange(of: page) { _, newPage in
            ReadingPosition().page = newPage
            tracker.pageDidChange(to: newPage, library: library)
        }
        .onAppear {
            tracker.configureScreenAwake(enabled: keepScreenAwake, scenePhase: scenePhase)
            tracker.pageDidChange(to: page, library: library)
            if ICloudDatabaseSyncService.shared.autoSyncEnabled {
                Task {
                    _ = try? await ICloudDatabaseSyncService.shared.syncFromICloud(library: library)
                }
            }
        }
        .onChange(of: scenePhase) { _, newPhase in
            tracker.configureScreenAwake(enabled: keepScreenAwake, scenePhase: newPhase)
            if newPhase != .active {
                tracker.flushCurrentPageDwell(library: library)
            } else if ICloudDatabaseSyncService.shared.autoSyncEnabled {
                Task {
                    _ = try? await ICloudDatabaseSyncService.shared.syncFromICloud(library: library)
                }
            }
        }
        .onDisappear {
            tracker.flushCurrentPageDwell(library: library)
        }
        .onChange(of: keepScreenAwake) { _, enabled in
            tracker.configureScreenAwake(enabled: enabled, scenePhase: scenePhase)
        }
        .preferredColorScheme(appearance.colorScheme)
        .sheet(item: $qiraatSelection) { item in
            if let catalog = library.qiraat?.catalog {
                QiraatSheet(item: item, catalog: catalog, filter: qiraat.filter,
                            wordFont: try? library.fonts.font(page: item.word.page, size: 40)) { qiraatSelection = nil }
            }
        }
        .sheet(isPresented: $showingIndex) {
            IndexSheet(library: library, currentPage: page) { selected in
                page = selected
                highlightedWordIDs = []
                showingIndex = false
            }
        }
        .sheet(isPresented: $showingSettings) {
            SettingsView(
                theme: $theme,
                language: $language,
                keepScreenAwake: $keepScreenAwake,
                qiraat: qiraat,
                library: library,
                onSelectPage: { selectedPage in
                    page = selectedPage
                    highlightedWordIDs = []
                    showingSettings = false
                },
                onSelectBookmark: { bookmark in
                    jumpToBookmark(bookmark)
                    showingSettings = false
                }
            )
        }
        .sheet(isPresented: $showingBookmarks) {
            BookmarksView(library: library) { bookmark in
                jumpToBookmark(bookmark)
                showingBookmarks = false
            }
        }
        .sheet(isPresented: $showingStatistics) {
            NavigationStack {
                ReadingStatisticsView(library: library) { surah, targetPage in
                    page = targetPage
                    highlightedWordIDs = []
                    showingStatistics = false
                }
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button(appLanguage == .english ? "Done" : "تم") { showingStatistics = false }
                    }
                }
            }
        }
        .sheet(isPresented: $tracker.showingKhatmaCelebration) {
            if let record = tracker.completedKhatmaRecord {
                KhatmaCelebrationView(
                    completedKhatma: record,
                    onStartNewKhatma: {
                        tracker.showingKhatmaCelebration = false
                    },
                    onViewStatistics: {
                        tracker.showingKhatmaCelebration = false
                        showingStatistics = true
                    }
                )
            }
        }
        .confirmationDialog(
            appLanguage == .english ? "Bookmark Options" : "خيارات الفواصل",
            isPresented: Binding(
                get: { bookmarkActionTarget != nil },
                set: { if !$0 { bookmarkActionTarget = nil } }
            ),
            titleVisibility: .visible
        ) {
            if let target = bookmarkActionTarget {
                let isAyahMarked = tracker.isAyahBookmarked(surah: target.ayah.surah, ayah: target.ayah.ayah)
                let isPageMarked = tracker.isPageBookmarked(page: target.page.number)

                Button(isAyahMarked
                       ? (appLanguage == .english ? "Remove Ayah Bookmark" : "إزالة فاصل الآية")
                       : (appLanguage == .english ? "Bookmark Ayah" : "حفظ فاصل للآية")) {
                    tracker.toggleAyahBookmark(surah: target.ayah.surah, ayah: target.ayah.ayah, page: target.page.number)
                    bookmarkActionTarget = nil
                }

                Button(isPageMarked
                       ? (appLanguage == .english ? "Remove Page Bookmark" : "إزالة فاصل الصفحة")
                       : (appLanguage == .english ? "Bookmark Page" : "حفظ فاصل للصفحة")) {
                    tracker.togglePageBookmark(page: target.page.number, surah: target.ayah.surah, ayah: target.ayah.ayah)
                    bookmarkActionTarget = nil
                }

                Button(appLanguage == .english ? "Cancel" : "إلغاء", role: .cancel) {
                    bookmarkActionTarget = nil
                }
            }
        } message: {
            if let target = bookmarkActionTarget {
                let surahName = library.surahNames[target.ayah.surah] ?? "سورة \(target.ayah.surah)"
                if appLanguage == .english {
                    Text("\(surahName) - Ayah \(target.ayah.ayah) (Page \(target.page.number))")
                } else {
                    Text("\(surahName) - آية \(target.ayah.ayah) (صفحة \(target.page.number))")
                }
            }
        }
        .sheet(isPresented: $showingSearch) {
            AyahSearchView(library: library) { result in
                page = result.page
                highlightedWordIDs = Set(result.matchedWordIDs)
                showingSearch = false
            }
        }
        .fullScreenCover(isPresented: $showingMutshabehat) {
            MutshabehatView(library: library)
        }
        .environment(\.locale, appLanguage.locale)
        .environment(\.layoutDirection, appLanguage.layoutDirection)
    }

    private var appearance: MushafAppearance {
        MushafAppearance(rawValue: theme) ?? .system
    }

    private var appLanguage: AppLanguage {
        AppLanguage(rawValue: language) ?? .arabic
    }

    private var interfaceTraits: UITraitCollection {
        UITraitCollection(userInterfaceStyle: colorScheme == .dark ? .dark : .light)
    }

    private var metadata: PageMetadata? { library.page(page)?.metadata }

    private var surahTitle: String {
        guard let names = metadata?.surahNames, !names.isEmpty else { return "" }
        if appLanguage == .english {
            return names.map { "Surah \($0.replacingOccurrences(of: "سورة ", with: ""))" }.joined(separator: " · ")
        }
        return names.map { $0.hasPrefix("سورة") ? $0 : "سورة \($0)" }.joined(separator: " · ")
    }

    private var detailsText: String {
        let base: String
        if appLanguage == .english {
            base = "Page \(page) | Juz \(metadata?.juz ?? 1) | Hizb \(metadata?.hizb ?? 1)"
        } else {
            base = "صفحة \(toArabicDigits(page)) | جزء \(toArabicDigits(metadata?.juz ?? 1)) | حزب \(toArabicDigits(metadata?.hizb ?? 1))"
        }
        if tracker.khatmaPercent > 0 {
            let pct = Int(tracker.khatmaPercent)
            if appLanguage == .english {
                return "\(base) • Khatma \(pct)%"
            } else {
                return "\(base) • ختمة \(toArabicDigits(pct))٪"
            }
        }
        return base
    }

    private var sectionText: String {
        guard let meta = metadata else { return "" }
        if appLanguage == .english {
            return "Juz \(meta.juz) · Hizb \(meta.hizb)"
        }
        return "جزء \(toArabicDigits(meta.juz))   ◐ حزب \(toArabicDigits(meta.hizb))"
    }

    private func toArabicDigits(_ number: Int) -> String {
        let digits = ["0": "٠", "1": "١", "2": "٢", "3": "٣", "4": "٤",
                      "5": "٥", "6": "٦", "7": "٧", "8": "٨", "9": "٩"]
        return String(number).compactMap { digits[String($0)] }.joined()
    }

    private func jumpToBookmark(_ bookmark: QuranBookmark) {
        page = bookmark.page
        if bookmark.type == .ayah, let p = library.page(bookmark.page) {
            let wordIDs = p.lines.flatMap(\.words)
                .filter { $0.ayahKey.surah == bookmark.surah && $0.ayahKey.ayah == bookmark.ayah }
                .map(\.id)
            highlightedWordIDs = Set(wordIDs)
        } else {
            highlightedWordIDs = []
        }
    }

    private func openQiraat(_ tappedPage: MushafPage, _ word: MushafWord) {
        guard qiraat.enabled, let marks = library.qiraat?.marks(page: tappedPage.number),
              let selection = marks.selection(surah: word.ayahKey.surah, ayah: word.ayahKey.ayah,
                                              token: word.indexInAyah, filter: qiraat.filter) else { return }
        qiraatSelection = QiraatWordSelection(word: word, selection: selection)
    }

}

private struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @Binding var theme: String
    @Binding var language: String
    @Binding var keepScreenAwake: Bool
    @Bindable var qiraat: QiraatPreferences
    let library: MushafLibrary
    let onSelectPage: (Int) -> Void
    let onSelectBookmark: (QuranBookmark) -> Void
    @State private var showingQiraatPicker = false

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
                                .fill(ICloudDatabaseSyncService.shared.isConnected ? Color.green : Color.orange)
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
                }
#endif
            }
            .fullScreenCover(isPresented: $showingQiraatPicker) {
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

private struct ThemeSettingsView: View {
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

private struct LanguageSettingsView: View {
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
