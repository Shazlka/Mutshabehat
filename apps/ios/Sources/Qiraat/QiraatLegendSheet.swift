import MushafCore
import SwiftUI
import UIKit

// The colour key («مفتاح الألوان») of the Qiraat layer. Every shape MushafPageView draws for a word, and
// every reader, narrator and أصول category that can colour one, has a row: the same shape as on the page,
// its name and what it means. The rules are the ones in MushafCore's QiraatMarks and
// MushafPageView.drawQiraatMarks; the readers, narrators and colours come from the catalog and the
// categories from the page data, so nothing here is written out by hand.

/// A shape MushafPageView draws for a word, or the word's own colour when it has no underline.
enum QiraatLegendMark: Hashable, CaseIterable, Sendable {
    /// One reader or narrator on the word: a solid line, and the word's text, in that colour.
    case solidLine
    /// Several readers on the word: a line cut into equal segments, one per reader.
    case segmentedLine
    /// Only the way of reciting differs: a solid line in the performance colour.
    case performanceLine
    /// No known reader for the variant: a solid neutral line.
    case unresolvedLine
    /// ذو وجهين: a second valid وجه («بخلف عنه») — a dotted line in the ruling colour.
    case dottedLine
    /// More than one أصول ruling on the word: a filled dot at the top left, in the ruling colour.
    case familyDot
    /// إمالة among the word's الممال والمقلل rulings: a filled dot at the bottom left.
    case imalahFilled
    /// تقليل without إمالة: a ring at the bottom left.
    case imalahRing
    /// An أصول ruling and no variant: no line, the word's text takes the ruling colour.
    case rulingWord

    /// The mark a variant style is drawn with (`QiraatMarks.textColor(of:)` and the underline).
    static func of(_ style: VariantMarker.Style) -> QiraatLegendMark {
        switch style {
        case .unresolved: .unresolvedLine
        case .performance: .performanceLine
        case .single: .solidLine
        case .multiReader: .segmentedLine
        }
    }

    /// Every mark MushafPageView draws for one word, as `drawWord` and `drawQiraatMarks` lay them out.
    static func drawn(by marks: WordMarks, catalog: QiraatCatalog) -> [QiraatLegendMark] {
        var drawn: [QiraatLegendMark] = []
        switch marks.underline {
        case .solid(let hex)?:
            if hex == catalog.performanceColor {
                drawn.append(.performanceLine)
            } else if hex == catalog.unresolvedColor {
                drawn.append(.unresolvedLine)
            } else {
                drawn.append(.solidLine)
            }
        case .segments?: drawn.append(.segmentedLine)
        case nil: drawn.append(.rulingWord)
        }
        if marks.dottedUnderlineColor != nil { drawn.append(.dottedLine) }
        if marks.familyDotColor != nil { drawn.append(.familyDot) }
        if let imalah = marks.imalahDot { drawn.append(imalah.filled ? .imalahFilled : .imalahRing) }
        return drawn
    }

    /// The shape, in words, for VoiceOver (a colour is never the only cue: each row also has its name).
    var shapeWords: String {
        switch self {
        case .solidLine: appLocalized("خط متصل تحت الكلمة")
        case .segmentedLine: appLocalized("خط مقسَّم إلى أجزاء متساوية تحت الكلمة")
        case .performanceLine: appLocalized("خط متصل تحت الكلمة، لون الأداء")
        case .unresolvedLine: appLocalized("خط متصل رمادي تحت الكلمة")
        case .dottedLine: appLocalized("خط منقّط تحت الكلمة")
        case .familyDot: appLocalized("نقطة مملوءة أعلى يسار الكلمة")
        case .imalahFilled: appLocalized("نقطة مملوءة أسفل يسار الكلمة")
        case .imalahRing: appLocalized("حلقة أسفل يسار الكلمة")
        case .rulingWord: appLocalized("نص الكلمة ملوّن بلا خط تحتها")
        }
    }
}

/// One أصول category that colours a word on some page: its name and the colour the page draws it in.
struct QiraatLegendCategory: Hashable, Identifiable, Sendable {
    let code: String
    let nameAr: String
    let color: String

    var id: String { "\(code)|\(color)" }
}

