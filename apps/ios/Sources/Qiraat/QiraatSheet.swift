import CoreText
import MushafCore
#if DEBUG
import ReviewEditor
#endif
import SwiftUI
import UIKit

/// A tapped word and what the Qiraat layer knows about it.
struct QiraatWordSelection: Identifiable {
    let id = UUID()
    let word: MushafWord
    let selection: QiraatSelection
}

/// The detail card the web shows in its Qiraat sidebar (`renderQiraatSelection`), as a sheet:
/// the word, one card per variant with who reads it, and one card per أصول ruling grouped by action.
struct QiraatSheet: View {
    let item: QiraatWordSelection
    let catalog: QiraatCatalog
    let filter: QiraatFilter
    let store: QiraatStore?
    let orderedRefs: [MarkedWordRef]
    let wordFont: CTFont?
    var pageWordsProvider: ((Int) -> [MushafWord])? = nil
    var fontProvider: ((Int) -> CTFont?)? = nil
    var onWordChanged: ((MushafWord) -> Void)? = nil
    var onSelect: ((MarkedWordRef) -> Void)? = nil
    let onClose: () -> Void

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @ObservedObject private var liveSync = QiraatLiveSync.shared
    @State private var detent: PresentationDetent = .large

    @State private var currentWord: MushafWord
    @State private var currentSelection: QiraatSelection
    @State private var currentWordFont: CTFont?
    @State private var activeRefs: [MarkedWordRef]
    /// Logical (span-merged) refs and the previous/next targets, computed once per input change
    /// instead of on every body pass.
    @State private var nav: QiraatNavSnapshot
    /// Bumped when live data for a page near the current word arrives, so `nav` is rebuilt.
    @State private var dataRevision = 0

    init(
        item: QiraatWordSelection,
        catalog: QiraatCatalog,
        filter: QiraatFilter,
        store: QiraatStore?,
        orderedRefs: [MarkedWordRef],
        wordFont: CTFont?,
        pageWordsProvider: ((Int) -> [MushafWord])? = nil,
        fontProvider: ((Int) -> CTFont?)? = nil,
        onWordChanged: ((MushafWord) -> Void)? = nil,
        onSelect: ((MarkedWordRef) -> Void)? = nil,
        onClose: @escaping () -> Void
    ) {
        self.item = item
        self.catalog = catalog
        self.filter = filter
        self.store = store
        self.orderedRefs = orderedRefs
        self.wordFont = wordFont
        self.pageWordsProvider = pageWordsProvider
        self.fontProvider = fontProvider
        self.onWordChanged = onWordChanged
        self.onSelect = onSelect
        self.onClose = onClose

        _currentWord = State(initialValue: item.word)
        _currentSelection = State(initialValue: item.selection)
        _currentWordFont = State(initialValue: wordFont)
        _activeRefs = State(initialValue: orderedRefs)

        let resolver = QiraatNavResolver(store: store, filter: filter, pageWordsProvider: pageWordsProvider)
        _nav = State(initialValue: resolver.snapshot(
            key: QiraatNavKey(wordID: item.word.id, refIDs: orderedRefs.map(\.id), filter: filter, revision: 0),
            word: item.word,
            refs: orderedRefs
        ))
    }

    private var navKey: QiraatNavKey {
        QiraatNavKey(wordID: currentWord.id, refIDs: activeRefs.map(\.id), filter: filter, revision: dataRevision)
    }

    private func makeNav(word: MushafWord, refs: [MarkedWordRef]) -> QiraatNavSnapshot {
        QiraatNavResolver(store: store, filter: filter, pageWordsProvider: pageWordsProvider).snapshot(
            key: QiraatNavKey(wordID: word.id, refIDs: refs.map(\.id), filter: filter, revision: dataRevision),
            word: word,
            refs: refs
        )
    }

