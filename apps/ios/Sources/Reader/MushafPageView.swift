import CoreText
import MushafCore
import UIKit

extension UIColor {
    static let mushafPaper = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.11, green: 0.105, blue: 0.09, alpha: 1)
            : UIColor(red: 1, green: 0.992, blue: 0.965, alpha: 1)
    }
    static let mushafDesk = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.055, green: 0.05, blue: 0.04, alpha: 1)
            : UIColor(red: 0.953, green: 0.929, blue: 0.867, alpha: 1)
    }
    static let mushafInk = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.92, green: 0.91, blue: 0.86, alpha: 1)
            : UIColor(red: 0.09, green: 0.09, blue: 0.09, alpha: 1)
    }
    static let mushafGold = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.78, green: 0.67, blue: 0.38, alpha: 1)
            : UIColor(red: 0.604, green: 0.482, blue: 0.208, alpha: 1)
    }
    static let mushafBrown = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.82, green: 0.74, blue: 0.55, alpha: 1)
            : UIColor(red: 0.349, green: 0.275, blue: 0.114, alpha: 1)
    }
}

/// Draws one Mushaf page with CoreText from a `PageLayout`: one draw pass per page, no view per word,
/// so a page turn stays cheap. Words are positioned by `PageLayout` (right to left), never by CoreText.
/// With the Qiraat layer on, marked words take their colours and marks (see `WordMarks`) and each one
/// is also an accessibility element ("qiraat-word-<surah>:<ayah>:<token>").
final class MushafPageView: UIView {
    let page: MushafPage
    private let library: MushafLibrary
    var appearance: MushafAppearance {
        didSet {
            guard appearance != oldValue else { return }
            backgroundColor = appearance.paper(for: traitCollection)
            setNeedsDisplay()
        }
    }
    private(set) var layout: PageLayout?
    /// The Qiraat layer as the reader set it; marks are recomputed only when this or the layout changes.
    var qiraat: QiraatDisplay = .off {
        didSet { if qiraat != oldValue { refreshQiraatMarks() } }
    }
    var highlightedWordIDs: Set<String> = [] {
        didSet {
            if highlightedWordIDs != oldValue {
                updateAccessibilityElements()
                setNeedsDisplay()
            }
        }
    }
    var bookmarkedAyahs: Set<AyahKey> = [] {
        didSet {
            if bookmarkedAyahs != oldValue {
                setNeedsDisplay()
            }
        }
    }
    var isPageBookmarked: Bool = false {
        didSet {
            if isPageBookmarked != oldValue {
                setNeedsDisplay()
            }
        }
    }
    var isSpreadHalf: Bool = false {
        didSet {
            if isSpreadHalf != oldValue {
                setNeedsDisplay()
            }
        }
    }
    var spineSide: PageLayoutConstants.SpineSide = .none {
        didSet {
            if spineSide != oldValue {
                setNeedsDisplay()
            }
        }
    }
    private(set) var marks: [String: WordMarks] = [:]

