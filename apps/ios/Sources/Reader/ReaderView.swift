import MushafCore
import SwiftUI
import UIKit

struct ReaderView: View {
    let library: MushafLibrary
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.scenePhase) private var scenePhase

    /// The references the Qiraat card reads: the bundled file, or (UI tests) a synthetic set or none at all.
    private var qiraatReferencesForReader: QiraatReferenceStore {
#if DEBUG
        let arguments = ProcessInfo.processInfo.arguments
        if arguments.contains("-qiraat-references-fixture") { return library.qiraatReferencesFixture }
        if arguments.contains("-qiraat-references-empty") { return .empty }
#endif
        return library.qiraatReferences
    }
    private let intentRouter = AppIntentRouter.shared
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
    @State private var showingMutoon = false
    @State private var isSpread = false
    @State private var highlightedWordIDs: Set<String> = []
    @State private var qiraat = QiraatPreferences()
    @State private var qiraatSelection: QiraatWordSelection?
    @State private var qiraatRoute: QiraatHubRoute?
    @State private var pendingQiraatWord: (page: MushafPage, word: MushafWord)?
    @State private var showingQiraatFilter = false
    @State private var showingQiraatLegend = false
    /// The home-indicator inset of the screen, above which the footer bar floats.
    @State private var safeBottom: CGFloat = 34
    @AppStorage("mushaf1441:theme:v1") private var theme = MushafAppearance.system.rawValue
    @AppStorage("app:language:v1") private var language = AppLanguage.defaultCode
    @AppStorage("mushaf:keepScreenAwake") private var keepScreenAwake = true
    @AppStorage("mushaf:autoHidesFooter") private var autoHidesFooter = false
    @AppStorage(LandscapeView.storageKey) private var landscapeView = LandscapeView.reading.rawValue
    @AppStorage(SurahBannerStyle.storageKey) private var bannerStyle = SurahBannerStyle.royal.rawValue
    /// iPad landscape with «تعلّم»: one page, and the Qiraat side bar instead of the word sheet.
    @State private var isLearning = false
    /// The word the side bar shows; nil shows the page's differences.
    @State private var sideSelection: QiraatWordSelection?
    /// The page of the word the side bar's card is on now (its arrows can move to another word and page).
    @State private var sideWordPage: Int?
    /// iPad landscape: the header and footer stand as side rails, and the page takes the full height.
    @State private var usesRails = false

    var body: some View {
        GeometryReader { geometry in
            let layout = ReaderLayout.resolve(width: geometry.size.width, height: geometry.size.height,
                                              landscapeView: LandscapeView(stored: landscapeView))
            let rails = layout != .single
            ZStack {
                Color(uiColor: appearance.desk(for: interfaceTraits, tint: qiraatDisplay.pageTint)).ignoresSafeArea()
                // Left to right whatever the app's language: the information rail on the left, the page, the Qiraat
                // side bar (learning view) and the action rail on the right, as on the web.
                HStack(spacing: 0) {
                    if rails {
                        readerHeader(axis: .vertical)
                            .environment(\.layoutDirection, appLanguage.layoutDirection)
                            .frame(width: ReaderLayout.railWidth)
                            .contentShape(Rectangle())
                            .simultaneousGesture(railSwipe)
                    }
                    if layout == .learning {
                        mushafPager(spread: false, fillsHeight: true)
                        Rectangle().fill(Color(uiColor: .separator)).frame(width: 0.5).ignoresSafeArea()
                        learningSideBar
                            .frame(width: ReaderLayout.sideBarWidth(screenWidth: geometry.size.width))
                            .environment(\.layoutDirection, appLanguage.layoutDirection)
                    } else {
                        mushafPager(spread: layout == .spread, fillsHeight: rails)
                    }
                    if rails {
                        actionRail
                            .environment(\.layoutDirection, appLanguage.layoutDirection)
                            .frame(width: ReaderLayout.railWidth)
                            .contentShape(Rectangle())
                            .simultaneousGesture(railSwipe)
                    }
                }
                .environment(\.layoutDirection, .leftToRight)
            }
            .onChange(of: layout, initial: true) { _, newValue in
                isSpread = newValue == .spread
                isLearning = newValue == .learning
                usesRails = newValue != .single
            }
        }
        .overlay(alignment: .top) {
            if !usesRails { readerHeader(axis: .horizontal) }
        }
        .overlay(alignment: .bottom) {
            if !usesRails {
            GeometryReader { _ in
                ReaderBottomBar(
                    chromeVisible: chromeVisible,
                    autoHides: autoHidesFooter,
                    autoHideToken: page,
                    onAutoHide: { withAnimation(.easeInOut(duration: 0.2)) { chromeVisible = false } },
                    appearance: appearance,
                    traits: interfaceTraits,
                    safeBottom: safeBottom,
                    openIndex: { showingIndex = true },
                    openSearch: { showingSearch = true },
                    openMutoon: { showingMutoon = true },
                    openSettings: { showingSettings = true },
                    qiraat: qiraat,
                    qiraatCatalog: library.qiraat?.catalog,
                    openQiraatRoute: { route in
                        switch route {
                        case .filter: showingQiraatFilter = true
                        case .legend: showingQiraatLegend = true
                        default: qiraatRoute = route
                        }
                    }
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
            }
            .ignoresSafeArea(.container, edges: .bottom)
            }
        }
        // The action rail hides by itself, as the footer does, when that option is on.
        .task(id: "\(usesRails)-\(chromeVisible)-\(page)-\(autoHidesFooter)") {
            guard usesRails, autoHidesFooter, chromeVisible else { return }
            try? await Task.sleep(for: .seconds(10))
            if !Task.isCancelled { withAnimation(.easeInOut(duration: 0.2)) { chromeVisible = false } }
        }
        .overlay(alignment: .top) {
            if qiraat.enabled, library.qiraat != nil {
                QiraatFirstUseHint()
                    .padding(.horizontal, 12)
                    .padding(.top, 60)
            }
        }
        .onGeometryChange(for: CGFloat.self) { $0.safeAreaInsets.bottom } action: { safeBottom = $0 }
        .onChange(of: intentRouter.pendingPage) { _, _ in takeIntentJump() }
        .onAppear { takeIntentJump() }
        .onChange(of: page) { _, newPage in
            if sideSelection != nil, sideWordPage != newPage {
                sideSelection = nil
                highlightedWordIDs = []
            }
            ReadingPosition().page = newPage
        }
        .onChange(of: qiraat.hidesUsul, initial: true) { _, hidden in library.qiraat?.hidesUsul = hidden }
        .onChange(of: qiraat.hiddenUsulCategories, initial: true) { _, hidden in
            library.qiraat?.hiddenUsulCategories = hidden
        }
        .onAppear { applyScreenAwake(scenePhase) }
        .onChange(of: scenePhase) { _, newPhase in applyScreenAwake(newPhase) }
        .onChange(of: isLearning) { _, learning in
            // Leaving the learning view (portrait, or «قراءة») takes its card away with the side bar.
            guard !learning, sideSelection != nil else { return }
            sideSelection = nil
            highlightedWordIDs = []
        }
        .onChange(of: keepScreenAwake) { _, _ in applyScreenAwake(scenePhase) }
        .preferredColorScheme(appearance.colorScheme)
        .sheet(item: $qiraatSelection) { item in
            qiraatCard(item) {
                qiraatSelection = nil
                highlightedWordIDs = []
            }
        }
        .sheet(item: $qiraatRoute, onDismiss: presentPendingQiraatWord) { route in
            qiraatDestination(route)
        }
        .fullScreenCover(isPresented: $showingQiraatLegend) {
            if let store = library.qiraat {
                QiraatLegendSheet(catalog: store.catalog, store: store)
            }
        }
        .fullScreenCover(isPresented: $showingQiraatFilter) {
            if let catalog = library.qiraat?.catalog {
                QiraatFilterGrid(catalog: catalog, selection: $qiraat.filter)
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
                autoHidesFooter: $autoHidesFooter,
                qiraat: qiraat,
                library: library,
                onSelectPage: { selectedPage in
                    page = selectedPage
                    highlightedWordIDs = []
                    showingSettings = false
                }
            )
        }
        .sheet(isPresented: $showingSearch) {
            AyahSearchView(library: library) { result in
                page = result.page
                highlightedWordIDs = Set(result.matchedWordIDs)
                showingSearch = false
            }
        }
        .fullScreenCover(isPresented: $showingMutoon) {
            MutoonView(library: library.mutoon, catalog: library.qiraat?.catalog)
        }
        .environment(\.locale, appLanguage.locale)
        .environment(\.layoutDirection, appLanguage.layoutDirection)
    }

    /// Keeps the screen on while the app is in front and the setting is on.
    private func applyScreenAwake(_ phase: ScenePhase) {
        let keepAwake = keepScreenAwake && phase == .active
        if UIApplication.shared.isIdleTimerDisabled != keepAwake { UIApplication.shared.isIdleTimerDisabled = keepAwake }
    }

    private var appearance: MushafAppearance {
        MushafAppearance(rawValue: theme) ?? .system
    }

    /// The Qiraat layer as the page views draw it, with the chosen reader's soft page wash.
    private var qiraatDisplay: QiraatDisplay {
        library.qiraat.map { qiraat.display(catalog: $0.catalog) } ?? .off
    }

    private var appLanguage: AppLanguage {
        AppLanguage(rawValue: language) ?? .deviceDefault
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

    private var readerSection: ReaderSection? {
        guard let meta = metadata else { return nil }
        let quarter = meta.rubInHizb
        if appLanguage == .english {
            return ReaderSection(juzText: "Juz \(meta.juz)", hizbText: "Hizb \(meta.hizb)", rubInHizb: quarter,
                                 accessibilityText: "Juz \(meta.juz), Hizb \(meta.hizb), quarter \(quarter) of 4")
        }
        return ReaderSection(juzText: "جزء \(ArabicDigits.string(meta.juz))", hizbText: "حزب \(ArabicDigits.string(meta.hizb))",
                             rubInHizb: quarter,
                             accessibilityText: "جزء \(ArabicDigits.string(meta.juz))، حزب \(ArabicDigits.string(meta.hizb))، الربع \(ArabicDigits.string(quarter)) من ٤")
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

    /// Siri, Shortcuts or Spotlight asked for a page or a surah (`AppIntentRouter`).
    private func takeIntentJump() {
        guard let target = intentRouter.takePendingPage() else { return }
        highlightedWordIDs = []
        page = target
    }

    /// The word's card: in the sheet, or in the learning view's side bar.
    @ViewBuilder
    private func qiraatCard(_ item: QiraatWordSelection, onClose: @escaping () -> Void) -> some View {
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
                    sideWordPage = word.page
                    if word.page != page {
                        page = word.page
                    }
                },
                onSelect: openQiraatSheetWord,
                onClose: onClose
            )
            .environment(\.qiraatReferences, qiraatReferencesForReader)
            .environment(\.qiraatWordText, QiraatWordLookup { [library, page = item.word.page] surah, ayah, token in
                library.wordText(surah: surah, ayah: ayah, token: token, near: page)
            })
            .environment(\.layoutDirection, .rightToLeft)
        }
    }

    /// The reading header: across the top, or the left side rail of iPad landscape.
    private func readerHeader(axis: Axis) -> some View {
        ReaderTopBar(
            surahTitle: surahTitle,
            pageNumbers: qiraatVisiblePages,
            section: readerSection,
            appearance: appearance,
            traits: interfaceTraits,
            qiraat: qiraat,
            qiraatCatalog: library.qiraat?.catalog,
            openQiraatFilter: { showingQiraatFilter = true },
            language: appLanguage,
            onTapHeader: {
                withAnimation(.easeInOut(duration: 0.2)) { chromeVisible.toggle() }
            },
            openIndex: { showingIndex = true },
            axis: axis
        )
    }

    /// A swipe that starts on a side rail turns the page as one on the page does: toward the right is the next page
    /// (or spread), toward the left the previous one. Read in the rails' left-to-right space.
    private var railSwipe: some Gesture {
        DragGesture(minimumDistance: 30)
            .onEnded { value in
                let dx = value.translation.width, dy = value.translation.height
                guard abs(dx) > 60, abs(dx) > abs(dy) * 1.5 else { return }
                let forward = dx > 0
                if isSpread {
                    let right = Spread.rightPage(of: page)
                    page = clampPage(forward ? right + 2 : right - 2)
                } else {
                    page = clampPage(forward ? page + 1 : page - 1)
                }
            }
    }

    /// The footer's actions as the right side rail; it shows and hides with a tap on the page, as the footer does.
    private var actionRail: some View {
        ReaderActionRail(
            appearance: appearance,
            traits: interfaceTraits,
            openIndex: { showingIndex = true },
            openSearch: { showingSearch = true },
            openMutoon: { showingMutoon = true },
            openSettings: { showingSettings = true },
            qiraat: qiraat,
            qiraatCatalog: library.qiraat?.catalog,
            openQiraatRoute: { route in
                switch route {
                case .filter: showingQiraatFilter = true
                case .legend: showingQiraatLegend = true
                default: qiraatRoute = route
                }
            }
        )
        .opacity(chromeVisible ? 1 : 0)
        .allowsHitTesting(chromeVisible)
        .accessibilityHidden(!chromeVisible)
        .animation(.easeInOut(duration: 0.2), value: chromeVisible)
    }

    private func mushafPager(spread: Bool, fillsHeight: Bool = false) -> some View {
        MushafPager(library: library, page: $page, spread: spread,
                    appearance: appearance,
                    bannerStyle: SurahBannerStyle(stored: bannerStyle),
                    qiraat: qiraatDisplay,
                    highlightedWordIDs: highlightedWordIDs,
                    chromeVisible: chromeVisible,
                    fillsHeight: fillsHeight,
                    onTapCentre: { withAnimation(.easeInOut(duration: 0.2)) { chromeVisible.toggle() } },
                    onTapWord: openQiraat)
        // Single ↔ spread needs a different spine, and the page's frame depends on the rails: rebuild the pager,
        // keep the page.
        .id("\(spread)-\(fillsHeight)")
        // The rails' stack is left to right; the pager keeps the app's own direction, which sets which edge turns
        // the page forward.
        .environment(\.layoutDirection, appLanguage.layoutDirection)
    }

    /// The learning view's side bar: the tapped word's card, or the page's differences until a word is tapped;
    /// a way to turn the Qiraat layer on while it is off.
    @ViewBuilder
    private var learningSideBar: some View {
        Group {
            if let store = library.qiraat, qiraat.enabled {
                if let sideSelection {
                    qiraatCard(sideSelection) {
                        self.sideSelection = nil
                        highlightedWordIDs = []
                    }
                    .id(sideSelection.id)
                } else {
                    NavigationStack {
                        QiraatPageSummaryView(
                            pages: [page],
                            library: library,
                            store: store,
                            filter: qiraat.filter,
                            onSelect: { item in
                                if let summaryPage = library.page(item.page) { openQiraat(summaryPage, item.word) }
                            },
                            showsClose: false
                        )
                        .toolbar(.hidden, for: .navigationBar)
                        .safeAreaInset(edge: .top, spacing: 0) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("خلافات الصفحة")
                                    .font(.title3.bold())
                                    .foregroundStyle(Color(uiColor: .mushafInk))
                                    .accessibilityAddTraits(.isHeader)
                                Text("اضغط كلمة ملوّنة في الصفحة لترى قراءاتها")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 20)
                            .padding(.top, 12)
                            .padding(.bottom, 8)
                            .background(Color(uiColor: .mushafPaper))
                        }
                    }
                }
            } else if library.qiraat != nil {
                VStack(spacing: 12) {
                    Image(systemName: "character.book.closed")
                        .font(.largeTitle)
                        .foregroundStyle(Color(uiColor: .mushafBrown))
                        .accessibilityHidden(true)
                    Text("طبقة القراءات متوقفة")
                        .font(.headline)
                    Button("تفعيل القراءات") { qiraat.enabled = true }
                        .buttonStyle(.borderedProminent)
                        .tint(Color(uiColor: .mushafBrown))
                        .accessibilityIdentifier("qiraat-side-bar-enable")
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                // No Qiraat store at all (a damaged install or import): an empty side bar looked like a feature that was never there.
                VStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.largeTitle)
                        .foregroundStyle(Color(uiColor: .mushafBrown))
                        .accessibilityHidden(true)
                    Text("تعذّر تحميل بيانات القراءات")
                        .font(.headline)
                        .accessibilityIdentifier("qiraat-side-bar-unavailable")
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        // Under the reading header, and clear of the footer bar while it shows (neither is there with the rails).
        .padding(.top, usesRails ? 12 : 52)
        .padding(.bottom, !usesRails && chromeVisible ? 76 : 0)
        .background(Color(uiColor: .mushafPaper))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("qiraat-side-bar")
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
        present(QiraatWordSelection(word: word, selection: selection))
    }

    /// The word's card goes to the side bar in the learning view, to the sheet otherwise.
    private func present(_ item: QiraatWordSelection) {
        if isLearning {
            sideWordPage = item.word.page
            sideSelection = item
        } else {
            qiraatSelection = item
        }
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
        if isLearning { sideWordPage = word.page }
        if word.page != page {
            page = word.page
        }
        present(QiraatWordSelection(word: word, selection: selection))
    }

    private func presentPendingQiraatWord() {
        guard let pendingQiraatWord else { return }
        self.pendingQiraatWord = nil
        openQiraat(pendingQiraatWord.page, pendingQiraatWord.word)
    }

}