    /// Rebuilds `nav` when one of its inputs changed (no-op when `selectWord` already did).
    private func refreshNav() {
        guard nav.key != navKey else { return }
        let snapshot = makeNav(word: currentWord, refs: activeRefs)
        withMotion { nav = snapshot }
    }

    private var currentItem: QiraatWordSelection {
        QiraatWordSelection(word: currentWord, selection: currentSelection)
    }

    private var currentRef: MarkedWordRef {
        MarkedWordRef(word: currentWord)
    }

    /// The header glyph is drawn at the size it was loaded at (40 pt) and follows the title metric up to 72 pt.
    private func scaledWordFont(_ font: CTFont) -> CTFont {
        _ = dynamicTypeSize // Recompute when the SwiftUI Dynamic Type environment changes.
        let baseSize = CTFontGetSize(font)
        let scaledSize = UIFontMetrics(forTextStyle: .title1).scaledValue(for: baseSize)
        return CTFontCreateCopyWithAttributes(font, min(scaledSize, VariantCard.maxWordSize), nil, nil)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    QiraatSheetNavigator(
                        orderedRefs: nav.logicalRefs,
                        currentRef: currentRef,
                        canNavigatePrevious: nav.previous != nil,
                        canNavigateNext: nav.next != nil,
                        onSelectPrevious: navigateToPrevious,
                        onSelectNext: navigateToNext,
                        onSelect: { ref in selectWord(ref.word) }
                    )
                    header
                    sheetActions
#if DEBUG
                    QiraatCardReviewSection(word: currentWord)
#endif
                    if !currentSelection.variants.isEmpty {
                        sectionHeading("الفرش")
                        ForEach(currentSelection.variants) { VariantCard(variant: $0, catalog: catalog, filter: filter) }
                    }
                    if !currentSelection.rulings.isEmpty {
                        sectionHeading("الأصول")
                        ForEach(currentSelection.rulings) { RulingCard(ruling: $0, catalog: catalog, filter: filter) }
                    }
                    if currentSelection.variants.isEmpty && currentSelection.rulings.isEmpty {
                        emptyState
                    }
                    QiraatReportErrorLink(report: QiraatErrorReport(item: currentItem))
                }
                .padding()
            }
            .background(Color(uiColor: .mushafPaper))
            .navigationTitle("القراءات العشر")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("إغلاق", action: onClose).accessibilityIdentifier("qiraat-sheet-close")
                }
            }
        }
        // Right to left whatever the app language: the differing words, reading attributions and
        // scholarly references are Arabic Quranic content. A modal sheet does not inherit the
        // reader's direction, so it is set on the page itself.
        .environment(\.layoutDirection, .rightToLeft)
        .tint(Color(uiColor: .mushafBrown))
        .presentationDetents([.medium, .large], selection: $detent)
        .simultaneousGesture(
            DragGesture(minimumDistance: 25)
                .onEnded { value in
                    let h = value.translation.width
                    let v = value.translation.height
                    guard abs(h) > abs(v) * 1.5 else { return }
                    if h < -30 {
                        // Finger moving left -> next word in Quran RTL reading order
                        navigateToNext()
                    } else if h > 30 {
                        // Finger moving right -> previous word in Quran RTL reading order
                        navigateToPrevious()
                    }
                }
        )
        .task(id: navKey) { refreshNav() }
        .onReceive(NotificationCenter.default.publisher(for: .qiraatPageDidChange)) { note in
            // Pages the previous/next lookup can reach (see `QiraatNavResolver`) feed `nav`.
            if let page = note.userInfo?["page"] as? Int, abs(page - currentWord.page) <= 5 {
                dataRevision += 1
            }
            // Live data for the word's page arrived (a background sync, or a face saved from this card):
            // show it now instead of keeping the selection the card opened with.
            guard pageWordsProvider != nil, note.userInfo?["page"] as? Int == currentWord.page else { return }
            let refreshed = resolvedSelection(for: currentWord)
            if refreshed != currentSelection { withMotion { currentSelection = refreshed } }
        }
        .onChange(of: item.word.id) { _, _ in
            withMotion {
                currentWord = item.word
                currentSelection = item.selection
                currentWordFont = wordFont
                activeRefs = orderedRefs
            }
        }
    }

    /// «الفرش» (the words that differ) and «الأصول» (the rules that colour a word), as VoiceOver headings.
    private func sectionHeading(_ title: LocalizedStringKey) -> some View {
        Text(title)
            .font(.subheadline.bold())
            .foregroundStyle(Color(uiColor: .mushafBrown))
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 4)
            .accessibilityAddTraits(.isHeader)
    }

    private var emptyState: some View {
        VStack(spacing: 8) {
            Image(systemName: "checkmark.seal")
                .scaledFont(size: 36, relativeTo: .largeTitle)
                .foregroundStyle(Color(uiColor: .mushafBrown))
            Text("لا خلاف في هذه الكلمة")
                .font(.headline)
                .foregroundStyle(Color(uiColor: .mushafBrown))
            Text("متفق عليها بين القراء العشرة ورواتهم")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 32)
        .accessibilityIdentifier("qiraat-sheet-empty-state")
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                if let currentWordFont {
                    // The exact Mushaf glyph, in its own page's font.
                    Text(verbatim: currentWord.glyph)
                        .font(Font(scaledWordFont(currentWordFont)))
                        .foregroundStyle(Color(uiColor: .mushafInk))
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                        .allowsTightening(true)
                        .layoutPriority(1)
                        // The QCF glyph is a private-use code point VoiceOver cannot pronounce; read the word itself.
                        .accessibilityLabel(Text(verbatim: currentWord.textUthmani))
                        .accessibilityAddTraits(.isHeader)
                } else {
                    Text(verbatim: currentWord.textUthmani).scaledFont(size: 30, weight: .bold)
                }
                Spacer()
                Text(verbatim: currentWord.ayahKey.description)
                    .font(.caption.bold()).foregroundStyle(.secondary)
                    .environment(\.layoutDirection, .leftToRight)
            }
            QiraatSyncStatusView(status: syncStatus)
        }
        .padding(.bottom, 4)
        .overlay(alignment: .bottom) { Divider() }
    }

    private var sheetActions: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 8) {
                compareLink
                Spacer(minLength: 0)
                QiraatNoteButton(word: currentWord)
            }
            VStack(alignment: .leading, spacing: 4) {
                compareLink
                QiraatNoteButton(word: currentWord)
            }
        }
    }

    private var compareLink: some View {
        NavigationLink {
            QiraatCompareView(item: currentItem, store: store, catalog: catalog)
        } label: {
            Label("قارن", systemImage: "rectangle.split.2x1")
                .font(.body.bold())
                .frame(minWidth: 44, minHeight: 44)
                .contentShape(Rectangle())
        }
        .accessibilityIdentifier("qiraat-compare-open")
    }

    private var syncStatus: QiraatSyncStatus {
        let state = liveSync.pageState(for: currentWord.page)
        return QiraatSyncStatus.make(
            outcome: state.latestOutcome,
            lastSuccess: state.lastConfirmation,
            now: Date(),
            isOffline: false
        )
    }

    private func navigateToPrevious() {
        if let prev = nav.previous {
            selectWord(prev)
        }
    }

    private func navigateToNext() {
        if let next = nav.next {
            selectWord(next)
        }
    }

    private func loadRefs(for pageNumber: Int) -> [MarkedWordRef] {
        guard let store else { return [] }
        let pWords = pageWordsProvider?(pageNumber) ?? []
        guard !pWords.isEmpty, let pMarks = store.marks(page: pageNumber) else { return [] }
        return QiraatWordOrder.markedWords(pages: [pageNumber], words: pWords, marks: pMarks, filter: filter)
    }

    /// What the Qiraat data says about `word` under the active filter (empty when it has nothing).
    private func resolvedSelection(for word: MushafWord) -> QiraatSelection {
        guard let store else { return QiraatSelection(variants: [], rulings: []) }
        let ctx = WordContextIndex.shared.resolveSync(
            page: word.page,
            filter: filter,
            qiraatStore: store,
            pageWords: pageWordsProvider?(word.page) ?? []
        )
        let wordCtx = ctx.words[word.id]
        return QiraatSelection(variants: wordCtx?.variants ?? [], rulings: wordCtx?.rulings ?? [])
    }

    private func selectWord(_ word: MushafWord) {
        let newSelection = resolvedSelection(for: word)

        let newFont = (word.page == currentWord.page) ? currentWordFont : (fontProvider?(word.page) ?? currentWordFont)
        let pageChanged = word.page != currentWord.page
        let newRefs = pageChanged ? loadRefs(for: word.page) : activeRefs
        let newNav = makeNav(word: word, refs: newRefs)

        withMotion {
            nav = newNav
            currentWord = word
            currentSelection = newSelection
            currentWordFont = newFont
            if pageChanged {
                activeRefs = newRefs
            }
        }

        onWordChanged?(word)

        // Clean up obsolete requests and prefetch neighbouring pages
        WordContextIndex.shared.cancelObsolete(around: word.page)
        if let store {
            WordContextIndex.shared.prefetch(
                pages: [word.page - 1, word.page + 1],
                filter: filter,
                qiraatStore: store,
                wordsMap: [
                    word.page - 1: pageWordsProvider?(word.page - 1) ?? [],
                    word.page + 1: pageWordsProvider?(word.page + 1) ?? []
                ]
            )
        }
    }
}

