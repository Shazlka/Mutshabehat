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
    @State private var showingMemorization = CommandLine.arguments.contains("-open-memorization")
    @State private var pageSheetRequest: PageSheetRequest?
    @State private var ayahSheetTarget: AyahSheetTarget?
    @State private var rangeStart: AyahKey?
    @State private var rangeRequest: RangeRequest?
    @State private var memorizationToast: ToastState?
    @State private var isSpread = false
    @State private var highlightedWordIDs: Set<String> = []
    @State private var qiraat = QiraatPreferences()
    @State private var qiraatSelection: QiraatWordSelection?
#if DEBUG
    @State private var cardReview = QiraatCardReviewHost()
#endif
    @State private var qiraatRoute: QiraatHubRoute?
    @State private var pendingQiraatWord: (page: MushafPage, word: MushafWord)?
    @State private var showingQiraatFilter = false
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
                            memorizationStatuses: { markerStatuses($0) },
                            memorizationVersion: memorizationVersion,
                            chromeVisible: chromeVisible,
                            onTapCentre: { withAnimation(.easeInOut(duration: 0.2)) { chromeVisible.toggle() } },
                            onTapWord: openQiraat,
                            onLongPressAyah: { pressedPage, ayahKey in
                                handleLongPress(pressedPage, ayahKey)
                            })
                .id(spread)  // single ↔ spread needs a different spine: rebuild the pager, keep the page
                .onChange(of: spread, initial: true) { _, newValue in isSpread = newValue }
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
                openMemorization: { showingMemorization = true },
                qiraat: qiraat,
                qiraatCatalog: library.qiraat?.catalog,
                openQiraatFilter: { showingQiraatFilter = true },
                openQiraatRoute: { qiraatRoute = $0 },
                memorizationMarks: memorizationMarks,
                memorizationLanguage: appLanguage,
                openMemorizationPage: { pageSheetRequest = PageSheetRequest(page: $0) },
                openSettings: { showingSettings = true },
                onTapHeader: {
                    withAnimation(.easeInOut(duration: 0.2)) { chromeVisible.toggle() }
                }
            )
        }
        .overlay(alignment: .top) {
            if qiraat.enabled, library.qiraat != nil {
                QiraatFirstUseHint()
                    .padding(.horizontal, 12)
                    .padding(.top, 60)
            }
        }
        .onChange(of: page) { _, newPage in
            ReadingPosition().page = newPage
            tracker.pageDidChange(to: newPage, library: library)
        }
        .task(id: qiraat.enabled) { startQiraatBulkSync() }
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
            library.backupController?.scenePhaseChanged(newPhase)
            if newPhase == .active { startQiraatBulkSync() }
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
                QiraatSheet(
                    item: item,
                    catalog: catalog,
                    filter: qiraat.filter,
                    store: library.qiraat,
                    orderedRefs: qiraatMarkedWords,
                    wordFont: try? library.fonts.font(page: item.word.page, size: 40),
                    pageWordsProvider: { pageNum in
                        library.page(pageNum)?.lines.flatMap(\.words) ?? []
                    },
                    fontProvider: { pageNum in
                        try? library.fonts.font(page: pageNum, size: 40)
                    },
                    onWordChanged: { word in
                        let linked = linkedWordIDs(for: word)
                        highlightedWordIDs = Set([word.id] + linked)
                        if word.page != page {
                            page = word.page
                        }
                    },
                    onSelect: openQiraatSheetWord,
                    onClose: {
                        qiraatSelection = nil
                        highlightedWordIDs = []
                    }
                )
                .environment(\.qiraatWordText, QiraatWordLookup { [library, page = item.word.page] surah, ayah, token in
                    library.wordText(surah: surah, ayah: ayah, token: token, near: page)
                })
#if DEBUG
                .environment(\.qiraatCardReviewStore, cardReview.store(library: library))
