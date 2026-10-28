import MushafCore
import SwiftUI
import UIKit

/// «المتون» (المزيد): الشاطبية، الدرة وطيبة النشر in full, by book and chapter, with a search over all three. The
/// verses are quotations from the books, so they are set in a plain Arabic face, never the Mushaf fonts. Laid out
/// right to left. Each verse is a clickable card styled like the variant cards, showing highlighted reader and narrator
/// symbols, authority pills, and opening a card with the full scholarly commentary (شرح) and verse navigation.
struct MutoonView: View {
    let initialLibrary: MatnLibrary
    var catalog: QiraatCatalog? = nil
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @AppStorage(MatnSymbolSettings.key) private var showsSymbols = true
    @State private var selectedHit: MatnSearchHit?
    @State private var liveLibrary: MatnLibrary?

    var library: MatnLibrary { liveLibrary ?? initialLibrary }

    init(library: MatnLibrary, catalog: QiraatCatalog? = nil) {
        self.initialLibrary = library
        self.catalog = catalog
    }

    var body: some View {
        NavigationStack {
            // The field sits above the list, not in a safe-area inset of it: swapping the books list for the results
            // must not rebuild the field, or it drops the keyboard after the first letter. It is a field of its own,
            // not the system search bar, which hides «إغلاق» while it is active.
            VStack(spacing: 0) {
                if !library.isEmpty { searchField }
                if showsSymbols, !library.symbols.isEmpty { MatnSymbolKey().padding(.horizontal, 16).padding(.vertical, 6) }
                Group {
                    if library.isEmpty {
                        ContentUnavailableView {
                            Label("المتون غير مضمّنة في هذه النسخة", systemImage: "books.vertical")
                        } description: {
                            Text("تُضاف المتون عند بناء التطبيق من نسختك من الكتب.")
                        }
                        .accessibilityIdentifier("mutoon-empty")
                    } else if query.trimmingCharacters(in: .whitespaces).isEmpty {
                        works
                    } else {
                        results
                    }
                }
                .frame(maxHeight: .infinity)
            }
            .navigationTitle(Text("المتون"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { dismiss() } label: { Text("إغلاق") }
                        .accessibilityIdentifier("mutoon-close")
                }
                if !library.symbols.isEmpty {
                    ToolbarItem(placement: .primaryAction) { MatnSymbolToggle() }
                }
            }
            .navigationDestination(for: QiraatMatn.self) { work in
                if let work = library.work(work) {
                    MatnChaptersView(work: work, symbols: library.symbols, sharh: library.sharh, catalog: catalog)
                }
            }
        }
        .sheet(item: $selectedHit) { hit in
            MatnVerseSheet(
                work: hit.work,
                chapterTitle: hit.chapter,
                allVerses: [hit.verse],
                initialVerse: hit.verse,
                symbols: library.symbols,
                sharh: library.sharh,
                catalog: catalog
            )
        }
        // Right to left whatever the app language: every title, chapter and verse here is Arabic. A full-screen
        // cover does not inherit the reader's direction, so it is set on the page itself.
        .environment(\.layoutDirection, .rightToLeft)
        .task {
            if let synced = await QiraatLiveSync.shared.syncMutoon() {
                withAnimation(.easeInOut(duration: 0.2)) {
                    liveLibrary = synced
                }
            }
        }
        .refreshable {
            if let synced = await QiraatLiveSync.shared.syncMutoon() {
                liveLibrary = synced
            }
        }
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass").foregroundStyle(.secondary).accessibilityHidden(true)
            TextField(text: $query) { Text("ابحث في المتون أو اكتب رقم البيت") }
                .textFieldStyle(.plain)
                .submitLabel(.search)
                .accessibilityIdentifier("mutoon-search-field")
            if !query.isEmpty {
                Button { query = "" } label: {
                    Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary)
                        .frame(minWidth: 44, minHeight: 44)
                }
                .accessibilityLabel(Text("مسح البحث"))
                .accessibilityIdentifier("mutoon-search-clear")
            }
        }
        .padding(.horizontal, 12)
        .frame(minHeight: 44)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(uiColor: .secondarySystemBackground)))
        .padding(.horizontal, 16)
        .padding(.vertical, 6)
        .background(.bar)
    }

    private var works: some View {
        List(library.works, id: \.work) { work in
            NavigationLink(value: work.work) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(verbatim: work.title).font(.headline)
                    Text(verbatim: work.author).font(.subheadline).foregroundStyle(.secondary)
                    Text("\(mutoonNumber(work.verseCount)) بيتًا").font(.caption).foregroundStyle(.secondary)
                }
                .padding(.vertical, 4)
            }
            .accessibilityIdentifier("mutoon-work-\(work.work.rawValue)")
        }
    }

    private var results: some View {
        let hits = library.search(query)
        return List {
            if hits.isEmpty {
                Text("لا نتائج").foregroundStyle(.secondary)
                    .listRowBackground(Color.clear)
            }
            ForEach(hits) { hit in
                MatnVerseCard(
                    work: hit.work,
                    chapterTitle: hit.chapter,
                    verse: hit.verse,
                    marks: library.symbols.marks(hit.work, verse: hit.verse.number),
                    sharh: library.sharh.sharh(for: hit.work, verse: hit.verse.number),
                    catalog: catalog,
                    onTapVerse: { selectedHit = hit }
                )
                .listRowSeparator(.hidden)
                .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                .listRowBackground(Color.clear)
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("mutoon-search-result")
            }
        }
        .listStyle(.plain)
    }
}