/// One row of the key.
struct QiraatLegendEntry: Identifiable, Hashable {
    enum Group: Hashable, CaseIterable, Sendable { case marks, readers, usul }

    let id: String
    let group: Group
    let mark: QiraatLegendMark
    /// The colours the sample is drawn in: one per segment for a segmented line, none for a plain shape.
    let colors: [String]
    /// The colour of the sample word's text, when the page colours the word's text in this mark's colour.
    let textColor: String?
    let title: String
    let explanation: String
    /// A narrator row, shown under its reader.
    let isNarrator: Bool
    /// A word of the Mushaf this reader or narrator alone reads in that way, as the sample; nil keeps the plain «كلمة».
    var sampleWord: String? = nil

    /// What VoiceOver reads for the row: the shape in words, the name, then what it means.
    var accessibilityLabel: String { "\(mark.shapeWords). \(title). \(explanation)" }
}

/// A word of the Mushaf, with where it is, that one reader or narrator alone reads in a way of their own.
struct QiraatLegendSampleWord: Hashable, Sendable {
    let text: String
    let surah: Int
    let ayah: Int
}

/// The pure model behind `QiraatLegendSheet`.
enum QiraatLegend {
    /// The category the page draws its إمالة/تقليل dot for (`QiraatMarks.imalahTaqlilMarker`).
    static let imalahCategory = "IMALAH_TAQLIL"

