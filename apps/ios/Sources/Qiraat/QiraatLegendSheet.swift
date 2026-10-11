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
        case .solidLine: "خط متصل تحت الكلمة"
        case .segmentedLine: "خط مقسَّم إلى أجزاء متساوية تحت الكلمة"
        case .performanceLine: "خط متصل تحت الكلمة، لون الأداء"
        case .unresolvedLine: "خط متصل رمادي تحت الكلمة"
        case .dottedLine: "خط منقّط تحت الكلمة"
        case .familyDot: "نقطة مملوءة أعلى يسار الكلمة"
        case .imalahFilled: "نقطة مملوءة أسفل يسار الكلمة"
        case .imalahRing: "حلقة أسفل يسار الكلمة"
        case .rulingWord: "نص الكلمة ملوّن بلا خط تحتها"
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

    /// What VoiceOver reads for the row: the shape in words, the name, then what it means.
    var accessibilityLabel: String { "\(mark.shapeWords). \(title). \(explanation)" }
}

/// The pure model behind `QiraatLegendSheet`.
enum QiraatLegend {
    /// The category the page draws its إمالة/تقليل dot for (`QiraatMarks.imalahTaqlilMarker`).
    static let imalahCategory = "IMALAH_TAQLIL"

    /// Every row of the key: the marks, then the readers with their narrators, then the أصول categories.
    static func entries(catalog: QiraatCatalog, usulCategories: [QiraatLegendCategory] = []) -> [QiraatLegendEntry] {
        let readers = catalog.readers.sorted { $0.sortOrder < $1.sortOrder }
        let familyColor = usulCategories.first?.color ?? catalog.multiReaderColor
        let imalahColor = usulCategories.first { $0.code == imalahCategory }?.color ?? familyColor
        var rows: [QiraatLegendEntry] = []

        rows.append(QiraatLegendEntry(
            id: "mark-solid", group: .marks, mark: .solidLine,
            colors: readers.first.map { [$0.color] } ?? [], textColor: readers.first?.color,
            title: "خط متصل تحت الكلمة",
            explanation: "قارئ أو راوٍ واحد على الكلمة. الألوان في القسم التالي.", isNarrator: false))
        rows.append(QiraatLegendEntry(
            id: "mark-segmented", group: .marks, mark: .segmentedLine,
            colors: readers.prefix(3).map(\.color), textColor: catalog.multiReaderColor,
            title: "خط مقسَّم",
            explanation: "أكثر من إمام على الكلمة: قطعة متساوية لكل إمام بترتيب القرّاء، والنص بلون مشترك.",
            isNarrator: false))
        rows.append(QiraatLegendEntry(
            id: "mark-performance", group: .marks, mark: .performanceLine,
            colors: [catalog.performanceColor], textColor: catalog.performanceColor,
            title: "خط بلون الأداء",
            explanation: "الاختلاف في طريقة القراءة فقط، والرسم كما هو في المصحف.", isNarrator: false))
        rows.append(QiraatLegendEntry(
            id: "mark-unresolved", group: .marks, mark: .unresolvedLine,
            colors: [catalog.unresolvedColor], textColor: catalog.unresolvedColor,
            title: "خط رمادي",
            explanation: "القارئ غير معروف بعد في بيانات الكلمة، فلا يُنسب الخط إلى أحد.", isNarrator: false))
        rows.append(QiraatLegendEntry(
            id: "mark-dotted", group: .marks, mark: .dottedLine,
            colors: [familyColor], textColor: nil,
            title: "خط منقّط تحت الكلمة",
            explanation: "ذو وجهين: لبعض القرّاء وجه ثانٍ جائز («بخلف عنه»)، بلون الباب.", isNarrator: false))
        rows.append(QiraatLegendEntry(
            id: "mark-family", group: .marks, mark: .familyDot,
            colors: [familyColor], textColor: nil,
            title: "نقطة أعلى يسار الكلمة",
            explanation: "أكثر من باب من أبواب الأصول على الكلمة، بلون أول حكم عليها.", isNarrator: false))
        rows.append(QiraatLegendEntry(
            id: "mark-imalah", group: .marks, mark: .imalahFilled,
            colors: [imalahColor], textColor: nil,
            title: "نقطة مملوءة أسفل يسار الكلمة",
            explanation: "إمالة في باب الممال والمقلل، بلون هذا الباب.", isNarrator: false))
        rows.append(QiraatLegendEntry(
            id: "mark-taqlil", group: .marks, mark: .imalahRing,
            colors: [imalahColor], textColor: nil,
            title: "حلقة أسفل يسار الكلمة",
            explanation: "تقليل بلا إمالة في باب الممال والمقلل، بلون هذا الباب.", isNarrator: false))
        rows.append(QiraatLegendEntry(
            id: "mark-ruling-word", group: .marks, mark: .rulingWord,
            colors: [familyColor], textColor: familyColor,
            title: "كلمة بلون الباب",
            explanation: "حكم من أبواب الأصول بلا اختلاف في الرسم: يلوّن نص الكلمة بلا خط تحتها.",
            isNarrator: false))

        for reader in readers {
            rows.append(QiraatLegendEntry(
                id: "reader-\(reader.id)", group: .readers, mark: .solidLine,
                colors: [reader.color], textColor: reader.color,
                title: "الإمام \(reader.nameArShort)",
                explanation: "يُلوَّن الخط ونص الكلمة بلونه إذا ذُكر راوياه معًا، أو قطعةً من الخط المقسَّم.",
                isNarrator: false))
            for narrator in catalog.narrators(of: reader.id) {
                rows.append(QiraatLegendEntry(
                    id: "narrator-\(narrator.id)", group: .readers, mark: .solidLine,
                    colors: [narrator.color], textColor: narrator.color,
                    title: "الراوي \(narrator.nameAr)",
                    explanation: "يُلوَّن بلونه إذا ذُكر وحده دون زميله من الإمام نفسه.", isNarrator: true))
            }
        }

        for category in usulCategories {
            rows.append(QiraatLegendEntry(
                id: "usul-\(category.id)", group: .usul, mark: .rulingWord,
                colors: [category.color], textColor: category.color,
                title: category.nameAr,
                explanation: "حكم أصولي على الكلمة: يلوّن نصها إن لم يكن فيها اختلاف قراءة، وتُرسم به النقطة والخط المنقّط.",
                isNarrator: false))
        }
        return rows
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

/// The colour key, presented from the Qiraat layer. The rows come from `QiraatLegend`.
struct QiraatLegendSheet: View {
    let catalog: QiraatCatalog
    /// The page data the أصول categories are read from. Nil: the key shows the marks and the readers only.
    let store: QiraatStore?

    @State private var usulCategories: [QiraatLegendCategory] = []
    @State private var categoriesLoaded = false
    @Environment(\.dismiss) private var dismiss

    init(catalog: QiraatCatalog, store: QiraatStore? = nil) {
        self.catalog = catalog
        self.store = store
    }

    var body: some View {
        let rows = QiraatLegend.entries(catalog: catalog, usulCategories: usulCategories)
        NavigationStack {
            List {
                Section {
                    ForEach(rows.filter { $0.group == .marks }) { QiraatLegendRow(entry: $0) }
                } header: {
                    Text(verbatim: "علامات الكلمة")
                }
                Section {
                    ForEach(rows.filter { $0.group == .readers }) { QiraatLegendRow(entry: $0) }
                } header: {
                    Text(verbatim: "ألوان القرّاء والرواة")
                }
                Section {
                    if categoriesLoaded {
                        ForEach(rows.filter { $0.group == .usul }) { QiraatLegendRow(entry: $0) }
                    } else {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                            .accessibilityLabel(Text(verbatim: "جارٍ تحميل أبواب الأصول"))
                    }
                } header: {
                    Text(verbatim: "أبواب الأصول")
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
        usulCategories = await Task.detached(priority: .utility) {
            QiraatLegend.usulCategories(store: store)
        }.value
        categoriesLoaded = true
    }
}

/// One key row: the sample on the start edge, the name and what it means beside it.
private struct QiraatLegendRow: View {
    let entry: QiraatLegendEntry
    @ScaledMetric(relativeTo: .body) private var sampleWidth: CGFloat = 84

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            QiraatLegendSample(mark: entry.mark, colors: entry.colors, textColor: entry.textColor)
                .frame(width: sampleWidth)
            VStack(alignment: .leading, spacing: 2) {
                Text(verbatim: entry.title)
                    .font(.headline)
                    .foregroundStyle(.primary)
                Text(verbatim: entry.explanation)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
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

    var body: some View {
        Text(verbatim: "كلمة")
            .font(.title3)
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
            let badge = CGRect(x: word.minX - dot * 0.8, y: word.midY - dot * 0.45,
                               width: dot * 0.8, height: dot * 0.9)
            context.fill(Path(roundedRect: badge, cornerRadius: dot * 0.22),
                         with: .color(color(0).opacity(0.16)))
            context.stroke(Path(roundedRect: badge, cornerRadius: dot * 0.22),
                           with: .color(color(0)), lineWidth: max(1, thickness * 0.65))
        }
    }
}