/// A book's chapters, each opening its verses.
private struct MatnChaptersView: View {
    let work: MatnWork
    let symbols: MatnSymbolLayer
    let sharh: MatnSharhStore
    let catalog: QiraatCatalog?

    var body: some View {
        List(Array(work.chapters.enumerated()), id: \.offset) { index, chapter in
            NavigationLink {
                MatnChapterView(work: work.work, chapter: chapter, symbols: symbols, sharh: sharh, catalog: catalog)
            } label: {
                VStack(alignment: .leading, spacing: 2) {
                    Text(verbatim: chapter.title).font(.body)
                    if let first = chapter.verses.first, let last = chapter.verses.last {
                        Text("الأبيات \(mutoonNumber(first.number))–\(mutoonNumber(last.number))").font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
            .accessibilityIdentifier("mutoon-chapter-\(index)")
        }
        .navigationTitle(Text(verbatim: work.title))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { if !symbols.isEmpty { ToolbarItem(placement: .primaryAction) { MatnSymbolToggle() } } }
    }
}

/// One chapter's verses in the book's order, each shown as a clickable card like a variant card.
private struct MatnChapterView: View {
    let work: QiraatMatn
    let chapter: MatnChapter
    let symbols: MatnSymbolLayer
    let sharh: MatnSharhStore
    let catalog: QiraatCatalog?

    @AppStorage(MatnSymbolSettings.key) private var showsSymbols = true
    @State private var selectedVerse: MatnVerse?

    var body: some View {
        List {
            if showsSymbols, chapter.verses.contains(where: { !symbols.marks(work, verse: $0.number).isEmpty }) {
                MatnSymbolKey()
                    .listRowSeparator(.hidden)
                    .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                    .listRowBackground(Color.clear)
            }
            ForEach(chapter.verses) { verse in
                MatnVerseCard(
                    work: work,
                    chapterTitle: nil,
                    verse: verse,
                    marks: symbols.marks(work, verse: verse.number),
                    sharh: sharh.sharh(for: work, verse: verse.number),
                    catalog: catalog,
                    onTapVerse: { selectedVerse = verse }
                )
                .listRowSeparator(.hidden)
                .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                .listRowBackground(Color.clear)
            }
        }
        .listStyle(.plain)
        .navigationTitle(Text(verbatim: chapter.title))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { if !symbols.isEmpty { ToolbarItem(placement: .primaryAction) { MatnSymbolToggle() } } }
        .sheet(item: $selectedVerse) { verse in
            MatnVerseSheet(
                work: work,
                chapterTitle: chapter.title,
                allVerses: chapter.verses,
                initialVerse: verse,
                symbols: symbols,
                sharh: sharh,
                catalog: catalog
            )
        }
    }
}

/// One verse card styled like a variant card: book / chapter / verse classification line, prominent Arabic text with
/// highlighted reader/narrator symbols, authority pills for who is named, and a tap action opening the verse's شرح.
struct MatnVerseCard: View {
    let work: QiraatMatn
    var chapterTitle: String? = nil
    let verse: MatnVerse
    var marks: [MatnSymbolAnnotation] = []
    var sharh: (title: String, author: String, entry: MatnSharhEntry)? = nil
    var catalog: QiraatCatalog? = nil
    let onTapVerse: () -> Void

    @AppStorage(MatnSymbolSettings.key) private var showsSymbols = true
    @State private var shownSymbol: MatnSymbolAnnotation?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // 1. Classification line
            HStack(spacing: 6) {
                Text(verbatim: work.labelAr)
                    .font(.caption.bold())
                    .foregroundStyle(Color(uiColor: .mushafBrown))
                if let chapterTitle {
                    Text(verbatim: "·")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(verbatim: chapterTitle)
                        .font(.caption)
                        .foregroundStyle(Color(uiColor: .mushafBrown))
                        .lineLimit(1)
                }
                Text(verbatim: "·")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text("البيت \(mutoonNumber(verse.number))")
                    .font(.caption.bold().monospacedDigit())
                    .foregroundStyle(Color(uiColor: .mushafBrown))
                    .accessibilityIdentifier("mutoon-verse-\(verse.number)")

                Spacer()

                if let page = verse.printedPage, !page.isEmpty {
                    Text("ص \(mutoonDigits(page))")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            // 2. Verse lines (with red symbols)
            VStack(alignment: .leading, spacing: 4) {
                ForEach(Array(verse.lines.enumerated()), id: \.offset) { index, line in
                    MatnLineText(
                        line: line,
                        marks: visibleMarks.filter { $0.line == index },
                        onTapSymbol: { shownSymbol = $0 },
                        onTapLine: onTapVerse
                    )
                    .accessibilityIdentifier("mutoon-line-\(verse.number)-\(index)")
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            // 3. Highlighted readers and narrators pills on each بيت
            let readingIds = Array(Set(visibleMarks.flatMap(\.readingIds))).sorted()
            let pills = MatnSymbols.authorityPills(for: readingIds, catalog: catalog)
            if !pills.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("القراء والرواة:")
                        .font(.caption2.bold())
                        .foregroundStyle(Color(uiColor: .mushafBrown))
                    QiraatPills(pills: pills)
                }
                .padding(.top, 2)
                .accessibilityIdentifier("mutoon-verse-readers-\(verse.number)")
            }

            // 4. Sharh hint / action row
            Button(action: onTapVerse) {
                HStack(spacing: 6) {
                    if sharh != nil {
                        Label {
                            Text("الشرح متاح")
                        } icon: {
                            Image(systemName: "book.pages")
                        }
                        .font(.caption2)
                        .foregroundStyle(Color(uiColor: .mushafBrown))
                    }
                    Spacer()
                    HStack(spacing: 3) {
                        Text("عرض البيت والشرح")
                            .font(.caption2.bold())
                        Image(systemName: "chevron.left")
                            .font(.caption2.bold())
                    }
                    .foregroundStyle(Color(uiColor: .mushafBrown))
                }
            }
            .buttonStyle(.plain)
            .padding(.top, 2)
            .accessibilityIdentifier("mutoon-verse-action-\(verse.number)")
        }
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(.qiraatCardFill)
                .onTapGesture { onTapVerse() }
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(.qiraatCardStroke)
                .allowsHitTesting(false)
        )
        .sheet(item: $shownSymbol) { mark in
            MatnSymbolCard(mark: mark)
        }
    }

    private var visibleMarks: [MatnSymbolAnnotation] { showsSymbols ? marks : [] }
}

/// The detail sheet shown when tapping a verse card: navigation between verses, the verse card in full styling,
/// its classical commentary (الوافي or الهادي), and a breakdown of its reader and narrator symbols.
struct MatnVerseSheet: View {
    let work: QiraatMatn
    var chapterTitle: String? = nil
    let allVerses: [MatnVerse]
    @State var currentVerse: MatnVerse
    let symbols: MatnSymbolLayer
    let sharh: MatnSharhStore
    let catalog: QiraatCatalog?

    @Environment(\.dismiss) private var dismiss
    @AppStorage(MatnSymbolSettings.key) private var showsSymbols = true
    @State private var shownSymbol: MatnSymbolAnnotation?

    init(work: QiraatMatn, chapterTitle: String? = nil, allVerses: [MatnVerse], initialVerse: MatnVerse,
         symbols: MatnSymbolLayer, sharh: MatnSharhStore, catalog: QiraatCatalog? = nil) {
        self.work = work
        self.chapterTitle = chapterTitle
        self.allVerses = allVerses
        self._currentVerse = State(initialValue: initialVerse)
        self.symbols = symbols
        self.sharh = sharh
        self.catalog = catalog
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if allVerses.count > 1 {
                        navigator
                    }

                    // 1. The Verse Card
                    verseCard

                    // 2. The Sharh (Commentary) Card
                    sharhCard

                    // 3. The Symbols breakdown
                    if !currentMarks.isEmpty {
                        symbolsBreakdown
                    }
                }
                .padding()
            }
            .background(Color(uiColor: .mushafPaper))
            .navigationTitle(Text(verbatim: work.labelAr))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { dismiss() } label: { Text("إغلاق") }
                        .accessibilityIdentifier("mutoon-verse-sheet-close")
                }
            }
        }
        .environment(\.layoutDirection, .rightToLeft)
        .presentationDetents([.medium, .large])
        .sheet(item: $shownSymbol) { mark in
            MatnSymbolCard(mark: mark)
        }
        .simultaneousGesture(
            DragGesture(minimumDistance: 30)
                .onEnded { value in
                    let h = value.translation.width
                    let v = value.translation.height
                    guard abs(h) > abs(v) * 1.5 else { return }
                    if h < -30 {
                        // In RTL, dragging left advances to next verse
                        navigateToNext()
                    } else if h > 30 {
                        // Dragging right goes to previous verse
                        navigateToPrevious()
                    }
                }
        )
        .accessibilityIdentifier("mutoon-verse-sheet")
    }

    private var currentIndex: Int {
        allVerses.firstIndex(where: { $0.number == currentVerse.number }) ?? 0
    }

    private var canNavigatePrevious: Bool { currentIndex > 0 }
    private var canNavigateNext: Bool { currentIndex < allVerses.count - 1 }

    private func navigateToPrevious() {
        guard canNavigatePrevious else { return }
        currentVerse = allVerses[currentIndex - 1]
    }

    private func navigateToNext() {
        guard canNavigateNext else { return }
        currentVerse = allVerses[currentIndex + 1]
    }

    private var currentMarks: [MatnSymbolAnnotation] {
        showsSymbols ? symbols.marks(work, verse: currentVerse.number) : []
    }

    private var navigator: some View {
        HStack {
            Button(action: navigateToPrevious) {
                HStack(spacing: 4) {
                    Image(systemName: "chevron.right")
                    Text("البيت السابق")
                }
                .font(.caption.bold())
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Capsule().fill(Color(uiColor: .secondarySystemBackground)))
            }
            .disabled(!canNavigatePrevious)
            .opacity(canNavigatePrevious ? 1 : 0.35)
            .accessibilityIdentifier("mutoon-verse-sheet-prev")

            Spacer()

            Text("البيت \(mutoonNumber(currentVerse.number)) من \(mutoonNumber(allVerses.count))")
                .font(.caption.bold().monospacedDigit())
                .foregroundStyle(Color(uiColor: .mushafBrown))

            Spacer()

            Button(action: navigateToNext) {
                HStack(spacing: 4) {
                    Text("البيت التالي")
                    Image(systemName: "chevron.left")
                }
                .font(.caption.bold())
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Capsule().fill(Color(uiColor: .secondarySystemBackground)))
            }
            .disabled(!canNavigateNext)
            .opacity(canNavigateNext ? 1 : 0.35)
            .accessibilityIdentifier("mutoon-verse-sheet-next")
        }
        .padding(.horizontal, 2)
    }

    private var verseCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Text(verbatim: work.labelAr)
                    .font(.caption.bold())
                    .foregroundStyle(Color(uiColor: .mushafBrown))
                if let chapterTitle {
                    Text(verbatim: "·")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(verbatim: chapterTitle)
                        .font(.caption)
                        .foregroundStyle(Color(uiColor: .mushafBrown))
                }
                Text(verbatim: "·")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text("البيت \(mutoonNumber(currentVerse.number))")
                    .font(.caption.bold().monospacedDigit())
                    .foregroundStyle(Color(uiColor: .mushafBrown))

                Spacer()

                if let page = currentVerse.printedPage, !page.isEmpty {
                    Text("ص \(mutoonDigits(page))")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            VStack(alignment: .leading, spacing: 6) {
                ForEach(Array(currentVerse.lines.enumerated()), id: \.offset) { index, line in
                    MatnLineText(
                        line: line,
                        marks: currentMarks.filter { $0.line == index },
                        onTapSymbol: { shownSymbol = $0 }
                    )
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            let readingIds = Array(Set(currentMarks.flatMap(\.readingIds))).sorted()
            let pills = MatnSymbols.authorityPills(for: readingIds, catalog: catalog)
            if !pills.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("القراء والرواة:")
                        .font(.caption2.bold())
                        .foregroundStyle(Color(uiColor: .mushafBrown))
                    QiraatPills(pills: pills)
                }
                .padding(.top, 4)
            }
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 10).fill(.qiraatCardFill))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(.qiraatCardStroke))
    }

    private var sharhCard: some View {
        let entry = sharh.sharh(for: work, verse: currentVerse.number)
        return VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: "book.closed.fill")
                    .foregroundStyle(Color(uiColor: .mushafBrown))
                Text(verbatim: entry?.title ?? (work == .durrah ? "الدرة المضية" : "الشرح"))
                    .font(.subheadline.bold())
                    .foregroundStyle(Color(uiColor: .mushafBrown))
                if let author = entry?.author, !author.isEmpty {
                    Text(verbatim: "· \(author)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Spacer()
                if let pages = entry?.entry.pages, !pages.isEmpty {
                    Text("ص \(mutoonDigits(pages.joined(separator: "، ")))")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            Divider()

            if let text = entry?.entry.text, !text.isEmpty {
                Text(verbatim: text)
                    .font(.body)
                    .lineSpacing(6)
                    .foregroundStyle(.primary)
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityIdentifier("mutoon-verse-sheet-sharh-text")
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    Label {
                        Text("لا يتوفر شرح لهذا البيت في المرجع المضمّن")
                    } icon: {
                        Image(systemName: "info.circle")
                    }
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                    if work == .durrah {
                        Text("منظومة الدرة تعتمد أصولها على الشاطبية وفرشها على ما خالف أصله، ولم يُضمَّن لها شرح مستقل في التطبيق حالياً.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 4)
                .accessibilityIdentifier("mutoon-verse-sheet-sharh-empty")
            }
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 10).fill(.qiraatCardFill))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(.qiraatCardStroke))
    }

    private var symbolsBreakdown: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("الرموز والدلالات في هذا البيت")
                .font(.caption.bold())
                .foregroundStyle(Color(uiColor: .mushafBrown))

            ForEach(currentMarks) { mark in
                Button {
                    shownSymbol = mark
                } label: {
                    HStack(spacing: 10) {
                        Text(verbatim: mark.text)
                            .font(.system(.title3, design: .serif).bold())
                            .foregroundStyle(MatnSymbolSettings.red)
                            .frame(minWidth: 28)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(verbatim: mark.definition?.namesAr ?? mark.text)
                                .font(.subheadline.bold())
                                .foregroundStyle(Color(uiColor: .mushafInk))
                            if let reader = mark.definition?.readerAr {
                                Text("القارئ: \(reader)")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                            if !mark.note.isEmpty {
                                Text(verbatim: mark.note)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                        }

                        Spacer()

                        Image(systemName: "chevron.left")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    .padding(8)
                    .background(RoundedRectangle(cornerRadius: 8).fill(Color(uiColor: .secondarySystemBackground).opacity(0.5)))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 10).fill(.qiraatCardFill))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(.qiraatCardStroke))
    }
}

