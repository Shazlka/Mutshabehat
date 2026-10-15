import CoreText
import MushafCore
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
                        orderedRefs: activeRefs,
                        currentRef: currentRef,
                        canNavigatePrevious: canNavigatePrevious,
                        canNavigateNext: canNavigateNext,
                        onSelectPrevious: navigateToPrevious,
                        onSelectNext: navigateToNext,
                        onSelect: { ref in selectWord(ref.word) }
                    )
                    header
                    sheetActions
                    if !currentSelection.variants.isEmpty {
                        sectionHeading("الفرش")
                        ForEach(currentSelection.variants) { VariantCard(variant: $0, catalog: catalog, filter: filter) }
                    }
                    if !currentSelection.rulings.isEmpty {
                        sectionHeading("الأصول")
                        ForEach(currentSelection.rulings) { RulingCard(ruling: $0, catalog: catalog) }
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
                .font(.system(size: 36))
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

    private var canNavigatePrevious: Bool {
        if activeRefs.previous(before: currentRef) != nil { return true }
        return findPreviousPageMarkedWord(beforePage: currentWord.page) != nil
    }

    private var canNavigateNext: Bool {
        if activeRefs.next(after: currentRef) != nil { return true }
        return findNextPageMarkedWord(afterPage: currentWord.page) != nil
    }

    private func navigateToPrevious() {
        if let prev = activeRefs.previous(before: currentRef) {
            selectWord(prev.word)
        } else if let prevWord = findPreviousPageMarkedWord(beforePage: currentWord.page) {
            selectWord(prevWord)
        }
    }

    private func navigateToNext() {
        if let next = activeRefs.next(after: currentRef) {
            selectWord(next.word)
        } else if let nextWord = findNextPageMarkedWord(afterPage: currentWord.page) {
            selectWord(nextWord)
        }
    }

    private func findPreviousPageMarkedWord(beforePage: Int) -> MushafWord? {
        guard beforePage > 1, let store else { return nil }
        for p in stride(from: beforePage - 1, through: max(1, beforePage - 5), by: -1) {
            let pWords = pageWordsProvider?(p) ?? []
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
            let pWords = pageWordsProvider?(p) ?? []
            guard !pWords.isEmpty, let pMarks = store.marks(page: p) else { continue }
            let refs = QiraatWordOrder.markedWords(pages: [p], words: pWords, marks: pMarks, filter: filter)
            if let first = refs.first {
                return first.word
            }
        }
        return nil
    }

    private func loadRefs(for pageNumber: Int) -> [MarkedWordRef] {
        guard let store else { return [] }
        let pWords = pageWordsProvider?(pageNumber) ?? []
        guard !pWords.isEmpty, let pMarks = store.marks(page: pageNumber) else { return [] }
        return QiraatWordOrder.markedWords(pages: [pageNumber], words: pWords, marks: pMarks, filter: filter)
    }

    private func selectWord(_ word: MushafWord) {
        let pWords = pageWordsProvider?(word.page) ?? []
        let newSelection: QiraatSelection
        if let store {
            let ctx = WordContextIndex.shared.resolveSync(
                page: word.page,
                filter: filter,
                qiraatStore: store,
                pageWords: pWords
            )
            let wordCtx = ctx.words[word.id]
            newSelection = QiraatSelection(
                variants: wordCtx?.variants ?? [],
                rulings: wordCtx?.rulings ?? []
            )
        } else {
            newSelection = QiraatSelection(variants: [], rulings: [])
        }

        let newFont = (word.page == currentWord.page) ? currentWordFont : (fontProvider?(word.page) ?? currentWordFont)
        let pageChanged = word.page != currentWord.page
        let newRefs = pageChanged ? loadRefs(for: word.page) : activeRefs

        withMotion {
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
