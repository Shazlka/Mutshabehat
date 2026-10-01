import CoreText
import MushafCore
import UIKit

extension UIColor {
    static let mushafPaper = UIColor(red: 1, green: 0.992, blue: 0.965, alpha: 1)       // #fffdf6
    static let mushafDesk = UIColor(red: 0.953, green: 0.929, blue: 0.867, alpha: 1)    // behind the page
    static let mushafInk = UIColor(red: 0.09, green: 0.09, blue: 0.09, alpha: 1)        // #171717
    static let mushafGold = UIColor(red: 0.604, green: 0.482, blue: 0.208, alpha: 1)    // #9a7b35
    static let mushafBrown = UIColor(red: 0.349, green: 0.275, blue: 0.114, alpha: 1)   // #59461d
}

/// Draws one Mushaf page with CoreText from a `PageLayout`: one draw pass per page, no view per word,
/// so a page turn stays cheap. Words are positioned by `PageLayout` (right to left), never by CoreText.
/// With the Qiraat layer on, marked words take their colours and marks (see `WordMarks`) and each one
/// is also an accessibility element ("qiraat-word-<surah>:<ayah>:<token>").
final class MushafPageView: UIView {
    let page: MushafPage
    private let library: MushafLibrary
    private(set) var layout: PageLayout?
    /// The Qiraat layer as the reader set it; marks are recomputed only when this or the layout changes.
    var qiraat: QiraatDisplay = .off {
        didSet { if qiraat != oldValue { refreshQiraatMarks() } }
    }
    private(set) var marks: [String: WordMarks] = [:]