/// Backwards-compatible row adapter wrapping `MatnVerseCard`.
struct MatnVerseRow: View {
    let verse: MatnVerse
    var marks: [MatnSymbolAnnotation] = []

    var body: some View {
        MatnVerseCard(
            work: marks.first?.work ?? .shatibiyyah,
            chapterTitle: nil,
            verse: verse,
            marks: marks,
            sharh: nil,
            catalog: nil,
            onTapVerse: {}
        )
    }
}

/// One hemistich, selectable for copying, with its marks red and tappable. A text view, not a SwiftUI `Text`: its links
/// answer a tap where the letter is drawn in right-to-left text, alongside selection. Only the colour of the marked
/// letters changes, so the words keep their joining and their marks.
private struct MatnLineText: UIViewRepresentable {
    let line: String
    let marks: [MatnSymbolAnnotation]
    let onTapSymbol: (MatnSymbolAnnotation) -> Void
    var onTapLine: (() -> Void)? = nil

    func makeUIView(context: Context) -> UITextView {
        let view = UITextView()
        view.isEditable = false
        view.isSelectable = true
        view.isScrollEnabled = false
        view.backgroundColor = .clear
        view.textContainerInset = .zero
        view.textContainer.lineFragmentPadding = 0
        view.adjustsFontForContentSizeCategory = true
        view.semanticContentAttribute = .forceRightToLeft
        view.linkTextAttributes = [.foregroundColor: UIColor.systemRed]
        view.delegate = context.coordinator
        view.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)

