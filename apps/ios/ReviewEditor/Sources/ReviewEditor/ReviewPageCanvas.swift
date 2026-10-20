#if DEBUG
import CoreText
import MushafCore
import SwiftUI
import UIKit

/// How a word is tinted on the review page. Three states, three colours; the selected word gets a ring.
enum ReviewWordStyle {
    enum Tint: Equatable {
        case reviewed, unreviewed, flagged

        var color: UIColor {
            switch self {
            case .reviewed: UIColor.systemGreen.withAlphaComponent(0.26)
            case .unreviewed: UIColor.systemOrange.withAlphaComponent(0.34)
            case .flagged: UIColor.systemRed.withAlphaComponent(0.34)
            }
        }
    }

    static func tint(for status: WordStatus?) -> Tint? {
        switch status {
        case .none: nil
        case .reviewed?: .reviewed
        case .unreviewed?: .unreviewed
        case .flagged?: .flagged
        }
    }

    static func drawsRing(selected: Bool) -> Bool { selected }
}

/// A read-only Mushaf page for the review editor, drawn with the same `PageLayout` and page fonts as the
/// reader but separate from it: words carry a status tint, the selected words a ring, and a tap reports the
/// word's review key. Only real words are tappable; ayah markers and decorations are not.
final class ReviewPageUIView: UIView {
    private var page: MushafPage?
    private var fonts: QCFFontStore?
    private var surahAyahCounts: [Int: Int] = [:]
    private var surahNames: [Int: String] = [:]
    private var palette = ReviewPalette(paper: .systemBackground, ink: .label, gold: .systemYellow, brown: .brown)
    private var mushafFont: (CGFloat) -> UIFont = { UIFont.systemFont(ofSize: $0) }
    private var statusFor: (String) -> WordStatus? = { _ in nil }
    private var selectedKeys: Set<String> = []
    private var onTap: (String) -> Void = { _ in }
    private(set) var currentLayout: PageLayout?

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = palette.paper
        contentMode = .redraw
        layer.cornerRadius = 6
        layer.masksToBounds = true
        addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(tapped(_:))))
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    @MainActor
    func configure(page: MushafPage, library: ReviewHost, statusFor: @escaping (String) -> WordStatus?,
                   selectedKeys: Set<String>, onTap: @escaping (String) -> Void) {
        let samePage = self.page?.number == page.number
        self.page = page
        fonts = library.fonts
        mushafFont = library.mushafFont
        palette = library.palette
        backgroundColor = palette.paper
        surahAyahCounts = library.surahAyahCounts
        surahNames = library.surahNames
        self.statusFor = statusFor
        self.selectedKeys = selectedKeys
        self.onTap = onTap
        if !samePage { currentLayout = nil }
        layoutPage()
        refreshAccessibility()
        setNeedsDisplay()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        layoutPage()
        refreshAccessibility()
    }

    private func layoutPage() {
        guard let page, let fonts, bounds.width > 0, currentLayout?.pageSize != bounds.size else { return }
        let number = page.number
        currentLayout = PageLayout(page: page, pageSize: bounds.size, surahAyahCounts: surahAyahCounts) { word, size in
            (try? fonts.advance(of: word.glyph, page: number, size: size)) ?? 0
        }
    }

    // MARK: Drawing

    override func draw(_ rect: CGRect) {
        guard let layout = currentLayout, let page, let fonts, let context = UIGraphicsGetCurrentContext() else { return }
        guard let font = try? fonts.font(page: page.number, size: layout.fontSize) else {
            draw("تعذّر تحميل خط الصفحة \(page.number)", in: bounds, size: layout.fontSize * 0.7)
            return
        }
        for line in layout.lines {
            switch line.content {
            case .words(let boxes, _):
                for box in boxes { drawWord(box, font: font, in: context) }
            case .surahHeader(let number):
                drawHeader(surahNames[number] ?? "\(number)", in: line.rect, size: layout.fontSize)
            case .basmala:
                drawBasmala(in: line.rect, fontSize: layout.fontSize, fonts: fonts, context: context)
            case .empty:
                break
            }
        }
    }

    private func drawWord(_ box: WordBox, font: CTFont, in context: CGContext) {
        let key = ReviewWordKeys.key(for: box.word)
        let selected = key.map(selectedKeys.contains) ?? false
        if let key, let tint = ReviewWordStyle.tint(for: statusFor(key)) {
            context.setFillColor(tint.color.cgColor)
            context.fill(box.frame.insetBy(dx: -1.5, dy: -1))
        }
        if selected && ReviewWordStyle.drawsRing(selected: true) {
            let ring = UIBezierPath(roundedRect: box.frame.insetBy(dx: -3, dy: -2), cornerRadius: 4)
            context.setStrokeColor(tintColor.cgColor)
            context.setLineWidth(2)
            context.addPath(ring.cgPath)
            context.strokePath()
        }
        let line = QCFFontStore.line(box.word.glyph, font: font, color: palette.ink.cgColor)
        let natural = CGFloat(CTLineGetTypographicBounds(line, nil, nil, nil))
        context.saveGState()
        context.translateBy(x: box.frame.minX, y: box.frame.maxY)
        context.scaleBy(x: natural > 0 ? box.frame.width / natural : 1, y: -1)
        context.textPosition = CGPoint(x: 0, y: box.frame.height * 0.28)
        CTLineDraw(line, context)
        context.restoreGState()
    }

    private func drawHeader(_ name: String, in rect: CGRect, size: CGFloat) {
        let frame = rect.insetBy(dx: 2, dy: max(1.5, rect.height * 0.08))
        let path = UIBezierPath(roundedRect: frame, cornerRadius: frame.height * 0.3)
        palette.gold.setStroke()
        path.lineWidth = 1.5
        path.stroke()
        draw(name, in: frame, size: size * 0.8, color: palette.brown)
    }

    private func drawBasmala(in rect: CGRect, fontSize: CGFloat, fonts: QCFFontStore, context: CGContext) {
        guard let p1 = try? fonts.font(page: 1, size: fontSize * 1.05) else { return }
        let glyphs = ["ﱁ", "ﱂ", "ﱃ", "ﱄ"]
        let lines = glyphs.map { QCFFontStore.line($0, font: p1, color: palette.ink.cgColor) }
        let widths = lines.map { CGFloat(CTLineGetTypographicBounds($0, nil, nil, nil)) }
        let gap = fontSize * PageLayoutConstants.centredGapEm
        var x = rect.midX + (widths.reduce(0, +) + CGFloat(glyphs.count - 1) * gap) / 2
        let height = fontSize * 1.15
        let top = rect.midY - height / 2
        for (line, width) in zip(lines, widths) {
            context.saveGState()
            context.translateBy(x: x - width, y: top + height)
            context.scaleBy(x: 1, y: -1)
            context.textPosition = CGPoint(x: 0, y: height * 0.28)
            CTLineDraw(line, context)
            context.restoreGState()
            x -= width + gap
        }
    }

    private func draw(_ text: String, in rect: CGRect, size: CGFloat, color: UIColor? = nil) {
        let font = mushafFont(size)
        let style = NSMutableParagraphStyle()
        style.alignment = .center
        let attributes: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: color ?? palette.ink, .paragraphStyle: style]
        let height = (text as NSString).size(withAttributes: attributes).height
        (text as NSString).draw(in: CGRect(x: rect.minX, y: rect.midY - height / 2, width: rect.width, height: height),
                                withAttributes: attributes)
    }

    // MARK: Taps and accessibility

    @objc private func tapped(_ recognizer: UITapGestureRecognizer) {
        handleTap(at: recognizer.location(in: self))
    }

    func handleTap(at point: CGPoint) {
        guard let word = currentLayout?.word(at: point), let key = ReviewWordKeys.key(for: word) else { return }
        onTap(key)
    }

    private func refreshAccessibility() {
        guard let layout = currentLayout else { accessibilityElements = []; return }
        accessibilityElements = layout.lines.flatMap(\.boxes).compactMap { box -> UIAccessibilityElement? in
            guard let key = ReviewWordKeys.key(for: box.word) else { return nil }
            let element = UIAccessibilityElement(accessibilityContainer: self)
            element.accessibilityIdentifier = "review-word-\(key)"
            element.accessibilityLabel = box.word.textUthmani
            element.accessibilityValue = switch statusFor(key) {
            case .reviewed?: "معتمد"
            case .unreviewed?: "غير مراجَع"
            case .flagged?: "معلَّم"
            case nil: "بلا وجه مسجّل"
            }
            element.accessibilityTraits = selectedKeys.contains(key) ? [.button, .selected] : .button
            element.accessibilityFrameInContainerSpace = box.frame.insetBy(dx: -2, dy: -4)
            return element
        }
    }
}

struct ReviewPageCanvas: UIViewRepresentable {
    let page: MushafPage
    let library: ReviewHost
    let statusFor: (String) -> WordStatus?
    let selectedKeys: Set<String>
    let onTap: (String) -> Void

    func makeUIView(context: Context) -> ReviewPageUIView { ReviewPageUIView() }

    func updateUIView(_ view: ReviewPageUIView, context: Context) {
        view.configure(page: page, library: library, statusFor: statusFor, selectedKeys: selectedKeys, onTap: onTap)
    }
}
#endif