    init(page: MushafPage, library: MushafLibrary, appearance: MushafAppearance) {
        self.page = page
        self.library = library
        self.appearance = appearance
        super.init(frame: .zero)
        backgroundColor = appearance.paper(for: traitCollection)
        contentMode = .redraw
        isAccessibilityElement = false
        layer.shadowColor = UIColor(red: 0.25, green: 0.19, blue: 0.08, alpha: 1).cgColor
        layer.shadowOpacity = 0.12
        layer.shadowRadius = 12
        layer.shadowOffset = CGSize(width: 0, height: 6)
        registerForTraitChanges([UITraitUserInterfaceStyle.self]) { (view: MushafPageView, _) in
            view.backgroundColor = view.appearance.paper(for: view.traitCollection)
            view.setNeedsDisplay()
        }
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
        for box in layout?.lines.flatMap(\.boxes) ?? []
            where marks[box.word.id] != nil || highlightedWordIDs.contains(box.word.id) {
            let word = box.word
            let element = UIAccessibilityElement(accessibilityContainer: self)
            if marks[word.id] != nil {
                element.accessibilityLabel = "\(word.textUthmani)، فيها قراءات"
                element.accessibilityIdentifier = "qiraat-word-\(word.ayahKey.surah):\(word.ayahKey.ayah):\(word.indexInAyah)"
                element.accessibilityTraits = .button
            } else {
                element.accessibilityLabel = "نتيجة البحث: \(word.textUthmani)"
                element.accessibilityIdentifier = "search-highlighted-word"
                element.accessibilityTraits = .staticText
            }
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

    /// Locates the Ayah under `point`. Prioritizes ayah end-markers, then any word of the ayah.
    func ayahKey(at point: CGPoint) -> AyahKey? {
        guard let layout else { return nil }
        let slop = layout.fontSize * 0.45
        let boxes = layout.lines.flatMap(\.boxes)
        // Check if user tapped directly on or near an ayah end glyph
        if let endBox = boxes.first(where: {
            $0.word.charType == .end && $0.frame.insetBy(dx: -slop, dy: -slop).contains(point)
        }) {
            return endBox.word.ayahKey
        }
        // Fallback: check any word box
        if let wordBox = boxes.first(where: {
            $0.frame.insetBy(dx: -slop * 0.3, dy: -slop * 0.3).contains(point)
        }) {
            return wordBox.word.ayahKey
        }
        return nil
    }

    override func draw(_ rect: CGRect) {
        guard let layout, let context = UIGraphicsGetCurrentContext() else { return }
        guard let font = try? library.fonts.font(page: page.number, size: layout.fontSize) else {
            // Never a blank page: say which page's font is missing (a damaged or partial install).
            drawCentred("تعذّر تحميل خط الصفحة \(page.number)", in: bounds, size: layout.fontSize * 0.8, weight: .semibold)
            return
        }

        // Draw page bookmark ribbon if this page is bookmarked
        if isPageBookmarked {
            drawPageBookmarkRibbon(in: context)
        }

        // Draw physical book spine curvature and page edge shadows
        if isSpreadHalf && spineSide != .none {
            drawBookSpineAndPageEdges(in: context)
        }

        for line in layout.lines {
            switch line.content {
            case let .words(boxes, _):
                for box in boxes { drawWord(box, font: font, in: context) }
            case let .surahHeader(number):
                drawSurahHeader(number: number, in: line.rect, fontSize: layout.fontSize, context: context)
            case .basmala:
                drawBasmala(in: line.rect, fontSize: layout.fontSize, in: context)
            case .empty:
                break
            }
        }
    }

    private func drawPageBookmarkRibbon(in context: CGContext) {
        let ribbonWidth: CGFloat = max(14, bounds.width * 0.038)
        let ribbonHeight: CGFloat = max(24, bounds.height * 0.045)
        let ribbonX = page.isRightHandPage ? bounds.width * 0.08 : bounds.width * 0.92 - ribbonWidth
        let ribbonRect = CGRect(x: ribbonX, y: 0, width: ribbonWidth, height: ribbonHeight)

        context.saveGState()
        let ribbonColor = UIColor(red: 0.76, green: 0.22, blue: 0.18, alpha: 0.95)
        let goldBorder = appearance.gold(for: traitCollection)

        let path = UIBezierPath()
        path.move(to: CGPoint(x: ribbonRect.minX, y: ribbonRect.minY))
        path.addLine(to: CGPoint(x: ribbonRect.maxX, y: ribbonRect.minY))
        path.addLine(to: CGPoint(x: ribbonRect.maxX, y: ribbonRect.maxY))
        path.addLine(to: CGPoint(x: ribbonRect.midX, y: ribbonRect.maxY - ribbonHeight * 0.28))
        path.addLine(to: CGPoint(x: ribbonRect.minX, y: ribbonRect.maxY))
        path.close()

        context.setFillColor(ribbonColor.cgColor)
        context.addPath(path.cgPath)
        context.fillPath()

        context.setStrokeColor(goldBorder.cgColor)
        context.setLineWidth(1.2)
        context.addPath(path.cgPath)
        context.strokePath()

        // Delicate inner stitch line
        let innerPath = UIBezierPath()
        let inset: CGFloat = 2.0
        innerPath.move(to: CGPoint(x: ribbonRect.minX + inset, y: ribbonRect.minY))
        innerPath.addLine(to: CGPoint(x: ribbonRect.maxX - inset, y: ribbonRect.minY))
        innerPath.addLine(to: CGPoint(x: ribbonRect.maxX - inset, y: ribbonRect.maxY - inset * 1.5))
        innerPath.addLine(to: CGPoint(x: ribbonRect.midX, y: ribbonRect.maxY - ribbonHeight * 0.28 - inset))
        innerPath.addLine(to: CGPoint(x: ribbonRect.minX + inset, y: ribbonRect.maxY - inset * 1.5))
        innerPath.close()

        context.setStrokeColor(goldBorder.withAlphaComponent(0.6).cgColor)
        context.setLineWidth(0.6)
        context.addPath(innerPath.cgPath)
        context.strokePath()

        context.restoreGState()
    }

    private func drawBookSpineAndPageEdges(in context: CGContext) {
        guard isSpreadHalf && spineSide != .none else { return }
        context.saveGState()

        let width = bounds.width
        let height = bounds.height
        let isLeftSpine = (spineSide == .left)   // Right page of spread (spine on its left edge)

        // 1. Center Spine Gutter Shadow (Deep curvature fold where pages meet)
        let spineWidth: CGFloat = min(46, width * 0.085)
        let spineRect: CGRect
        let startPoint: CGPoint
        let endPoint: CGPoint

        if isLeftSpine {
            // Spine is on the left edge (x: 0 ..< spineWidth)
            spineRect = CGRect(x: 0, y: 0, width: spineWidth, height: height)
            startPoint = CGPoint(x: 0, y: 0)
            endPoint = CGPoint(x: spineWidth, y: 0)
        } else {
            // Spine is on the right edge (x: width - spineWidth ..< width)
            spineRect = CGRect(x: width - spineWidth, y: 0, width: spineWidth, height: height)
            startPoint = CGPoint(x: width, y: 0)
            endPoint = CGPoint(x: width - spineWidth, y: 0)
        }

        let isDark = traitCollection.userInterfaceStyle == .dark
        let foldColor = isDark ? UIColor(white: 0, alpha: 0.55) : UIColor(white: 0, alpha: 0.22)
        let midColor = isDark ? UIColor(white: 0, alpha: 0.20) : UIColor(white: 0, alpha: 0.08)
        let clearColor = UIColor(white: 0, alpha: 0.0)

        let colorSpace = CGColorSpaceCreateDeviceRGB()
        let spineColors = [foldColor.cgColor, midColor.cgColor, clearColor.cgColor] as CFArray
        let spineLocations: [CGFloat] = [0.0, 0.32, 1.0]

        if let gradient = CGGradient(colorsSpace: colorSpace, colors: spineColors, locations: spineLocations) {
            context.saveGState()
            context.clip(to: spineRect)
            context.drawLinearGradient(gradient, start: startPoint, end: endPoint, options: [])
            context.restoreGState()
        }

        // 2. Subtle specular highlight / sheen simulating the cylinder curve of the page turning up from the spine
        let sheenOffset: CGFloat = 10
        let sheenWidth: CGFloat = 12
        let sheenRect = isLeftSpine
            ? CGRect(x: sheenOffset, y: 0, width: sheenWidth, height: height)
            : CGRect(x: width - sheenOffset - sheenWidth, y: 0, width: sheenWidth, height: height)
        let sheenColor = isDark ? UIColor(white: 1, alpha: 0.04) : UIColor(white: 1, alpha: 0.16)
        let sheenColors = [clearColor.cgColor, sheenColor.cgColor, clearColor.cgColor] as CFArray
        let sheenLocations: [CGFloat] = [0.0, 0.5, 1.0]

        if let sheenGrad = CGGradient(colorsSpace: colorSpace, colors: sheenColors, locations: sheenLocations) {
            context.saveGState()
            context.clip(to: sheenRect)
            let sStart = CGPoint(x: sheenRect.minX, y: 0)
            let sEnd = CGPoint(x: sheenRect.maxX, y: 0)
            context.drawLinearGradient(sheenGrad, start: sStart, end: sEnd, options: [])
            context.restoreGState()
        }

        // 3. Fine book fold crease line right at the spine edge
        context.setStrokeColor(foldColor.cgColor)
        context.setLineWidth(1.0)
        let creaseX: CGFloat = isLeftSpine ? 0.5 : width - 0.5
        context.strokeLineSegments(between: [CGPoint(x: creaseX, y: 0), CGPoint(x: creaseX, y: height)])

        // 4. Subtle top and bottom book curl curvature (soft vignette at top & bottom near spine)
        let cornerGradHeight: CGFloat = min(40, height * 0.06)
        let topCornerRect = isLeftSpine
            ? CGRect(x: 0, y: 0, width: spineWidth * 1.6, height: cornerGradHeight)
            : CGRect(x: width - spineWidth * 1.6, y: 0, width: spineWidth * 1.6, height: cornerGradHeight)

        let vShadowColor = isDark ? UIColor(white: 0, alpha: 0.16) : UIColor(white: 0, alpha: 0.06)
        let vColors = [vShadowColor.cgColor, clearColor.cgColor] as CFArray
        if let vGrad = CGGradient(colorsSpace: colorSpace, colors: vColors, locations: [0.0, 1.0]) {
            context.saveGState()
            context.clip(to: topCornerRect)
            context.drawLinearGradient(vGrad, start: CGPoint(x: topCornerRect.midX, y: 0), end: CGPoint(x: topCornerRect.midX, y: cornerGradHeight), options: [])
            context.restoreGState()

            let bottomCornerRect = CGRect(x: topCornerRect.minX, y: height - cornerGradHeight, width: topCornerRect.width, height: cornerGradHeight)
            context.saveGState()
            context.clip(to: bottomCornerRect)
            context.drawLinearGradient(vGrad, start: CGPoint(x: bottomCornerRect.midX, y: height), end: CGPoint(x: bottomCornerRect.midX, y: height - cornerGradHeight), options: [])
            context.restoreGState()
        }

        // 5. Outer edge page rim (paper edge depth on the side away from the spine)
        let outerEdgeRect = isLeftSpine
            ? CGRect(x: width - 4, y: 0, width: 4, height: height)
            : CGRect(x: 0, y: 0, width: 4, height: height)
        let outerEdgeColor = isDark ? UIColor(white: 0, alpha: 0.22) : UIColor(white: 0, alpha: 0.08)
        let outerColors = isLeftSpine
            ? [clearColor.cgColor, outerEdgeColor.cgColor] as CFArray
            : [outerEdgeColor.cgColor, clearColor.cgColor] as CFArray
        if let outerGrad = CGGradient(colorsSpace: colorSpace, colors: outerColors, locations: [0.0, 1.0]) {
            context.saveGState()
            context.clip(to: outerEdgeRect)
            context.drawLinearGradient(outerGrad, start: CGPoint(x: outerEdgeRect.minX, y: 0), end: CGPoint(x: outerEdgeRect.maxX, y: 0), options: [])
            context.restoreGState()
        }

        context.restoreGState()
    }

    private struct BannerParts {
        let leftWing: CGImage
        let rightWing: CGImage
        let midLine: CGImage
    }

    private static let bannerParts: BannerParts? = {
        let rawImage: UIImage?
        if let img = UIImage(named: "SurahBannerTemplate") {
            rawImage = img
        } else if let path = Bundle.main.path(forResource: "SurahBannerTemplate", ofType: "png"),
                  let img = UIImage(contentsOfFile: path) {
            rawImage = img
        } else if let path = Bundle(for: MushafPageView.self).path(forResource: "SurahBannerTemplate", ofType: "png"),
                  let img = UIImage(contentsOfFile: path) {
            rawImage = img
        } else {
            rawImage = nil
        }
        guard let image = rawImage, let cgImage = image.cgImage else { return nil }

        let scale = CGFloat(cgImage.height) / 60.0
        let wingWidthPx = Int(round(180.0 * scale))
        let midWidthPx = max(2, Int(round(20.0 * scale)))
        let midXPx = Int(round(220.0 * scale))

        guard let leftCG = cgImage.cropping(to: CGRect(x: 0, y: 0, width: wingWidthPx, height: cgImage.height)),
              let rightCG = cgImage.cropping(to: CGRect(x: cgImage.width - wingWidthPx, y: 0, width: wingWidthPx, height: cgImage.height)),
              let midCG = cgImage.cropping(to: CGRect(x: midXPx, y: 0, width: midWidthPx, height: cgImage.height)) else {
            return nil
        }

        return BannerParts(leftWing: leftCG, rightWing: rightCG, midLine: midCG)
    }()

    private static let canonicalSurahTitles: [Int: String] = [
        1: "الفَاتِحَةِ", 2: "البَقَرَةِ", 3: "آلِ عِمْرَانَ", 4: "النِّسَاءِ", 5: "المَائِدَةِ",
        6: "الأَنْعَامِ", 7: "الأَعْرَافِ", 8: "الأَنْفَالِ", 9: "التَّوْبَةِ", 10: "يُونُسَ",
        11: "هُودٍ", 12: "يُوسُفَ", 13: "الرَّعْدِ", 14: "إِبْرَاهِيمَ", 15: "الحِجْرِ",
        16: "النَّحْلِ", 17: "الإِسْرَاءِ", 18: "الكَهْفِ", 19: "مَرْيَمَ", 20: "طه",
        21: "الأَنْبِيَاءِ", 22: "الحَجِّ", 23: "المُؤْمِنُونَ", 24: "النُّورِ", 25: "الفُرْقَانِ",
        26: "الشُّعَرَاءِ", 27: "النَّمْلِ", 28: "القَصَصِ", 29: "العَنْكَبُوتِ", 30: "الرُّومِ",
        31: "لُقْمَانَ", 32: "السَّجْدَةِ", 33: "الأَحْزَابِ", 34: "سَبَإٍ", 35: "فَاطِرٍ",
        36: "يس", 37: "الصَّافَّاتِ", 38: "ص", 39: "الزُّمَرِ", 40: "غَافِرٍ",
        41: "فُصِّلَتْ", 42: "الشُّورَى", 43: "الزُّخْرُفِ", 44: "الدُّخَانِ", 45: "الجَاثِيَةِ",
        46: "الأَحْقَافِ", 47: "مُحَمَّدٍ", 48: "الفَتْحِ", 49: "الحُجُرَاتِ", 50: "ق",
        51: "الذَّارِيَاتِ", 52: "الطُّورِ", 53: "النَّجْمِ", 54: "القَمَرِ", 55: "الرَّحْمَٰنِ",
        56: "الوَاقِعَةِ", 57: "الحَدِيدِ", 58: "المُجَادَلَةِ", 59: "الحَشْرِ", 60: "المُمْتَحَنَةِ",
        61: "الصَّفِّ", 62: "الجُمُعَةِ", 63: "المُنَافِقُونَ", 64: "التَّغَابُنِ", 65: "الطَّلَاقِ",
        66: "التَّحْرِيمِ", 67: "المُلْكِ", 68: "القَلَمِ", 69: "الحَاقَّةِ", 70: "المَعَارِجِ",
        71: "نُوحٍ", 72: "الجِنِّ", 73: "المُزَّمِّلِ", 74: "المُدَّثِّرِ", 75: "القِيَامَةِ",
        76: "الإِنْسَانِ", 77: "المُرْسَلَاتِ", 78: "النَّبَإِ", 79: "النَّازِعَاتِ", 80: "عَبَسَ",
        81: "التَّكْوِيرِ", 82: "الانْفِطَارِ", 83: "المُطَفِّفِينَ", 84: "الانْشِقَاقِ", 85: "البُرُوجِ",
        86: "الطَّارِقِ", 87: "الأَعْلَى", 88: "الغَاشِيَةِ", 89: "الفَجْرِ", 90: "البَلَدِ",
        91: "الشَّمْسِ", 92: "اللَّيْلِ", 93: "الضُّحَى", 94: "الشَّرْحِ", 95: "التِّينِ",
        96: "العَلَقِ", 97: "القَدْرِ", 98: "البَيِّنَةِ", 99: "الزَّلْزَلَةِ", 100: "العَادِيَاتِ",
        101: "القَارِعَةِ", 102: "التَّكَاثُرِ", 103: "العَصْرِ", 104: "الهُمَزَةِ", 105: "الفِيلِ",
        106: "قُرَيْشٍ", 107: "المَاعُونِ", 108: "الكَوْثَرِ", 109: "الكَافِرُونَ", 110: "النَّصْرِ",
        111: "المَسَدِ", 112: "الإِخْلَاصِ", 113: "الفَلَقِ", 114: "النَّاسِ"
    ]

    /// Classical Islamic illuminated Mushaf Surah banner matching traditional manuscript illumination:
    /// Features right roundel (Surah number), left roundel (Ayah count), and central cartouche
    /// (Surah name in authentic Uthmanic calligraphy + Makkiyah/Madaniyah classification).
    private func drawSurahHeader(number: Int, in lineRect: CGRect, fontSize: CGFloat, context: CGContext) {
        let frame = lineRect.insetBy(dx: max(2, bounds.width * 0.008),
                                     dy: max(1.5, lineRect.height * 0.08))
        let isDarkTheme = (appearance == .dark || appearance == .blackPage || traitCollection.userInterfaceStyle == .dark)
        let strokeColor = isDarkTheme ? appearance.gold(for: traitCollection) : appearance.brown(for: traitCollection)
        let titleColor = appearance.ink(for: traitCollection)
        let subtitleColor = isDarkTheme ? appearance.gold(for: traitCollection) : appearance.brown(for: traitCollection)
        let fillColor = appearance.paper(for: traitCollection)

        context.saveGState()
        context.setFillColor(fillColor.cgColor)
        context.fill(frame)
        context.restoreGState()

        guard let parts = Self.bannerParts else {
            drawFallbackSurahHeader(number: number, in: frame, fontSize: fontSize, context: context, strokeColor: strokeColor, goldColor: subtitleColor, fillColor: fillColor)
            return
        }

        let wingWidth = frame.height * (180.0 / 60.0)
        let leftWingRect = CGRect(x: frame.minX, y: frame.minY, width: wingWidth, height: frame.height)
        let rightWingRect = CGRect(x: frame.maxX - wingWidth, y: frame.minY, width: wingWidth, height: frame.height)
        let midRect = CGRect(x: leftWingRect.maxX, y: frame.minY, width: max(0, rightWingRect.minX - leftWingRect.maxX), height: frame.height)

        drawTintedBannerPart(parts.leftWing, in: leftWingRect, color: strokeColor, in: context)
        drawTintedBannerPart(parts.rightWing, in: rightWingRect, color: strokeColor, in: context)
        if midRect.width > 0 {
            drawTintedBannerPart(parts.midLine, in: midRect, color: strokeColor, in: context)
        }

        let surahName = library.surahNames[number] ?? "\(number)"
        let ayahCount = library.surahAyahCounts[number] ?? 0

        let numberFont = MushafLibrary.mushafFont(size: frame.height * 0.44)

        // 1. Right circle: Surah number ONLY (no "سورة" text)
        let rightCircleCenterX = frame.maxX - (119.0 / 60.0) * frame.height
        let rightCircleCenterY = frame.midY

        let rightNum = toArabicDigits(number) as NSString
        let rightNumAttrs: [NSAttributedString.Key: Any] = [
            .font: numberFont,
            .foregroundColor: titleColor
        ]
        let rightNumSize = rightNum.size(withAttributes: rightNumAttrs)
        rightNum.draw(at: CGPoint(x: rightCircleCenterX - rightNumSize.width / 2,
                                  y: rightCircleCenterY - rightNumSize.height / 2),
                      withAttributes: rightNumAttrs)

        // 2. Left circle: Ayah count ONLY (no "آياتها" text)
        let leftCircleCenterX = frame.minX + (117.0 / 60.0) * frame.height
        let leftCircleCenterY = frame.midY

        let leftNum = toArabicDigits(ayahCount) as NSString
        let leftNumAttrs: [NSAttributedString.Key: Any] = [
            .font: numberFont,
            .foregroundColor: titleColor
        ]
        let leftNumSize = leftNum.size(withAttributes: leftNumAttrs)
        leftNum.draw(at: CGPoint(x: leftCircleCenterX - leftNumSize.width / 2,
                                 y: leftCircleCenterY - leftNumSize.height / 2),
                     withAttributes: leftNumAttrs)

        // 3. Center Cartouche: Surah title (aligned in the middle horizontally & vertically, NO makki/madani)
        let cartoucheMidX = frame.midX
        let maxCartoucheWidth = max(80, rightWingRect.minX - leftWingRect.maxX) * 0.88
        let displaySurahName = Self.canonicalSurahTitles[number] ?? surahName
        let titleStr = "سُورَةُ \(displaySurahName)" as NSString

        var titleFontSize = frame.height * 0.52
        var titleAttrs: [NSAttributedString.Key: Any] = [
            .font: MushafLibrary.mushafFont(size: titleFontSize),
            .foregroundColor: titleColor
        ]
        var titleSize = titleStr.size(withAttributes: titleAttrs)
        let targetWidth = maxCartoucheWidth * 0.82
        if titleSize.width > maxCartoucheWidth {
            titleFontSize = max(frame.height * 0.34, titleFontSize * (maxCartoucheWidth / titleSize.width))
        } else if titleSize.width < targetWidth && titleSize.width > 0 {
            let idealSize = titleFontSize * (targetWidth / titleSize.width)
            titleFontSize = min(frame.height * 0.58, idealSize)
        }
        titleAttrs[.font] = MushafLibrary.mushafFont(size: titleFontSize)
        titleSize = titleStr.size(withAttributes: titleAttrs)

        titleStr.draw(at: CGPoint(x: cartoucheMidX - titleSize.width / 2,
                                  y: frame.midY - titleSize.height / 2),
                      withAttributes: titleAttrs)
    }

    private func drawTintedBannerPart(_ cgImage: CGImage, in rect: CGRect, color: UIColor, in context: CGContext) {
        context.saveGState()
        context.translateBy(x: rect.minX, y: rect.maxY)
        context.scaleBy(x: 1.0, y: -1.0)
        let localRect = CGRect(x: 0, y: 0, width: rect.width, height: rect.height)
        context.clip(to: localRect, mask: cgImage)
        context.setFillColor(color.cgColor)
        context.fill(localRect)
        context.restoreGState()
    }

    private func drawFallbackSurahHeader(
        number: Int,
        in frame: CGRect,
        fontSize: CGFloat,
        context: CGContext,
        strokeColor: UIColor,
        goldColor: UIColor,
        fillColor: UIColor
    ) {
        let outerLineWidth = max(1.4, bounds.width * 0.003)
        let innerLineWidth = max(0.8, outerLineWidth * 0.6)

        context.saveGState()
        context.setStrokeColor(strokeColor.cgColor)
        context.setLineWidth(outerLineWidth)
        context.setLineJoin(.round)

        let cornerRadius = frame.height * 0.12
        let outerPath = UIBezierPath(roundedRect: frame, cornerRadius: cornerRadius)
        outerPath.stroke()

        let innerFrame = frame.insetBy(dx: outerLineWidth * 2.2, dy: outerLineWidth * 2.0)
        let innerPath = UIBezierPath(roundedRect: innerFrame, cornerRadius: cornerRadius * 0.7)
        context.setStrokeColor(goldColor.cgColor)
        context.setLineWidth(innerLineWidth)
        innerPath.stroke()

        let cartoucheWidth = frame.width * 0.52
        let cartoucheRect = CGRect(
            x: frame.midX - cartoucheWidth / 2,
            y: innerFrame.minY + 1.0,
            width: cartoucheWidth,
            height: innerFrame.height - 2.0
        )

        let cartouchePath = UIBezierPath()
        let archH = cartoucheRect.height * 0.22
        let cuspH = cartoucheRect.height * 0.14

        cartouchePath.move(to: CGPoint(x: cartoucheRect.minX + archH, y: cartoucheRect.minY))
        cartouchePath.addLine(to: CGPoint(x: cartoucheRect.midX - archH * 0.7, y: cartoucheRect.minY))
        cartouchePath.addQuadCurve(
            to: CGPoint(x: cartoucheRect.midX, y: cartoucheRect.minY - archH * 0.35),
            controlPoint: CGPoint(x: cartoucheRect.midX - archH * 0.2, y: cartoucheRect.minY - archH * 0.35)
        )
        cartouchePath.addQuadCurve(
            to: CGPoint(x: cartoucheRect.midX + archH * 0.7, y: cartoucheRect.minY),
            controlPoint: CGPoint(x: cartoucheRect.midX + archH * 0.2, y: cartoucheRect.minY - archH * 0.35)
        )
        cartouchePath.addLine(to: CGPoint(x: cartoucheRect.maxX - archH, y: cartoucheRect.minY))

        cartouchePath.addCurve(
            to: CGPoint(x: cartoucheRect.maxX, y: cartoucheRect.midY),
            controlPoint1: CGPoint(x: cartoucheRect.maxX - cuspH * 0.4, y: cartoucheRect.minY + cuspH * 0.6),
            controlPoint2: CGPoint(x: cartoucheRect.maxX, y: cartoucheRect.midY - cuspH * 0.6)
        )
        cartouchePath.addCurve(
            to: CGPoint(x: cartoucheRect.maxX - archH, y: cartoucheRect.maxY),
            controlPoint1: CGPoint(x: cartoucheRect.maxX, y: cartoucheRect.midY + cuspH * 0.6),
            controlPoint2: CGPoint(x: cartoucheRect.maxX - cuspH * 0.4, y: cartoucheRect.maxY - cuspH * 0.6)
        )

        cartouchePath.addLine(to: CGPoint(x: cartoucheRect.midX + archH * 0.7, y: cartoucheRect.maxY))
        cartouchePath.addQuadCurve(
            to: CGPoint(x: cartoucheRect.midX, y: cartoucheRect.maxY + archH * 0.35),
            controlPoint: CGPoint(x: cartoucheRect.midX + archH * 0.2, y: cartoucheRect.maxY + archH * 0.35)
        )
        cartouchePath.addQuadCurve(
            to: CGPoint(x: cartoucheRect.midX - archH * 0.7, y: cartoucheRect.maxY),
            controlPoint: CGPoint(x: cartoucheRect.midX - archH * 0.2, y: cartoucheRect.maxY + archH * 0.35)
        )
        cartouchePath.addLine(to: CGPoint(x: cartoucheRect.minX + archH, y: cartoucheRect.maxY))

        cartouchePath.addCurve(
            to: CGPoint(x: cartoucheRect.minX, y: cartoucheRect.midY),
            controlPoint1: CGPoint(x: cartoucheRect.minX + cuspH * 0.4, y: cartoucheRect.maxY - cuspH * 0.6),
            controlPoint2: CGPoint(x: cartoucheRect.minX, y: cartoucheRect.midY + cuspH * 0.6)
        )
        cartouchePath.addCurve(
            to: CGPoint(x: cartoucheRect.minX + archH, y: cartoucheRect.minY),
            controlPoint1: CGPoint(x: cartoucheRect.minX, y: cartoucheRect.midY - cuspH * 0.6),
            controlPoint2: CGPoint(x: cartoucheRect.minX + cuspH * 0.4, y: cartoucheRect.minY + cuspH * 0.6)
        )
        cartouchePath.close()

        context.setFillColor(fillColor.cgColor)
        cartouchePath.fill()
        context.setStrokeColor(strokeColor.cgColor)
        context.setLineWidth(innerLineWidth * 1.1)
        cartouchePath.stroke()
        context.restoreGState()

        let surahName = library.surahNames[number] ?? "\(number)"
        let ayahCount = library.surahAyahCounts[number] ?? 0
        let displaySurahName = Self.canonicalSurahTitles[number] ?? surahName
        let titleStr = "سُورَةُ \(displaySurahName)" as NSString
        var titleFontSize = fontSize * 0.72
        var titleAttributes: [NSAttributedString.Key: Any] = [
            .font: MushafLibrary.mushafFont(size: titleFontSize),
            .foregroundColor: appearance.ink(for: traitCollection)
        ]
        var titleSize = titleStr.size(withAttributes: titleAttributes)
        let targetWidth = cartoucheRect.width * 0.82
        if titleSize.width > cartoucheRect.width * 0.90 {
            titleFontSize = max(fontSize * 0.45, titleFontSize * ((cartoucheRect.width * 0.90) / titleSize.width))
            titleAttributes[.font] = MushafLibrary.mushafFont(size: titleFontSize)
            titleSize = titleStr.size(withAttributes: titleAttributes)
        } else if titleSize.width < targetWidth && titleSize.width > 0 {
            let idealSize = titleFontSize * (targetWidth / titleSize.width)
            titleFontSize = min(fontSize * 0.82, idealSize)
            titleAttributes[.font] = MushafLibrary.mushafFont(size: titleFontSize)
            titleSize = titleStr.size(withAttributes: titleAttributes)
        }

        titleStr.draw(
            at: CGPoint(x: cartoucheRect.midX - titleSize.width / 2, y: cartoucheRect.midY - titleSize.height / 2),
            withAttributes: titleAttributes
        )
    }

    private func toArabicDigits(_ number: Int) -> String {
        let digits = ["0": "٠", "1": "١", "2": "٢", "3": "٣", "4": "٤",
                      "5": "٥", "6": "٦", "7": "٧", "8": "٨", "9": "٩"]
        return String(number).compactMap { digits[String($0)] }.joined()
    }

    private func drawWord(_ box: WordBox, font: CTFont, in context: CGContext) {
        let mark = marks[box.word.id]
        if highlightedWordIDs.contains(box.word.id) {
            context.saveGState()
            context.setFillColor(UIColor.systemYellow.withAlphaComponent(0.28).cgColor)
            context.fill(box.frame.insetBy(dx: -2, dy: -1))
            context.restoreGState()
        }
        let line = QCFFontStore.line(box.word.glyph, font: font,
                                     color: mark.map { UIColor(qiraatHex: $0.textColor).cgColor }
                                         ?? appearance.ink(for: traitCollection).cgColor)
        let natural = CGFloat(CTLineGetTypographicBounds(line, nil, nil, nil))
        context.saveGState()
        // UIKit is y-down, CoreText y-up. A condensed line (PageLayout squeeze) scales the glyph to its box.
        context.translateBy(x: box.frame.minX, y: box.frame.maxY)
        context.scaleBy(x: natural > 0 ? box.frame.width / natural : 1, y: -1)
        context.textPosition = CGPoint(x: 0, y: box.frame.height * 0.28)
        CTLineDraw(line, context)
        context.restoreGState()
        if box.word.charType == .end && bookmarkedAyahs.contains(box.word.ayahKey) {
            drawAyahBookmarkIndicator(around: box.frame, context: context)
        }
        if let mark, let layout { drawQiraatMarks(mark, around: box.frame, fontSize: layout.fontSize, in: context) }
    }

    private func drawAyahBookmarkIndicator(around frame: CGRect, context: CGContext) {
        context.saveGState()
        let size = max(7, frame.height * 0.30)
        let rect = CGRect(x: frame.midX - size / 2, y: frame.minY - size * 0.85, width: size, height: size * 1.35)
        let ribbon = UIBezierPath()
        ribbon.move(to: CGPoint(x: rect.minX, y: rect.minY))
        ribbon.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        ribbon.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        ribbon.addLine(to: CGPoint(x: rect.midX, y: rect.maxY - size * 0.35))
        ribbon.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        ribbon.close()

        let gold = appearance.gold(for: traitCollection)
        let crimson = UIColor(red: 0.76, green: 0.22, blue: 0.18, alpha: 0.95)
        context.setFillColor(crimson.cgColor)
        context.addPath(ribbon.cgPath)
        context.fillPath()

        context.setStrokeColor(gold.cgColor)
        context.setLineWidth(0.8)
        context.addPath(ribbon.cgPath)
        context.strokePath()

        context.restoreGState()
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

    private func drawBasmala(in rect: CGRect, fontSize: CGFloat, in context: CGContext) {
        // Render using the canonical Madinah Mushaf Page 1 QCF font (glyphs ﱁ ﱂ ﱃ ﱄ)
        if let p1Font = try? library.fonts.font(page: 1, size: fontSize * 1.05) {
            let glyphs = ["ﱁ", "ﱂ", "ﱃ", "ﱄ"] // RTL: بِسْمِ (word 1), ٱللَّهِ (word 2), ٱلرَّحْمَـٰنِ (word 3), ٱلرَّحِيمِ (word 4)
            let color = appearance.ink(for: traitCollection).cgColor
            let lines = glyphs.map { QCFFontStore.line($0, font: p1Font, color: color) }
            let widths = lines.map { CGFloat(CTLineGetTypographicBounds($0, nil, nil, nil)) }
            let gap = fontSize * PageLayoutConstants.centredGapEm
            let totalWidth = widths.reduce(0, +) + CGFloat(glyphs.count - 1) * gap
            var currentX = rect.midX + totalWidth / 2
            let height = fontSize * 1.15
            let boxY = rect.midY - height / 2

            for (i, line) in lines.enumerated() {
                let w = widths[i]
                context.saveGState()
                context.translateBy(x: currentX - w, y: boxY + height)
                context.scaleBy(x: 1.0, y: -1.0)
                context.textPosition = CGPoint(x: 0, y: height * 0.28)
                CTLineDraw(line, context)
                context.restoreGState()
                currentX -= (w + gap)
            }
            return
        }

        // Resilient fallback with Mushaf typography
        let font = MushafLibrary.mushafFont(size: fontSize * 0.95)
        let textColor = appearance.ink(for: traitCollection)
        let attributes: [NSAttributedString.Key: Any] = [
            .font: font,
            .foregroundColor: textColor,
        ]
        let string = "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ" as NSString
        let measured = string.size(withAttributes: attributes)
        string.draw(at: CGPoint(x: rect.midX - measured.width / 2, y: rect.midY - measured.height / 2),
                    withAttributes: attributes)
    }

    private func drawCentred(_ text: String, in rect: CGRect, size: CGFloat, weight: UIFont.Weight) {
        let attributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: size, weight: weight),
            .foregroundColor: appearance.brown(for: traitCollection),
        ]
        let string = text as NSString
        let measured = string.size(withAttributes: attributes)
        string.draw(at: CGPoint(x: rect.midX - measured.width / 2, y: rect.midY - measured.height / 2),
                    withAttributes: attributes)
    }
}