/// Identifies the inputs a `QiraatNavSnapshot` was built from.
private struct QiraatNavKey: Hashable {
    let wordID: MushafWord.ID
    let refIDs: [MarkedWordRef.ID]
    let filter: QiraatFilter
    let revision: Int
}

/// The span-merged refs and the previous/next navigation targets for one word.
private struct QiraatNavSnapshot {
    let key: QiraatNavKey
    let logicalRefs: [MarkedWordRef]
    let previous: MushafWord?
    let next: MushafWord?
}

/// Pure computation of `QiraatNavSnapshot`. Page words and page contexts are memoised for the
/// lifetime of one resolver (one recompute pass), so a page is resolved at most once per pass.
private final class QiraatNavResolver {
    private let store: QiraatStore?
    private let filter: QiraatFilter
    private let pageWordsProvider: ((Int) -> [MushafWord])?
    private var wordsByPage: [Int: [MushafWord]] = [:]
    private var contextByPage: [Int: PageWordContext] = [:]

    init(store: QiraatStore?, filter: QiraatFilter, pageWordsProvider: ((Int) -> [MushafWord])?) {
        self.store = store
        self.filter = filter
        self.pageWordsProvider = pageWordsProvider
    }

    func snapshot(key: QiraatNavKey, word: MushafWord, refs: [MarkedWordRef]) -> QiraatNavSnapshot {
        let current = MarkedWordRef(word: word)
        return QiraatNavSnapshot(
            key: key,
            logicalRefs: logicalRefs(refs),
            previous: previousLogicalWord(before: current, refs: refs),
            next: nextLogicalWord(after: current, refs: refs)
        )
    }

