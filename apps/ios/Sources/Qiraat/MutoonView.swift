import MushafCore
import SwiftUI

/// «المتون» (المزيد): الشاطبية، الدرة وطيبة النشر in full, by book and chapter, with a search over all three. The
/// verses are quotations from the books, so they are set in a plain Arabic face, never the Mushaf fonts.
struct MutoonView: View {
    let library: MatnLibrary
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""

    var body: some View {
        NavigationStack {
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
            .navigationTitle(Text("المتون"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { dismiss() } label: { Text("إغلاق") }
                        .accessibilityIdentifier("mutoon-close")
                }
            }
            // A field of its own, not the system search bar: that one hides «إغلاق» while it is active.
            .safeAreaInset(edge: .top) { if !library.isEmpty { searchField } }
            .navigationDestination(for: QiraatMatn.self) { work in
                if let work = library.work(work) { MatnChaptersView(work: work) }
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
            }
            ForEach(Array(hits.enumerated()), id: \.offset) { _, hit in
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        workName(hit.work).font(.caption.bold())
                        Text(verbatim: "·").font(.caption).foregroundStyle(.secondary).accessibilityHidden(true)
                        Text(verbatim: hit.chapter).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                    }
                    .foregroundStyle(Color(uiColor: .mushafBrown))
                    MatnVerseRow(verse: hit.verse)
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

    var body: some View {
        List(Array(work.chapters.enumerated()), id: \.offset) { index, chapter in
            NavigationLink {
                MatnChapterView(chapter: chapter)
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
    }
}

/// One chapter's verses in the book's order.
private struct MatnChapterView: View {
    let chapter: MatnChapter

    var body: some View {
        List(Array(chapter.verses.enumerated()), id: \.offset) { _, verse in
            MatnVerseRow(verse: verse)
        }
        .navigationTitle(Text(verbatim: chapter.title))
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// A verse: its number, its hemistichs one under the other, and its page in the book. Selectable for copying.
struct MatnVerseRow: View {
    let verse: MatnVerse

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text(verbatim: mutoonNumber(verse.number))
                .font(.caption.bold().monospacedDigit())
                .foregroundStyle(Color(uiColor: .mushafBrown))
                .frame(minWidth: 28, alignment: .leading)
            VStack(alignment: .leading, spacing: 2) {
                ForEach(Array(verse.lines.enumerated()), id: \.offset) { _, line in
                    Text(verbatim: line)
                        .font(.system(.body, design: .serif))
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if let page = verse.printedPage, !page.isEmpty {
                    Text("ص \(mutoonDigits(page))").font(.caption2).foregroundStyle(.secondary)
                }
            }
            .textSelection(.enabled)
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("mutoon-verse-\(verse.number)")
    }
}

/// A number in the app's language: Arabic-Indic digits in the Arabic app, no thousands separator («١١٧٣»).
func mutoonNumber(_ number: Int) -> String {
    let formatter = NumberFormatter()
    formatter.locale = Locale(identifier: appLanguageCode)
    formatter.usesGroupingSeparator = false
    return formatter.string(from: NSNumber(value: number)) ?? String(number)
}

/// A printed page label («9», «xii») with its digits in the app's language.
func mutoonDigits(_ text: String) -> String {
    guard appLanguageCode != AppLanguage.english.rawValue else { return text }
    return String(text.map { c in
        guard let d = c.wholeNumberValue, c.isASCII, let scalar = UnicodeScalar(0x0660 + d) else { return c }
        return Character(scalar)
    })
}