        let tapRecognizer = UITapGestureRecognizer(target: context.coordinator, action: #selector(context.coordinator.handleTap(_:)))
        tapRecognizer.delegate = context.coordinator
        view.addGestureRecognizer(tapRecognizer)
        context.coordinator.textView = view

        return view
    }

    func updateUIView(_ view: UITextView, context: Context) {
        context.coordinator.parent = self
        context.coordinator.textView = view
        let paragraph = NSMutableParagraphStyle()
        paragraph.alignment = .natural
        paragraph.baseWritingDirection = .rightToLeft
        let base = UIFont.preferredFont(forTextStyle: .body)
        let font = base.fontDescriptor.withDesign(.serif).map { UIFont(descriptor: $0, size: 0) } ?? base
        let text = NSMutableAttributedString(string: line, attributes: [
            .font: font, .foregroundColor: UIColor.label, .paragraphStyle: paragraph,
        ])
        let characters = Array(line)
        for (number, mark) in marks.enumerated() where mark.end <= characters.count {
            let start = line.index(line.startIndex, offsetBy: mark.start)
            let end = line.index(line.startIndex, offsetBy: mark.end)
            if let url = URL(string: "\(MatnSymbolSettings.scheme)://\(number)") {
                text.addAttribute(.link, value: url, range: NSRange(start..<end, in: line))
            }
        }
        if view.attributedText != text { view.attributedText = text }
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView: UITextView, context: Context) -> CGSize? {
        let width = proposal.width ?? 320
        let fitted = uiView.sizeThatFits(CGSize(width: width, height: .greatestFiniteMagnitude))
        return CGSize(width: width, height: ceil(fitted.height))
    }

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