    private func pageWords(_ page: Int) -> [MushafWord] {
        if let cached = wordsByPage[page] { return cached }
        let words = pageWordsProvider?(page) ?? []
        wordsByPage[page] = words
        return words
    }

    private func context(page: Int, store: QiraatStore) -> PageWordContext {
        if let cached = contextByPage[page] { return cached }
        let ctx = WordContextIndex.shared.resolveSync(
            page: page,
            filter: filter,
            qiraatStore: store,
            pageWords: pageWords(page)
        )
        contextByPage[page] = ctx
        return ctx
    }

    private func logicalRefs(_ refs: [MarkedWordRef]) -> [MarkedWordRef] {
        var result: [MarkedWordRef] = []
        for ref in refs {
            if let last = result.last, isSameLogicalSpan(wordA: last.word, wordB: ref.word) {
                continue
            }
            result.append(ref)
        }
        return result
    }

    private func isSameLogicalSpan(wordA: MushafWord, wordB: MushafWord) -> Bool {
        guard wordA.ayahKey == wordB.ayahKey, let store else { return false }
        let ctx = context(page: wordA.page, store: store)
        guard let ctxA = ctx.words[wordA.id], let ctxB = ctx.words[wordB.id] else { return false }
        let hasSharedSpanVariant = ctxA.variants.contains { v in
            v.endToken > v.startToken && ctxB.variants.contains(where: { $0.id == v.id })
        }
        let hasSharedSpanRuling = ctxA.rulings.contains { r in
            r.endToken > r.startToken && ctxB.rulings.contains(where: { $0.id == r.id })
        }
        guard hasSharedSpanVariant || hasSharedSpanRuling else { return false }
        let extraVariants = ctxB.variants.filter { !ctxA.variants.contains($0) }
        let extraRulings = ctxB.rulings.filter { !ctxA.rulings.contains($0) }
        return extraVariants.isEmpty && extraRulings.isEmpty
    }

