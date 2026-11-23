import MushafCore
import SwiftUI
import UIKit

/// Compare mode: what two readers or narrators read at the tapped word, side by side. The first
/// choice is the right-hand column (right to left). Every text and attribution comes from the word's
/// Qiraat data (`QiraatCompare`); a reading the data does not name reads the Mushaf text.
///
/// The initializer reloads the word's unfiltered selection. If its page is unavailable, comparison
/// stays unavailable rather than treating omitted readers as though they read the Mushaf base.
struct QiraatCompareView: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    let item: QiraatWordSelection?
    let catalog: QiraatCatalog
    private let loci: [QiraatComparisonLocus]

    @State private var first: String
    @State private var second: String
    @State private var selectedLocusId: String?
    @ScaledMetric(relativeTo: .title) private var quranSize: CGFloat = 28

    private var selectedLocus: QiraatComparisonLocus? {
        loci.first { $0.id == selectedLocusId } ?? loci.first
    }

    private var columnsLayout: AnyLayout {
        if dynamicTypeSize.isAccessibilitySize {
            AnyLayout(VStackLayout(alignment: .leading, spacing: 10))
        } else {
            AnyLayout(HStackLayout(alignment: .top, spacing: 10))
        }
    }

    init(item: QiraatWordSelection, store: QiraatStore?, catalog: QiraatCatalog,
         initialPair: (String, String)? = nil) {
        let fullItem = Self.unfiltered(item, store: store)
        let loci = fullItem.map { QiraatCompare.loci(selection: $0.selection) } ?? []
        let initialLocus = QiraatCompare.defaultLocus(in: loci, word: item.word)
        self.item = fullItem
        self.catalog = catalog
        let pair = initialPair
            ?? initialLocus.flatMap { QiraatCompare.defaultPair(selection: $0.selection, catalog: catalog) }
            ?? (QiraatCompare.hafsReadingId, QiraatCompare.hafsReadingId)
        self.loci = loci
        _first = State(initialValue: pair.0)
        _second = State(initialValue: pair.1)
        _selectedLocusId = State(initialValue: initialLocus?.id)
    }

    /// The word's selection with no reader filter, read from the store. Nil disables comparison.
    static func unfiltered(_ item: QiraatWordSelection, store: QiraatStore?) -> QiraatWordSelection? {
        let w = item.word
        guard let full = QiraatCompare.unfilteredSelection(for: w, marks: store?.marks(page: w.page)) else { return nil }
        return QiraatWordSelection(word: w, selection: full)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                if let item, let locus = selectedLocus {
                    let result = QiraatCompare.compare(first, second, locus: locus, word: item.word, catalog: catalog)
                    let groups = QiraatCompare.usulGroups(selection: locus.selection).filter { group in
                        (result.0.voices + result.1.voices).contains { voice in
                            voice.content.usul.contains { $0.groupId == group.id && $0.isRecorded }
                        }
                    }
                    if loci.count > 1 { locusPicker }
                    verdict(isSame: result.isSame)
                    columnsLayout {
                        column(result.0, selection: $first, side: "first")
                        column(result.1, selection: $second, side: "second")
                    }
                    .environment(\.layoutDirection, .rightToLeft)
                    if !groups.isEmpty {
                        Text("الأصول").font(.headline).padding(.top, 4)
                        ForEach(groups) { group in usulRow(group, result.0, result.1) }
                    }
                } else {
                    ContentUnavailableView("المقارنة غير متاحة", systemImage: "exclamationmark.triangle",
                                           description: Text("تعذر تحميل بيانات الصفحة الكاملة."))
                }
            }
            .padding()
        }
        .background(Color(uiColor: .mushafPaper))
        .navigationTitle("مقارنة القراءتين")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("qiraat-compare")
    }

    // MARK: Pieces

    private var locusPicker: some View {
        Picker("الموضع", selection: $selectedLocusId) {
            ForEach(Array(loci.enumerated()), id: \.element.id) { index, locus in
                Text(locus.baseText ?? "الموضع \(ArabicDigits.string(index + 1))").tag(Optional(locus.id))
            }
        }
        .pickerStyle(.menu)
        .accessibilityIdentifier("qiraat-compare-locus")
    }

    private func verdict(isSame: Bool) -> some View {
        Label(isSame ? "تتفقان في هذه الكلمة" : "تختلفان في هذه الكلمة",
              systemImage: isSame ? "equal.circle.fill" : "arrow.left.arrow.right.circle.fill")
            .font(.subheadline.bold())
            .foregroundStyle(isSame ? Color.progress : Color.caution)
            .accessibilityIdentifier("qiraat-compare-verdict")
    }

    private func column(_ reading: QiraatComparedReading, selection: Binding<String>, side: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            picker(selection: selection, side: side)
            if reading.voices.isEmpty {
                Text("لا توجد بيانات لهذا الاختيار").font(.footnote).foregroundStyle(.secondary)
            }
            ForEach(reading.voices) { voice in voiceView(voice) }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(uiColor: .secondarySystemGroupedBackground)))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(uiColor: .separator)))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("qiraat-compare-column-\(side)")
    }

    private func picker(selection: Binding<String>, side: String) -> some View {
        Menu {
            ForEach(catalog.readers.sorted { $0.sortOrder < $1.sortOrder }) { reader in
                Section("الإمام \(reader.nameAr)") {
                    choice(Text("الإمام \(reader.nameArShort) (روايتاه)"), id: reader.id, selection: selection)
                    ForEach(catalog.narrators(of: reader.id)) { narrator in
                        choice(Text("الراوي \(narrator.nameAr)"), id: narrator.id, selection: selection)
                    }
                }
            }
        } label: {
            HStack(spacing: 6) {
                AuthorityMark(color: color(of: selection.wrappedValue))
                Text(verbatim: name(of: selection.wrappedValue))
                    .font(.subheadline.bold()).foregroundStyle(.primary)
                    .multilineTextAlignment(.leading)
                Spacer(minLength: 0)
                Image(systemName: "chevron.up.chevron.down").font(.caption).foregroundStyle(.secondary)
            }
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .accessibilityLabel("اختر القارئ أو الراوي")
        .accessibilityValue(name(of: selection.wrappedValue))
        .accessibilityIdentifier("qiraat-compare-picker-\(side)")
    }

    private func choice(_ title: Text, id: String, selection: Binding<String>) -> some View {
        Button { withMotion { selection.wrappedValue = id } } label: {
            if selection.wrappedValue == id {
                Label {
                    title
                } icon: {
                    Image(systemName: "checkmark")
                }
            } else {
                title
            }
        }
    }

    private func voiceView(_ voice: QiraatComparedReading.Voice) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                AuthorityMark(color: voice.color)
                Text(verbatim: voice.name).font(.footnote.bold()).foregroundStyle(.primary)
            }
            let several = voice.content.wajhs.count > 1
            ForEach(Array(voice.content.wajhs.enumerated()), id: \.offset) { index, wajh in
                VStack(alignment: .leading, spacing: 2) {
                    if several {
                        Text("الوجه \(ArabicDigits.string(index + 1))").font(.caption.bold()).foregroundStyle(.secondary)
                    }
                    Text(verbatim: wajh.text)
                        .font(Font(MushafLibrary.mushafFont(size: quranSize)))
                        .foregroundStyle(Color(uiColor: .mushafInk))
                        .fixedSize(horizontal: false, vertical: true)
                    if let note = wajh.note {
                        Text(verbatim: note).font(.caption).foregroundStyle(Color(uiColor: .mushafBrown))
                    }
                    if case .base(let sameAsHafs) = wajh.source {
                        Text(baseLabel(sameAsHafs: sameAsHafs, voice: voice)).font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
        }
        .accessibilityElement(children: .combine)
    }

    private func usulRow(_ group: QiraatComparedUsulGroup, _ a: QiraatComparedReading,
                         _ b: QiraatComparedReading) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                AuthorityMark(color: group.color)
                Text(verbatim: group.categoryAr).font(.subheadline.bold())
            }
            columnsLayout {
                usulColumn(group, a)
                usulColumn(group, b)
            }
            .environment(\.layoutDirection, .rightToLeft)
        }
        .padding(10)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(uiColor: .secondarySystemGroupedBackground)))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(qiraatHex: group.color).opacity(0.6)))
    }

    private func usulColumn(_ group: QiraatComparedUsulGroup, _ reading: QiraatComparedReading) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(reading.voices) { voice in
                if let usul = voice.content.usul.first(where: { $0.groupId == group.id }) {
                    VStack(alignment: .leading, spacing: 3) {
                        if reading.voices.count > 1 {
                            Text(verbatim: voice.name).font(.caption.bold()).foregroundStyle(.secondary)
                        }
                        switch usul.status {
                        case .entries(let entries):
                            ForEach(Array(entries.enumerated()), id: \.offset) { index, entry in
                                entryView(entry, number: entries.count > 1 ? index + 1 : nil)
                            }
                        case .base(let sameAsHafs):
                            Text(baseLabel(sameAsHafs: sameAsHafs, voice: voice)).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    .accessibilityElement(children: .combine)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }

    private func entryView(_ entry: QiraatComparedReading.UsulEntry, number: Int?) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                if let number {
                    Text("\(ArabicDigits.string(number)).").font(.caption.bold()).foregroundStyle(.secondary)
                }
                Text(verbatim: entry.action).font(.footnote.bold()).foregroundStyle(.primary)
            }
            if let condition = entry.condition {
                Text(verbatim: condition).font(.caption).foregroundStyle(.secondary)
            }
            if let note = entry.wajhNote {
                Text("الخلاف: \(note)").font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    // MARK: Names

    /// «بلا اختلاف مسجّل هنا» when neither this reading nor Hafs has a recorded difference here: the data says no more
    /// than that, so the label does not claim «like Hafs».
    private func baseLabel(sameAsHafs: Bool, voice: QiraatComparedReading.Voice) -> String {
        if voice.narratorIds.contains(QiraatCompare.hafsReadingId) { return "على رسم المصحف" }
        return sameAsHafs ? "بلا اختلاف مسجّل هنا" : "على رسم المصحف، بلا وجه مسجّل هنا"
    }

    private func name(of id: String) -> String {
        if let reader = catalog.reader(id) { return "الإمام \(reader.nameArShort)" }
        if let narrator = catalog.narrator(id) { return "الراوي \(narrator.nameAr)" }
        return id
    }

    private func color(of id: String) -> String {
        catalog.reader(id)?.color ?? catalog.narrator(id)?.color ?? catalog.unresolvedColor
    }
}

/// The reader, narrator or family colour as a small mark; always shown beside a name, never alone.
private struct AuthorityMark: View {
    let color: String

    var body: some View {
        RoundedRectangle(cornerRadius: 2)
            .fill(Color(qiraatHex: color))
            .frame(width: 4, height: 16)
            .accessibilityHidden(true)
    }
}