    final class Coordinator: NSObject, UITextViewDelegate, UIGestureRecognizerDelegate {
        var parent: MatnLineText
        weak var textView: UITextView?

        init(parent: MatnLineText) { self.parent = parent }

        @objc func handleTap(_ gesture: UITapGestureRecognizer) {
            guard let tv = textView else {
                parent.onTapLine?()
                return
            }
            let location = gesture.location(in: tv)
            let charIndex = tv.layoutManager.characterIndex(for: location, in: tv.textContainer, fractionOfDistanceBetweenInsertionPoints: nil)
            if charIndex < tv.textStorage.length {
                let link = tv.textStorage.attribute(.link, at: charIndex, effectiveRange: nil)
                if link != nil { return }
            }
            parent.onTapLine?()
        }

        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
            true
        }

        func textView(_ textView: UITextView, primaryActionFor textItem: UITextItem, defaultAction: UIAction) -> UIAction? {
            guard case let .link(url) = textItem.content, url.scheme == MatnSymbolSettings.scheme,
                  let index = Int(url.host() ?? ""), parent.marks.indices.contains(index) else { return nil }
            let mark = parent.marks[index]
            return UIAction { [weak self] _ in self?.parent.onTapSymbol(mark) }
        }

        /// A long press on a symbol offers no "open link" menu: the symbol is not a web address.
        func textView(_ textView: UITextView, menuConfigurationFor textItem: UITextItem, defaultMenu: UIMenu) -> UITextItem.MenuConfiguration? {
            guard case let .link(url) = textItem.content, url.scheme == MatnSymbolSettings.scheme else {
                return .init(menu: defaultMenu)
            }
            return nil
        }
    }
}