    private func nextLogicalWord(after currentRef: MarkedWordRef, refs: [MarkedWordRef]) -> MushafWord? {
        guard let currentIndex = refs.firstIndex(where: { $0.id == currentRef.id }) else {
            return refs.first(where: { !QiraatWordOrder.comesBefore($0.word, currentRef.word) })?.word
        }
        var nextIndex = currentIndex + 1
        while nextIndex < refs.count {
            let candidate = refs[nextIndex].word
            if isSameLogicalSpan(wordA: currentRef.word, wordB: candidate) {
                nextIndex += 1
            } else {
                return candidate
            }
        }
        return findNextPageMarkedWord(afterPage: currentRef.word.page)
    }

    private func previousLogicalWord(before currentRef: MarkedWordRef, refs: [MarkedWordRef]) -> MushafWord? {
        guard let currentIndex = refs.firstIndex(where: { $0.id == currentRef.id }) else {
            return refs.last(where: { QiraatWordOrder.comesBefore($0.word, currentRef.word) })?.word
        }
        var prevIndex = currentIndex - 1
        while prevIndex >= 0 {
            let candidate = refs[prevIndex].word
            if prevIndex > 0 && isSameLogicalSpan(wordA: refs[prevIndex - 1].word, wordB: candidate) {
                prevIndex -= 1
            } else {
                return candidate
            }
        }
        return findPreviousPageMarkedWord(beforePage: currentRef.word.page)
    }

    private func findPreviousPageMarkedWord(beforePage: Int) -> MushafWord? {
        guard beforePage > 1, let store else { return nil }
        for p in stride(from: beforePage - 1, through: max(1, beforePage - 5), by: -1) {
            let pWords = pageWords(p)
            guard !pWords.isEmpty, let pMarks = store.marks(page: p) else { continue }
            let refs = QiraatWordOrder.markedWords(pages: [p], words: pWords, marks: pMarks, filter: filter)
            if let last = refs.last {
                return last.word
            }
        }
        return nil
    }

    private func findNextPageMarkedWord(afterPage: Int) -> MushafWord? {
        guard afterPage < mushafPageCount, let store else { return nil }
        for p in (afterPage + 1)...min(mushafPageCount, afterPage + 5) {
            let pWords = pageWords(p)
            guard !pWords.isEmpty, let pMarks = store.marks(page: p) else { continue }
            let refs = QiraatWordOrder.markedWords(pages: [p], words: pWords, marks: pMarks, filter: filter)
            if let first = refs.first {
                return first.word
            }
        }
        return nil
    }
}