    /// Every row of the key: the marks, then the readers with their narrators, then the أصول categories.
    static func entries(catalog: QiraatCatalog, usulCategories: [QiraatLegendCategory] = [],
                        sampleWords: [String: QiraatLegendSampleWord] = [:],
                        hidesUsul: Bool = false) -> [QiraatLegendEntry] {
        let readers = catalog.readers.sorted { $0.sortOrder < $1.sortOrder }
        let familyColor = usulCategories.first?.color ?? catalog.multiReaderColor
        let imalahColor = usulCategories.first { $0.code == imalahCategory }?.color ?? familyColor
        var rows: [QiraatLegendEntry] = []

        rows.append(QiraatLegendEntry(
            id: "mark-solid", group: .marks, mark: .solidLine,
            colors: readers.first.map { [$0.color] } ?? [], textColor: readers.first?.color,
            title: appLocalized("خط متصل تحت الكلمة"),
            explanation: appLocalized("قارئ أو راوٍ واحد على الكلمة. الألوان في القسم التالي."), isNarrator: false))
        rows.append(QiraatLegendEntry(
            id: "mark-segmented", group: .marks, mark: .segmentedLine,
            colors: readers.prefix(3).map(\.color), textColor: catalog.multiReaderColor,
            title: appLocalized("خط مقسَّم"),
            explanation: appLocalized("أكثر من إمام على الكلمة: قطعة متساوية لكل إمام بترتيب القرّاء، والنص بلون مشترك."),
            isNarrator: false))
        rows.append(QiraatLegendEntry(
            id: "mark-performance", group: .marks, mark: .performanceLine,
            colors: [catalog.performanceColor], textColor: catalog.performanceColor,
            title: appLocalized("خط بلون الأداء"),
            explanation: appLocalized("الاختلاف في طريقة القراءة فقط، والرسم كما هو في المصحف."), isNarrator: false))
        rows.append(QiraatLegendEntry(
            id: "mark-unresolved", group: .marks, mark: .unresolvedLine,
            colors: [catalog.unresolvedColor], textColor: catalog.unresolvedColor,
            title: appLocalized("خط رمادي"),
            explanation: appLocalized("القارئ غير معروف بعد في بيانات الكلمة، فلا يُنسب الخط إلى أحد."), isNarrator: false))
        rows.append(QiraatLegendEntry(
            id: "mark-dotted", group: .marks, mark: .dottedLine,
            colors: [familyColor], textColor: nil,
            title: appLocalized("خط منقّط تحت الكلمة"),
            explanation: appLocalized("ذو وجهين: لبعض القرّاء وجه ثانٍ جائز («بخلف عنه»)، بلون الباب."), isNarrator: false))
        rows.append(QiraatLegendEntry(
            id: "mark-family", group: .marks, mark: .familyDot,
            colors: [familyColor], textColor: nil,
            title: appLocalized("نقطة أعلى يسار الكلمة"),
            explanation: appLocalized("أكثر من باب من أبواب الأصول على الكلمة، بلون أول حكم عليها."), isNarrator: false))
        rows.append(QiraatLegendEntry(
            id: "mark-imalah", group: .marks, mark: .imalahFilled,
            colors: [imalahColor], textColor: nil,
            title: appLocalized("نقطة مملوءة أسفل يسار الكلمة"),
            explanation: appLocalized("إمالة في باب الممال والمقلل، بلون هذا الباب."), isNarrator: false))
        rows.append(QiraatLegendEntry(
            id: "mark-taqlil", group: .marks, mark: .imalahRing,
            colors: [imalahColor], textColor: nil,
            title: appLocalized("حلقة أسفل يسار الكلمة"),
            explanation: appLocalized("تقليل بلا إمالة في باب الممال والمقلل، بلون هذا الباب."), isNarrator: false))
        rows.append(QiraatLegendEntry(
            id: "mark-ruling-word", group: .marks, mark: .rulingWord,
            colors: [familyColor], textColor: familyColor,
            title: appLocalized("كلمة بلون الباب"),
            explanation: appLocalized("حكم من أبواب الأصول بلا اختلاف في الرسم: يلوّن نص الكلمة بلا خط تحتها."),
            isNarrator: false))

        /// The explanation, with where the sample word stands in the Mushaf when there is one.
        func explained(_ text: String, _ sample: QiraatLegendSampleWord?) -> String {
            guard let sample else { return text }
            let place = "\(ArabicDigits.string(sample.surah)):\(ArabicDigits.string(sample.ayah))"
            return "\(text) \(appLocalized("مثال في المصحف:")) \(place)"
        }

        for reader in readers {
            let readerSample = sampleWords[reader.id]
            rows.append(QiraatLegendEntry(
                id: "reader-\(reader.id)", group: .readers, mark: .solidLine,
                colors: [reader.color], textColor: reader.color,
                title: appLocalized("الإمام \(reader.nameArShort)"),
                explanation: explained(appLocalized("يُلوَّن الخط ونص الكلمة بلونه إذا ذُكر راوياه معًا، أو قطعةً من الخط المقسَّم."), readerSample),
                isNarrator: false, sampleWord: readerSample?.text))
            for narrator in catalog.narrators(of: reader.id) {
                let sample = sampleWords[narrator.id]
                rows.append(QiraatLegendEntry(
                    id: "narrator-\(narrator.id)", group: .readers, mark: .solidLine,
                    colors: [narrator.color], textColor: narrator.color,
                    title: appLocalized("الراوي \(narrator.nameAr)"),
                    explanation: explained(appLocalized("يُلوَّن بلونه إذا ذُكر وحده دون زميله من الإمام نفسه."), sample),
                    isNarrator: true, sampleWord: sample?.text))
            }
        }

        // «فرش فقط»: the page draws no أصول mark, so the key explains none and lists no باب.
        if hidesUsul {
            let usulMarks: Set<QiraatLegendMark> = [.dottedLine, .familyDot, .imalahFilled, .imalahRing, .rulingWord]
            return rows.filter { !($0.group == .marks && usulMarks.contains($0.mark)) }
        }

        for category in usulCategories {
            rows.append(QiraatLegendEntry(
                id: "usul-\(category.id)", group: .usul, mark: .rulingWord,
                colors: [category.color], textColor: category.color,
                title: category.nameAr,
                explanation: appLocalized("حكم أصولي على الكلمة: يلوّن نصها إن لم يكن فيها اختلاف قراءة، وتُرسم به النقطة والخط المنقّط."),
                isNarrator: false))
        }
        return rows
    }

    /// For each reader (both narrators together and nobody else) and each narrator (alone), a single word of the
    /// Mushaf whose written form only that authority changes: the sample the key shows beside their colour.
    /// Rows are taken in key order, and no two rows share a word, whatever its marks. An authority with no such
    /// word is left out, and its row keeps the plain sample.
    static func sampleWords<Pages: Sequence>(in pages: Pages, catalog: QiraatCatalog) -> [String: QiraatLegendSampleWord]
    where Pages.Element == QiraatPageData {
        var collector = SampleWordCollector(catalog: catalog)
        for page in pages { collector.add(page) }
        return collector.words()
    }