/// The switch for the red symbols and the colour they share.
enum MatnSymbolSettings {
    static let key = "mutoon:symbols:v1"
    static let scheme = "matn-symbol"
    static let red = Color(uiColor: .systemRed)
}

/// «الأحمر: رمز قارئ أو راوٍ — اضغط لمعرفة المقصود».
private struct MatnSymbolKey: View {
    var body: some View {
        HStack(spacing: 6) {
            Circle().fill(MatnSymbolSettings.red).frame(width: 8, height: 8).accessibilityHidden(true)
            Text("الأحمر: رمز قارئ أو راوٍ — اضغط لمعرفة المقصود")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("mutoon-symbols-key")
    }
}

/// Turns the red symbols on and off (kept on this device).
private struct MatnSymbolToggle: View {
    @AppStorage(MatnSymbolSettings.key) private var showsSymbols = true

    var body: some View {
        Toggle(isOn: $showsSymbols) {
            Label { Text("تمييز الرموز") } icon: { Image(systemName: "character.textbox") }
        }
        .accessibilityIdentifier("mutoon-symbols-toggle")
    }
}

/// What a red symbol stands for here, and on what authority.
private struct MatnSymbolCard: View {
    let mark: MatnSymbolAnnotation
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack(spacing: 12) {
                        Text(verbatim: mark.text)
                            .font(.system(.largeTitle, design: .serif))
                            .foregroundStyle(MatnSymbolSettings.red)
                            .accessibilityIdentifier("mutoon-symbol-text")
                        VStack(alignment: .leading, spacing: 2) {
                            kindLabel.font(.caption).foregroundStyle(.secondary)
                            Text(verbatim: mark.definition?.namesAr ?? "")
                                .font(.headline)
                                .accessibilityIdentifier("mutoon-symbol-names")
                        }
                    }
                    .accessibilityElement(children: .combine)
                    if let reader = mark.definition?.readerAr {
                        row(Text("القارئ"), Text(verbatim: reader)).accessibilityIdentifier("mutoon-symbol-reader")
                    }
                }
                Section {
                    if !mark.note.isEmpty { row(Text("الدلالة هنا"), Text(verbatim: mark.note)) }
                    if let definition = mark.definition {
                        row(Text("القاعدة"), Text("من البيت \(definition.definedIn) في \(mark.work.labelAr)"))
                    }
                    if !mark.source.isEmpty { row(Text("المصدر"), Text(verbatim: mark.source)) }
                    row(Text("الحالة"), status)
                }
            }
            .navigationTitle(Text(verbatim: mark.work.labelAr))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button { dismiss() } label: { Text("تم") }.accessibilityIdentifier("mutoon-symbol-done")
                }
            }
        }
        .environment(\.layoutDirection, .rightToLeft)
        .presentationDetents([.medium, .large])
        .accessibilityIdentifier("mutoon-symbol-card")
    }

    /// Checked by hand, or matched to the شرح by script (its readers are exactly the ones the شرح names there).
    @ViewBuilder private var status: some View {
        switch mark.method {
        case .hand:
            Label { Text("محقَّق من الشرح") } icon: { Image(systemName: "checkmark.seal.fill") }.foregroundStyle(.green)
        case .match:
            VStack(alignment: .leading, spacing: 2) {
                Label { Text("مطابق لقول الشارح (آليًّا)") } icon: { Image(systemName: "checkmark.circle") }
                    .foregroundStyle(.green)
                Text("مجموع ما تدل عليه الرموز في هذا الموضع هو القرّاء الذين سمّاهم الشارح للبيت نفسه.")
                    .font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    private var kindLabel: Text {
        switch mark.kind {
        case .reader: Text("رمز قارئ")
        case .narrator: Text("رمز راوٍ")
        case .group: Text("رمز جماعي")
        }
    }

    private func row(_ title: Text, _ value: some View) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            title.font(.caption).foregroundStyle(.secondary)
            value
        }
        .accessibilityElement(children: .combine)
    }
}

/// A number in the app's language: Arabic-Indic digits in the Arabic app («١١٧٣»). Not a NumberFormatter: the
/// `ar` locale's default numbering system is Latin on current iOS.
func mutoonNumber(_ number: Int) -> String {
    mutoonDigits(String(number))
}

/// A printed page label («9», «xii») with its digits in the app's language.
func mutoonDigits(_ text: String) -> String {
    guard appLanguageCode != AppLanguage.english.rawValue else { return text }
    return String(text.map { c in
        guard let d = c.wholeNumberValue, c.isASCII, let scalar = UnicodeScalar(0x0660 + d) else { return c }
        return Character(scalar)
    })
}