#endif
            }
        }
        .sheet(item: $qiraatRoute, onDismiss: presentPendingQiraatWord) { route in
            qiraatDestination(route)
        }
        .sheet(isPresented: $showingQiraatFilter) {
            if let catalog = library.qiraat?.catalog {
                QiraatReaderPicker(catalog: catalog, selection: $qiraat.filter)
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
        .fullScreenCover(isPresented: $showingMemorization) {
            if let store = library.memorizationStore {
                MemorizationView(library: library, store: store) { target, ayah in
                    page = target
                    highlightedWordIDs = ayah.map { key in
                        Set((library.page(target)?.lines ?? []).flatMap(\.words).filter { $0.ayahKey == key }.map(\.id))
                    } ?? []
                }
            }
        }
        .sheet(item: $ayahSheetTarget) { target in
            if let store = library.memorizationStore {
                AyahSheet(target: target, library: library, store: store, language: appLanguage,
                          isAyahBookmarked: tracker.isAyahBookmarked(surah: target.ayah.surah, ayah: target.ayah.ayah),
                          isPageBookmarked: tracker.isPageBookmarked(page: target.page.number),
                          toggleAyahBookmark: {
                              tracker.toggleAyahBookmark(surah: target.ayah.surah, ayah: target.ayah.ayah, page: target.page.number)
                          },
                          togglePageBookmark: {
                              tracker.togglePageBookmark(page: target.page.number, surah: target.ayah.surah, ayah: target.ayah.ayah)
                          },
                          startRange: { rangeStart = target.ayah },
                          openPageSheet: {
                              Task { @MainActor in
                                  try? await Task.sleep(for: .milliseconds(450))
                                  pageSheetRequest = PageSheetRequest(page: target.page.number)
                              }
                          },
                          onApplied: { result, plan in memorizationToast = ToastState(result: result, plan: plan) })
            }
        }
        .sheet(item: $rangeRequest) { request in
            if let store = library.memorizationStore {
                UpdateSheet(store: store, library: library, language: appLanguage, initial: request.selection) { result, plan in
                    memorizationToast = ToastState(result: result, plan: plan)
                }
            }
        }
        .overlay(alignment: .bottom) {
            if let start = rangeStart {
                RangePill(start: start, library: library, language: appLanguage) { rangeStart = nil }
                    .padding(.bottom, 24)
            }
        }
        .sheet(item: $pageSheetRequest) { request in
            if let store = library.memorizationStore {
                PageSheet(page: request.page, store: store, library: library, language: appLanguage) { result, plan in
                    memorizationToast = ToastState(result: result, plan: plan)
                }
            }
        }
        .modifier(OptionalMemorizationToast(toast: $memorizationToast, library: library, language: appLanguage))
        .environment(\.locale, appLanguage.locale)
        .environment(\.layoutDirection, appLanguage.layoutDirection)
    }

    /// A long press ends a stored range, otherwise opens the ayah sheet (or the old bookmark dialog without a store).
    private func handleLongPress(_ pressedPage: MushafPage, _ ayah: AyahKey) {
        guard library.memorizationStore != nil else {
            bookmarkActionTarget = (pressedPage, ayah)
            return
        }
        if let start = rangeStart {
            rangeStart = nil
            rangeRequest = RangeRequest(selection: .span(from: start, to: ayah))
        } else {
            ayahSheetTarget = AyahSheetTarget(page: pressedPage, ayah: ayah)
        }
    }

    /// Statuses for the optional ayah marker; nothing is queried while the marker is off.
    private func markerStatuses(_ page: Int) -> [AyahKey: MemorizationStatus] {
        guard let store = library.memorizationStore, store.showsAyahMarker else { return [:] }
        return store.statuses(onPage: page)
    }

    /// Read in `body` so the pager redraws when memorization or the marker setting changes.
    private var memorizationVersion: Int {
        guard let store = library.memorizationStore else { return 0 }
        return store.version * 2 + (store.showsAyahMarker ? 1 : 0)
    }

    /// The banner's memorization marks: the current page, or both pages of a spread (left page first).
    private var memorizationMarks: [(page: Int, progress: MemorizationPageProgress)] {
        guard let store = library.memorizationStore, store.showsBannerMark else { return [] }
        let pages = isSpread ? [Spread.leftPage(of: page), Spread.rightPage(of: page)] : [page]
        return pages.map { ($0, store.pageProgress($0)) }
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
            base = "صفحة \(ArabicDigits.string(page)) | جزء \(ArabicDigits.string(metadata?.juz ?? 1)) | حزب \(ArabicDigits.string(metadata?.hizb ?? 1))"
        }
        if tracker.khatmaPercent > 0 {
            let pct = Int(tracker.khatmaPercent)
            if appLanguage == .english {
                return "\(base) • Khatma \(pct)%"
            } else {
                return "\(base) • ختمة \(ArabicDigits.string(pct))٪"
            }
        }
        return base
    }

    private var sectionText: String {
        guard let meta = metadata else { return "" }
        if appLanguage == .english {
            return "Juz \(meta.juz) · Hizb \(meta.hizb)"
        }
        return "جزء \(ArabicDigits.string(meta.juz))   ◐ حزب \(ArabicDigits.string(meta.hizb))"
    }

    /// The pager presents a spread as [left, right] = [right + 1, right].
    /// Pulls every page's latest Qiraat data from the web app in the background (nearest pages first), so
    /// all colours and variants are there without swiping to each page. A no-op while the layer is off.
    private func startQiraatBulkSync() {
        guard qiraat.enabled else { return }
        QiraatBulkSync.shared.start(around: page, store: library.qiraat)
    }

    var qiraatVisiblePages: [Int] {
        isSpread ? [Spread.leftPage(of: page), Spread.rightPage(of: page)] : [page]
    }

    var activeQiraatFilter: QiraatFilter { qiraat.filter }

    private var qiraatMarkedWords: [MarkedWordRef] {
        guard let store = library.qiraat else { return [] }
        let pages = qiraatVisiblePages
        let words = pages.compactMap(library.page).flatMap { $0.lines.flatMap(\.words) }
        let data = pages.compactMap(store.page)
        let combined = QiraatPageData(
            pageNumber: pages.first ?? page,
            variants: data.flatMap(\.variants),
            rulings: data.flatMap(\.rulings),
            rules: data.flatMap(\.rules)
        )
        return QiraatWordOrder.markedWords(
            pages: pages,
            words: words,
            marks: QiraatMarks(catalog: store.catalog, page: combined),
            filter: qiraat.filter
        )
    }

    /// Turns to a result and defers the existing word-opening path until the route sheet is gone.
    func openQiraatHubWord(page targetPage: Int, surah: Int, ayah: Int, token: Int) {
        let targetPage = clampPage(targetPage)
        page = targetPage
        highlightedWordIDs = []
        pendingQiraatWord = nil

        if qiraat.enabled,
           let mushafPage = library.page(targetPage),
           let word = mushafPage.lines.flatMap(\.words).first(where: {
               $0.ayahKey.surah == surah && $0.ayahKey.ayah == ayah && $0.indexInAyah == token
           }),
           let marks = library.qiraat?.marks(page: targetPage),
           marks.selection(surah: surah, ayah: ayah, token: token, filter: qiraat.filter) != nil {
            pendingQiraatWord = (mushafPage, word)
        }
        qiraatRoute = nil
    }

    /// Usul places turn the reader to the page without opening a word sheet.
    func openQiraatHubPage(_ targetPage: Int) {
        page = clampPage(targetPage)
        highlightedWordIDs = []
        pendingQiraatWord = nil
        qiraatRoute = nil
    }

    func closeQiraatHubRoute() {
        pendingQiraatWord = nil
        qiraatRoute = nil
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

    private func linkedWordIDs(for word: MushafWord) -> [String] {
        guard let store = library.qiraat else { return [] }
        let pWords = library.page(word.page)?.lines.flatMap(\.words) ?? []
        let ctx = WordContextIndex.shared.resolveSync(
            page: word.page,
            filter: qiraat.filter,
            qiraatStore: store,
            pageWords: pWords
        )
        return ctx.words[word.id]?.linkedWordIDs ?? []
    }

    private func openQiraat(_ tappedPage: MushafPage, _ word: MushafWord) {
        guard qiraat.enabled, let marks = library.qiraat?.marks(page: tappedPage.number),
              let selection = marks.selection(surah: word.ayahKey.surah, ayah: word.ayahKey.ayah,
                                              token: word.indexInAyah, filter: qiraat.filter) else { return }
        UserDefaults.standard.set(true, forKey: QiraatFirstUseHint.storageKey)
        Haptics.wordPress()
        let linked = linkedWordIDs(for: word)
        highlightedWordIDs = Set([word.id] + linked)
        qiraatSelection = QiraatWordSelection(word: word, selection: selection)
    }

    private func openQiraatSheetWord(_ reference: MarkedWordRef) {
        let word = reference.word
        guard let marks = library.qiraat?.marks(page: word.page),
              let selection = marks.selection(
                  surah: word.ayahKey.surah,
                  ayah: word.ayahKey.ayah,
                  token: word.indexInAyah,
                  filter: qiraat.filter
              ) else { return }
        let linked = linkedWordIDs(for: word)
        highlightedWordIDs = Set([word.id] + linked)
        if word.page != page {
            page = word.page
        }
        qiraatSelection = QiraatWordSelection(word: word, selection: selection)
    }

    private func presentPendingQiraatWord() {
        guard let pendingQiraatWord else { return }
        self.pendingQiraatWord = nil
        openQiraat(pendingQiraatWord.page, pendingQiraatWord.word)
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
                ReviewEditorEntry(library: library)
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
