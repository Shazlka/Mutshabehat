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
final class MushafPageView: UIView {
    let page: MushafPage
    private let library: MushafLibrary
    private(set) var layout: PageLayout?

    init(page: MushafPage, library: MushafLibrary) {
        self.page = page
        self.library = library
        super.init(frame: .zero)
        backgroundColor = .mushafPaper
        contentMode = .redraw
        isAccessibilityElement = true
        accessibilityLabel = "صفحة \(page.number)"
        accessibilityIdentifier = "mushaf-page-\(page.number)"
        layer.shadowColor = UIColor(red: 0.25, green: 0.19, blue: 0.08, alpha: 1).cgColor
        layer.shadowOpacity = 0.12
        layer.shadowRadius = 12
        layer.shadowOffset = CGSize(width: 0, height: 6)
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    override func layoutSubviews() {
        super.layoutSubviews()
        guard bounds.width > 0, layout?.pageSize != bounds.size else { return }
        let fonts = library.fonts, number = page.number
        layout = PageLayout(page: page, pageSize: bounds.size, surahAyahCounts: library.surahAyahCounts) { word, size in
            (try? fonts.advance(of: word.glyph, page: number, size: size)) ?? 0
        }
        setNeedsDisplay()
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
        let line = QCFFontStore.line(box.word.glyph, font: font)
        let natural = CGFloat(CTLineGetTypographicBounds(line, nil, nil, nil))
        context.saveGState()
        // UIKit is y-down, CoreText y-up. A condensed line (PageLayout squeeze) scales the glyph to its box.
        context.translateBy(x: box.frame.minX, y: box.frame.maxY)
        context.scaleBy(x: natural > 0 ? box.frame.width / natural : 1, y: -1)
        context.textPosition = CGPoint(x: 0, y: box.frame.height * 0.28)
        context.setFillColor(UIColor.mushafInk.cgColor)
        CTLineDraw(line, context)
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
