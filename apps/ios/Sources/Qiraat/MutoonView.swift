import MushafCore
import SwiftUI

/// «المتون» (المزيد): الشاطبية، الدرة وطيبة النشر in full, by book and chapter, with a search over all three. The
/// verses are quotations from the books, so they are set in a plain Arabic face, never the Mushaf fonts. Laid out
/// right to left. The reader and narrator symbols checked against a شرح are red; a tap names whom they stand for.
struct MutoonView: View {
    let library: MatnLibrary
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @AppStorage(MatnSymbolSettings.key) private var showsSymbols = true

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
                if let work = library.work(work) { MatnChaptersView(work: work, symbols: library.symbols) }
            }
        }
        // Right to left whatever the app language: every title, chapter and verse here is Arabic. A full-screen
        // cover does not inherit the reader's direction, so it is set on the page itself.
        .environment(\.layoutDirection, .rightToLeft)
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
            }
            ForEach(Array(hits.enumerated()), id: \.offset) { _, hit in
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        workName(hit.work).font(.caption.bold())
                        Text(verbatim: "·").font(.caption).foregroundStyle(.secondary).accessibilityHidden(true)
                        Text(verbatim: hit.chapter).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                    }
                    .foregroundStyle(Color(uiColor: .mushafBrown))
                    MatnVerseRow(verse: hit.verse, marks: library.symbols.marks(hit.work, verse: hit.verse.number))
                }
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("mutoon-search-result")
            }
        }
    }

    private func workName(_ work: QiraatMatn) -> Text {
        switch work {
        case .shatibiyyah: Text("الشاطبية")
        case .durrah: Text("الدرة")
        case .tayyibah: Text("طيبة النشر")
        }
    }
}

/// A book's chapters, each opening its verses.
private struct MatnChaptersView: View {
    let work: MatnWork
    let symbols: MatnSymbolLayer

    var body: some View {
        List(Array(work.chapters.enumerated()), id: \.offset) { index, chapter in
            NavigationLink {
                MatnChapterView(work: work.work, chapter: chapter, symbols: symbols)
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

/// One chapter's verses in the book's order.
private struct MatnChapterView: View {
    let work: QiraatMatn
    let chapter: MatnChapter
    let symbols: MatnSymbolLayer
    @AppStorage(MatnSymbolSettings.key) private var showsSymbols = true

    var body: some View {
        List {
            if showsSymbols, chapter.verses.contains(where: { !symbols.marks(work, verse: $0.number).isEmpty }) {
                MatnSymbolKey()
            }
            ForEach(Array(chapter.verses.enumerated()), id: \.offset) { _, verse in
                MatnVerseRow(verse: verse, marks: symbols.marks(work, verse: verse.number))
            }
        }
        .navigationTitle(Text(verbatim: chapter.title))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { if !symbols.isEmpty { ToolbarItem(placement: .primaryAction) { MatnSymbolToggle() } } }
    }
}

/// A verse: its number, its hemistichs one under the other, and its page in the book. Selectable for copying. Its
/// checked symbols are red (while the switch is on) and open a card naming whom they stand for.
struct MatnVerseRow: View {
    let verse: MatnVerse
    var marks: [MatnSymbolAnnotation] = []
    @AppStorage(MatnSymbolSettings.key) private var showsSymbols = true
    @State private var shown: MatnSymbolAnnotation?

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text(verbatim: mutoonNumber(verse.number))
                .font(.caption.bold().monospacedDigit())
                .foregroundStyle(Color(uiColor: .mushafBrown))
                .frame(minWidth: 28, alignment: .leading)
                .accessibilityLabel(Text("البيت \(mutoonNumber(verse.number))"))
                .accessibilityIdentifier("mutoon-verse-\(verse.number)")
            VStack(alignment: .leading, spacing: 2) {
                ForEach(Array(verse.lines.enumerated()), id: \.offset) { index, line in
                    MatnLineText(line: line, marks: visibleMarks.filter { $0.line == index }) { shown = $0 }
                        .accessibilityIdentifier("mutoon-line-\(verse.number)-\(index)")
                }
                if let page = verse.printedPage, !page.isEmpty {
                    Text("ص \(mutoonDigits(page))").font(.caption2).foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 2)
        .sheet(item: $shown) { mark in MatnSymbolCard(mark: mark) }
    }

    private var visibleMarks: [MatnSymbolAnnotation] { showsSymbols ? marks : [] }
}

/// One hemistich, selectable for copying, with its marks red and tappable. A text view, not a SwiftUI `Text`: its links
/// answer a tap where the letter is drawn in right-to-left text, alongside selection. Only the colour of the marked
/// letters changes, so the words keep their joining and their marks.
private struct MatnLineText: UIViewRepresentable {
    let line: String
    let marks: [MatnSymbolAnnotation]
    let onTap: (MatnSymbolAnnotation) -> Void

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
        return view
    }

    func updateUIView(_ view: UITextView, context: Context) {
        context.coordinator.parent = self
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

    final class Coordinator: NSObject, UITextViewDelegate {
        var parent: MatnLineText
        init(parent: MatnLineText) { self.parent = parent }

        func textView(_ textView: UITextView, primaryActionFor textItem: UITextItem, defaultAction: UIAction) -> UIAction? {
            guard case let .link(url) = textItem.content, url.scheme == MatnSymbolSettings.scheme,
                  let index = Int(url.host() ?? ""), parent.marks.indices.contains(index) else { return nil }
            let mark = parent.marks[index]
            return UIAction { [weak self] _ in self?.parent.onTap(mark) }
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
                    row(Text("الحالة"), Label { Text("محقَّق من الشرح") } icon: { Image(systemName: "checkmark.seal.fill") }
                        .foregroundStyle(.green))
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