    init(page: MushafPage, library: MushafLibrary) {
        self.page = page
        self.library = library
        super.init(frame: .zero)
        backgroundColor = .mushafPaper
        contentMode = .redraw
        isAccessibilityElement = false
        layer.shadowColor = UIColor(red: 0.25, green: 0.19, blue: 0.08, alpha: 1).cgColor
        layer.shadowOpacity = 0.12
        layer.shadowRadius = 12
        layer.shadowOffset = CGSize(width: 0, height: 6)
        updateAccessibilityElements()
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    private func layoutPage() {
        guard bounds.width > 0, layout?.pageSize != bounds.size else { return }
        let fonts = library.fonts, number = page.number
        layout = PageLayout(page: page, pageSize: bounds.size, surahAyahCounts: library.surahAyahCounts) { word, size in
            (try? fonts.advance(of: word.glyph, page: number, size: size)) ?? 0
        }
        refreshQiraatMarks()
    }

    private func refreshQiraatMarks() {
        var next: [String: WordMarks] = [:]
        if qiraat.enabled, let layout, let pageMarks = library.qiraat?.marks(page: page.number) {
            for box in layout.lines.flatMap(\.boxes) {
                if let m = pageMarks.wordMarks(for: box.word, filter: qiraat.filter) { next[box.word.id] = m }
            }
        }
        marks = next
        updateAccessibilityElements()
        setNeedsDisplay()
    }

    /// The page itself, then every Qiraat-marked word (so VoiceOver and UI tests can reach them).
    private func updateAccessibilityElements() {
        let pageElement = UIAccessibilityElement(accessibilityContainer: self)
        pageElement.accessibilityLabel = "صفحة \(page.number)"
        pageElement.accessibilityIdentifier = "mushaf-page-\(page.number)"
        pageElement.accessibilityFrameInContainerSpace = bounds
        var elements: [Any] = [pageElement]
        for box in layout?.lines.flatMap(\.boxes) ?? [] where marks[box.word.id] != nil {
            let word = box.word
            let element = UIAccessibilityElement(accessibilityContainer: self)
            element.accessibilityLabel = "\(word.textUthmani)، فيها قراءات"
            element.accessibilityIdentifier = "qiraat-word-\(word.ayahKey.surah):\(word.ayahKey.ayah):\(word.indexInAyah)"
            element.accessibilityTraits = .button
            element.accessibilityFrameInContainerSpace = box.frame
            elements.append(element)
        }
        accessibilityElements = elements
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        layoutPage()
    }

    /// The marked word under `point` (page coordinates), with a little slop around its glyph box.
    func markedWord(at point: CGPoint) -> MushafWord? {
        guard let layout, !marks.isEmpty else { return nil }
        let slop = layout.fontSize * 0.2
        return layout.lines.flatMap(\.boxes).first {
            marks[$0.word.id] != nil && $0.frame.insetBy(dx: -slop, dy: -slop).contains(point)
        }?.word
    }

    override func draw(_ rect: CGRect) {
        guard let layout, let context = UIGraphicsGetCurrentContext() else { return }
        drawMargins()
        guard let font = try? library.fonts.font(page: page.number, size: layout.fontSize) else {
            // Never a blank page: say which page's font is missing (a damaged or partial install).
            drawCentred("تعذّر تحميل خط الصفحة \(page.number)", in: bounds, size: layout.fontSize * 0.8, weight: .semibold)
            return
        }
        for line in layout.lines {
            switch line.content {
            case let .words(boxes, _):
                for box in boxes { drawWord(box, font: font, in: context) }
            case let .surahHeader(number):
                drawCentred("سورة \(library.surahNames[number] ?? "\(number)")", in: line.rect,
                            size: layout.fontSize * 0.9, weight: .bold)
            case .basmala:
                drawCentred("بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ", in: line.rect, size: layout.fontSize * 0.85, weight: .regular)
            case .empty:
                break
            }
        }
    }

    private func drawWord(_ box: WordBox, font: CTFont, in context: CGContext) {
        let mark = marks[box.word.id]
        let line = QCFFontStore.line(box.word.glyph, font: font,
                                     color: mark.map { UIColor(qiraatHex: $0.textColor).cgColor } ?? UIColor.mushafInk.cgColor)
        let natural = CGFloat(CTLineGetTypographicBounds(line, nil, nil, nil))
        context.saveGState()
        // UIKit is y-down, CoreText y-up. A condensed line (PageLayout squeeze) scales the glyph to its box.
        context.translateBy(x: box.frame.minX, y: box.frame.maxY)
        context.scaleBy(x: natural > 0 ? box.frame.width / natural : 1, y: -1)
        context.textPosition = CGPoint(x: 0, y: box.frame.height * 0.28)
        CTLineDraw(line, context)
        context.restoreGState()
        if let mark, let layout { drawQiraatMarks(mark, around: box.frame, fontSize: layout.fontSize, in: context) }
    }

    /// The web's marks, scaled to the glyph size: the variant bar under the word (one equal segment per
    /// reader, left to right in reader order), a dotted underline for ذو وجهين, a dot at the top-left for
    /// more than one usul family, and the إمالة/تقليل dot (filled / ring) at the bottom-left.
    private func drawQiraatMarks(_ mark: WordMarks, around frame: CGRect, fontSize: CGFloat, in context: CGContext) {
        let thickness = max(1.2, fontSize * 0.06)
        let dot = max(3, fontSize * 0.16)
        context.saveGState()
        switch mark.underline {
        case .solid(let hex):
            context.setFillColor(UIColor(qiraatHex: hex).cgColor)
            context.fill(CGRect(x: frame.minX, y: frame.maxY, width: frame.width, height: thickness))
        case .segments(let colors):
            let width = frame.width / CGFloat(max(colors.count, 1))
            for (i, hex) in colors.enumerated() {
                context.setFillColor(UIColor(qiraatHex: hex).cgColor)
                context.fill(CGRect(x: frame.minX + CGFloat(i) * width, y: frame.maxY, width: width, height: thickness))
            }
        case nil:
            break
        }
        if let hex = mark.dottedUnderlineColor {
            let y = frame.maxY + thickness * 2.6
            context.setStrokeColor(UIColor(qiraatHex: hex).cgColor)
            context.setLineWidth(thickness * 0.9)
            context.setLineDash(phase: 0, lengths: [thickness, thickness * 1.3])
            context.strokeLineSegments(between: [CGPoint(x: frame.minX, y: y), CGPoint(x: frame.maxX, y: y)])
            context.setLineDash(phase: 0, lengths: [])
        }
        if let hex = mark.familyDotColor {
            context.setFillColor(UIColor(qiraatHex: hex).cgColor)
            context.fillEllipse(in: CGRect(x: frame.minX - dot * 0.7, y: frame.minY, width: dot, height: dot))
        }
        if let imalah = mark.imalahDot {
            let rect = CGRect(x: frame.minX - dot * 0.7, y: frame.maxY + thickness * 3.6, width: dot, height: dot)
            let color = UIColor(qiraatHex: imalah.color).cgColor
            if imalah.filled {
                context.setFillColor(color)
                context.fillEllipse(in: rect)
            } else {
                context.setStrokeColor(color)
                context.setLineWidth(max(1, dot * 0.28))
                context.strokeEllipse(in: rect.insetBy(dx: dot * 0.14, dy: dot * 0.14))
            }
        }
        context.restoreGState()
    }

    private func drawMargins() {
        let meta = page.metadata
        let attributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.boldSystemFont(ofSize: max(8, bounds.width * 0.022)),
            .foregroundColor: UIColor.mushafGold,
        ]
        let inset = bounds.width * 0.055, top = bounds.width * 0.014
        let juz = "الجزء \(meta.juz) · الحزب \(meta.hizb) · الربع \(meta.rubInJuz)/8" as NSString
        juz.draw(at: CGPoint(x: inset, y: top), withAttributes: attributes)
        let names = meta.surahNames.joined(separator: " · ") as NSString
        names.draw(at: CGPoint(x: bounds.width - inset - names.size(withAttributes: attributes).width, y: top),
                   withAttributes: attributes)
        let number = "\(page.number)" as NSString
        let size = number.size(withAttributes: attributes)
        number.draw(at: CGPoint(x: bounds.midX - size.width / 2, y: bounds.height - size.height - top),
                    withAttributes: attributes)
    }

    private func drawCentred(_ text: String, in rect: CGRect, size: CGFloat, weight: UIFont.Weight) {
        let attributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: size, weight: weight),
            .foregroundColor: UIColor.mushafBrown,
        ]
        let string = text as NSString
        let measured = string.size(withAttributes: attributes)
        string.draw(at: CGPoint(x: rect.midX - measured.width / 2, y: rect.midY - measured.height / 2),
                    withAttributes: attributes)
    }
}