    /// The categories and the sample words of every page the store can read, in one pass over the 604 pages.
    static func scan(store: QiraatStore) -> (categories: [QiraatLegendCategory], sampleWords: [String: QiraatLegendSampleWord]) {
        var collector = SampleWordCollector(catalog: store.catalog)
        var seen: Set<QiraatLegendCategory> = []
        var categories: [QiraatLegendCategory] = []
        for number in 1...mushafPageCount {
            guard let page = store.page(number) else { continue }
            collector.add(page)
            for ruling in page.rulings where ruling.wordAnchored {
                let category = QiraatLegendCategory(code: ruling.category, nameAr: ruling.categoryAr, color: ruling.color)
                if seen.insert(category).inserted { categories.append(category) }
            }
        }
        return (categories, collector.words())
    }

    /// The أصول categories that colour a word on these pages, one per name and colour, in first-seen order.
    /// Rulings that are not anchored to a word never colour one, so they are left out.
    static func usulCategories<Pages: Sequence>(in pages: Pages) -> [QiraatLegendCategory] where Pages.Element == QiraatPageData {
        var seen: Set<QiraatLegendCategory> = []
        var categories: [QiraatLegendCategory] = []
        for page in pages {
            for ruling in page.rulings where ruling.wordAnchored {
                let category = QiraatLegendCategory(code: ruling.category, nameAr: ruling.categoryAr, color: ruling.color)
                if seen.insert(category).inserted { categories.append(category) }
            }
        }
        return categories
    }

    /// The categories of every page the store can read (the live overlay wins, as on the reader).
    static func usulCategories(store: QiraatStore) -> [QiraatLegendCategory] {
        usulCategories(in: (1...mushafPageCount).lazy.compactMap { store.page($0) })
    }
}

/// Gathers, page by page, the single-word variants one authority alone reads, then picks one word for each.
private struct SampleWordCollector {
    struct Candidate {
        let word: QiraatLegendSampleWord
        let verified: Bool
        let letters: Int
        let order: Int
    }

    let catalog: QiraatCatalog
    private var candidates: [String: [Candidate]] = [:]
    private var order = 0

    init(catalog: QiraatCatalog) { self.catalog = catalog }

    mutating func add(_ page: QiraatPageData) {
        for variant in page.variants {
            order += 1
            guard variant.startToken == variant.endToken, variant.hafsText != variant.variantText,
                  let owner = owner(of: variant.readingIds),
                  let text = Self.cleaned(variant.hafsText) else { continue }
            let verified = variant.verificationStatus == "VERIFIED" || variant.verificationStatus == "PUBLISHED"
            candidates[owner, default: []].append(Candidate(
                word: QiraatLegendSampleWord(text: text, surah: variant.surah, ayah: variant.ayah),
                verified: verified, letters: Self.bareLetters(of: text).count, order: order))
        }
    }

    func words() -> [String: QiraatLegendSampleWord] {
        var taken: Set<String> = []
        var result: [String: QiraatLegendSampleWord] = [:]
        for reader in catalog.readers.sorted(by: { $0.sortOrder < $1.sortOrder }) {
            for owner in [reader.id] + catalog.narrators(of: reader.id).map(\.id) {
                let best = (candidates[owner] ?? [])
                    .filter { !taken.contains(Self.bareLetters(of: $0.word.text)) }
                    .min { lhs, rhs in
                        if lhs.verified != rhs.verified { return lhs.verified }
                        // A word of about five letters reads best in the small sample.
                        let (l, r) = (abs(lhs.letters - 5), abs(rhs.letters - 5))
                        return l != r ? l < r : lhs.order < rhs.order
                    }
                guard let best else { continue }
                taken.insert(Self.bareLetters(of: best.word.text))
                result[owner] = best.word
            }
        }
        return result
    }

    /// The reader or narrator id this reading set belongs to alone: one narrator, or exactly both narrators of one reader.
    private func owner(of readingIds: [String]) -> String? {
        let ids = Set(readingIds)
        guard !ids.isEmpty, ids.allSatisfy({ catalog.narrator($0) != nil }) else { return nil }
        if ids.count == 1 { return ids.first }
        let readers = Set(ids.compactMap { catalog.readerId(ofReading: $0) })
        guard readers.count == 1, let reader = readers.first,
              ids == Set(catalog.narrators(of: reader).map(\.id)) else { return nil }
        return reader
    }

    /// The word without the stop signs the printed token may carry after it; nil when more than one word is left.
    static func cleaned(_ text: String) -> String? {
        let stopSigns: ClosedRange<UInt32> = 0x06D6...0x06DB
        let scalars = text.unicodeScalars.filter { !stopSigns.contains($0.value) && $0.value != 0x06DE && $0.value != 0x06E9 }
        var kept = Array(scalars)
        // The iqlab meem sign printed after a tanween belongs to the next word's first letter; alone it draws a dotted circle.
        while let last = kept.last, last.value == 0x06E2 || last.value == 0x06ED { kept.removeLast() }
        let word = String(String.UnicodeScalarView(kept)).trimmingCharacters(in: .whitespacesAndNewlines)
        return word.isEmpty || word.contains(where: \.isWhitespace) ? nil : word
    }

    /// The letters alone: no vowels or small signs, alef wasla as alef, no tatweel.
    static func bareLetters(of text: String) -> String {
        String(String.UnicodeScalarView(text.unicodeScalars.compactMap { scalar in
            if scalar.properties.generalCategory == .nonspacingMark || scalar.value == 0x0640 { return nil }
            return scalar.value == 0x0671 ? Unicode.Scalar(0x0627) : scalar
        }))
    }
}

/// The colour key, presented from the Qiraat layer. The rows come from `QiraatLegend`.
struct QiraatLegendSheet: View {
    let catalog: QiraatCatalog
    /// The page data the أصول categories are read from. Nil: the key shows the marks and the readers only.
    let store: QiraatStore?

    @State private var usulCategories: [QiraatLegendCategory] = []
    @State private var sampleWords: [String: QiraatLegendSampleWord] = [:]
    @State private var categoriesLoaded = false
    @Environment(\.dismiss) private var dismiss

    init(catalog: QiraatCatalog, store: QiraatStore? = nil) {
        self.catalog = catalog
        self.store = store
    }

    var body: some View {
        let hidesUsul = store?.hidesUsul ?? false
        let rows = QiraatLegend.entries(catalog: catalog, usulCategories: usulCategories, sampleWords: sampleWords,
                                        hidesUsul: hidesUsul)
        NavigationStack {
            List {
                Section {
                    ForEach(rows.filter { $0.group == .marks }) { QiraatLegendRow(entry: $0) }
                } header: {
                    Text("علامات الكلمة")
                }
                Section {
                    ForEach(rows.filter { $0.group == .readers }) { QiraatLegendRow(entry: $0) }
                } header: {
                    Text("ألوان القرّاء والرواة")
                }
                if !hidesUsul {
                    Section {
                        if categoriesLoaded {
                            ForEach(rows.filter { $0.group == .usul }) { QiraatLegendRow(entry: $0) }
                        } else {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                                .accessibilityLabel(Text("جارٍ تحميل أبواب الأصول"))
                        }
                    } header: {
                        Text("أبواب الأصول")
                    }
                }
            }
            .accessibilityIdentifier("qiraat-legend")
            .navigationTitle("مفتاح الألوان")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("إغلاق") { dismiss() }
                        .accessibilityIdentifier("qiraat-legend-close")
                }
            }
        }
        .environment(\.layoutDirection, .rightToLeft)
        .presentationDetents([.medium, .large])
        .task { await loadCategories() }
    }

    /// Reads every page on a background task; the rows appear once it is done.
    private func loadCategories() async {
        guard !categoriesLoaded else { return }
        guard let store else {
            categoriesLoaded = true
            return
        }
        let scanned = await Task.detached(priority: .utility) {
            QiraatLegend.scan(store: store)
        }.value
        usulCategories = scanned.categories
        sampleWords = scanned.sampleWords
        categoriesLoaded = true
    }
}

/// One key row: the sample on the start edge, the name and what it means beside it.
private struct QiraatLegendRow: View {
    let entry: QiraatLegendEntry
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @ScaledMetric(relativeTo: .body) private var sampleWidth: CGFloat = 84

    private var titleAndExplanation: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(verbatim: entry.title)
                .font(.headline)
                .foregroundStyle(.primary)
            Text(verbatim: entry.explanation)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    var body: some View {
        Group {
            if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: 8) {
                    QiraatLegendSample(mark: entry.mark, colors: entry.colors, textColor: entry.textColor, word: entry.sampleWord)
                        .frame(width: sampleWidth, alignment: .leading)
                    titleAndExplanation
                }
            } else {
                HStack(alignment: .center, spacing: 12) {
                    QiraatLegendSample(mark: entry.mark, colors: entry.colors, textColor: entry.textColor, word: entry.sampleWord)
                        .frame(width: sampleWidth)
                    titleAndExplanation
                    Spacer(minLength: 0)
                }
            }
        }
        .padding(.leading, entry.isNarrator ? 16 : 0)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(Text(verbatim: entry.accessibilityLabel))
    }
}

/// A miniature of one word with its mark, drawn with the same geometry as MushafPageView.drawQiraatMarks.
private struct QiraatLegendSample: View {
    let mark: QiraatLegendMark
    let colors: [String]
    let textColor: String?
    /// A word of the Mushaf, drawn in the Mushaf's own font; nil draws the plain «كلمة».
    var word: String? = nil

    var body: some View {
        sampleText
            .lineLimit(1)
            .minimumScaleFactor(0.5)
            .foregroundStyle(textColor.map { Color(qiraatHex: $0) } ?? Color(uiColor: .mushafInk))
            .padding(.horizontal, 12)
            .padding(.vertical, 14)
            .overlay {
                Canvas { context, size in
                    QiraatLegendSample.draw(mark, colors: colors, in: &context,
                                            word: CGRect(origin: .zero, size: size).insetBy(dx: 12, dy: 14))
                }
            }
            .accessibilityHidden(true)
    }

    @ViewBuilder private var sampleText: some View {
        if let word {
            Text(verbatim: word).font(Font(MushafLibrary.mushafFont(size: 22)))
        } else {
            Text("كلمة").font(.title3)
        }
    }

    /// Same proportions as `drawQiraatMarks`: a bar of `thickness` under the word, a dotted line
    /// 2.6 thicknesses below it, dots of `dot` at the top-left and the bottom-left.
    static func draw(_ mark: QiraatLegendMark, colors: [String], in context: inout GraphicsContext, word: CGRect) {
        let thickness = max(1.5, word.height * 0.09)
        let dot = max(4, word.height * 0.26)
        let ink = Color(uiColor: .mushafInk)
        func color(_ index: Int) -> Color { index < colors.count ? Color(qiraatHex: colors[index]) : ink }

        switch mark {
        case .solidLine, .performanceLine, .unresolvedLine:
            context.fill(Path(CGRect(x: word.minX, y: word.maxY, width: word.width, height: thickness)),
                         with: .color(color(0)))
        case .segmentedLine:
            let count = max(colors.count, 1)
            let width = word.width / CGFloat(count)
            for index in 0..<count {
                let segment = CGRect(x: word.minX + CGFloat(index) * width, y: word.maxY, width: width, height: thickness)
                context.fill(Path(segment), with: .color(color(index)))
            }
        case .dottedLine:
            var line = Path()
            let y = word.maxY + thickness * 2.6
            line.move(to: CGPoint(x: word.minX, y: y))
            line.addLine(to: CGPoint(x: word.maxX, y: y))
            context.stroke(line, with: .color(color(0)),
                           style: StrokeStyle(lineWidth: thickness * 0.9, dash: [thickness, thickness * 1.3]))
        case .familyDot:
            context.fill(Path(ellipseIn: CGRect(x: word.minX - dot * 0.7, y: word.minY, width: dot, height: dot)),
                         with: .color(color(0)))
        case .imalahFilled:
            context.fill(Path(ellipseIn: CGRect(x: word.minX - dot * 0.7, y: word.maxY + thickness * 3.6,
                                                width: dot, height: dot)),
                         with: .color(color(0)))
        case .imalahRing:
            let ring = CGRect(x: word.minX - dot * 0.7, y: word.maxY + thickness * 3.6, width: dot, height: dot)
            context.stroke(Path(ellipseIn: ring.insetBy(dx: dot * 0.14, dy: dot * 0.14)), with: .color(color(0)),
                           lineWidth: max(1, dot * 0.28))
        case .rulingWord:
            break
        }
    }
}
