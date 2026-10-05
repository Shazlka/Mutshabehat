import CoreGraphics

/// Pure page geometry, ported from the web reader (Mushaf1441Viewer.tsx `renderMushafPage`) so
/// both apps set a page the same way. No UIKit, no fonts: word widths come in through `advance`,
/// which makes every rule here unit-testable with fake widths.
public struct PageLayoutConstants: Sendable {
    /// Page aspect of the printed Madinah 1441 page (1994 × 2850).
    public static let pageAspect: CGFloat = 1994.0 / 2850.0
    /// Glyph size as a fraction of page width to fill the page line comfortably.
    public static let fontSizeRatio: CGFloat = 0.057
    /// Print margins: tuned to fill the screen while maintaining 1441 Madinah rasm proportions.
    public static let paddingXRatio: CGFloat = 0.038
    public static let paddingYRatioOfWidth: CGFloat = 0.032
    /// Pages 1–2: a centred block inset 22% (top/bottom, of height) and 13% (sides, of width).
    public static let openingInsetYRatio: CGFloat = 0.22
    public static let openingInsetXRatio: CGFloat = 0.13
    /// Gaps between words, in em.
    public static let centredGapEm: CGFloat = 0.12
    public static let minimumGapEm: CGFloat = 0.04
    /// A surah-ending line with fewer words than 70% of the page's 75th-percentile line is centred.
    public static let shortLineRatio: CGFloat = 0.7
    /// A single page may grow up to 18% taller than the print aspect to fill a tall phone (web rule).
    public static let maxHeightStretch: CGFloat = 1.18

    /// Which edge of its area a spread page's spine is on. A lone page has none.
    public enum SpineSide: Sendable { case none, left, right }

    /// The page rectangle inside `area` (the safe area): as wide as possible at the print aspect,
    /// then — single pages only — up to 18% taller if there is room. Centred vertically; centred
    /// horizontally too, except that a spread page is set against its spine so the two pages of a
    /// spread meet in the middle like a book (the web places them side by side the same way).
    public static func fittedPageRect(in area: CGRect, stretch: Bool, spine: SpineSide = .none) -> CGRect {
        var width = area.width
        var height = width / pageAspect
        if height > area.height {
            height = area.height
            width = height * pageAspect
        } else if stretch {
            height = min(area.height, height * maxHeightStretch)
        }
        let x: CGFloat
        switch spine {
        case .none: x = area.midX - width / 2
        case .left: x = area.minX
        case .right: x = area.maxX - width
        }
        return CGRect(x: x, y: area.midY - height / 2, width: width, height: height)
    }
}

public struct WordBox: Hashable, Sendable {
    public let word: MushafWord
    /// Glyph box in page coordinates (origin top-left, y down).
    public let frame: CGRect
}

public enum LaidOutLineContent: Hashable, Sendable {
    case words([WordBox], gaps: [CGRect])
    case surahHeader(Int)
    case basmala
    case empty
}

extension LaidOutLine {
    /// The word boxes of a text line; empty for headers, basmalas and empty slots.
    public var boxes: [WordBox] {
        if case let .words(boxes, _) = content { return boxes }
        return []
    }
}

public struct LaidOutLine: Hashable, Sendable {
    public let number: Int
    public let rect: CGRect
    public let isCentred: Bool
    public let content: LaidOutLineContent
}

public struct PageLayout: Sendable {
    public let pageSize: CGSize
    public let fontSize: CGFloat
    public let lines: [LaidOutLine]

    /// - Parameters:
    ///   - advance: width of a word's glyph at `fontSize` (CoreText in the app, fakes in tests).
    ///   - surahAyahCounts: surah number → ayah count, to recognise a surah's last line.
    public init(page: MushafPage, pageSize: CGSize, surahAyahCounts: [Int: Int],
                advance: (MushafWord, CGFloat) -> CGFloat) {
        typealias K = PageLayoutConstants
        self.pageSize = pageSize
        let isOpening = page.number <= 2

        let visible = isOpening
            ? page.lines.filter { !$0.words.isEmpty || $0.decoration != nil }
            : page.lines
        let body: CGRect = isOpening
            ? CGRect(x: pageSize.width * K.openingInsetXRatio, y: pageSize.height * K.openingInsetYRatio,
                     width: pageSize.width * (1 - 2 * K.openingInsetXRatio),
                     height: pageSize.height * (1 - 2 * K.openingInsetYRatio))
            : CGRect(x: pageSize.width * K.paddingXRatio, y: pageSize.width * K.paddingYRatioOfWidth,
                     width: pageSize.width * (1 - 2 * K.paddingXRatio),
                     height: pageSize.height - 2 * pageSize.width * K.paddingYRatioOfWidth)

        let counts = page.lines.map(\.words.count).filter { $0 > 0 }.sorted()
        let typical = counts.isEmpty ? 0 : counts[Int(Double(counts.count) * 0.75)]
        let rowHeight = visible.isEmpty ? 0 : body.height / CGFloat(visible.count)

        // Fit font size to body width so lines fill the page comfortably without large empty gaps,
        // bounded by row height so glyphs never overlap vertically.
        let targetFontSize = min(body.width / 16.2, rowHeight * 0.74)
        let fontSize = max(pageSize.width * K.fontSizeRatio, targetFontSize)
        self.fontSize = fontSize

        lines = visible.enumerated().map { row, line in
            let rect = CGRect(x: body.minX, y: body.minY + CGFloat(row) * rowHeight, width: body.width, height: rowHeight)
            if let header = line.decoration?.surahHeader {
                return LaidOutLine(number: line.number, rect: rect, isCentred: true, content: .surahHeader(header))
            }
            if line.decoration?.basmala == true {
                return LaidOutLine(number: line.number, rect: rect, isCentred: true, content: .basmala)
            }
            guard let last = line.words.last else {
                return LaidOutLine(number: line.number, rect: rect, isCentred: false, content: .empty)
            }
            let endsSurah = last.charType == .end && surahAyahCounts[last.ayahKey.surah] == last.ayahKey.ayah
            let centred = isOpening
                || (endsSurah && CGFloat(line.words.count) < CGFloat(typical) * K.shortLineRatio)
            let (boxes, gaps) = Self.placeWords(line.words, in: rect, fontSize: fontSize, centred: centred, advance: advance)
            return LaidOutLine(number: line.number, rect: rect, isCentred: centred, content: .words(boxes, gaps: gaps))
        }
    }

    /// Right-to-left placement. QCF glyphs are Private Use Area code points with no bidi class,
    /// so CoreText would draw a whole line left-to-right; we position every word ourselves.
    static func placeWords(_ words: [MushafWord], in rect: CGRect, fontSize: CGFloat, centred: Bool,
                           advance: (MushafWord, CGFloat) -> CGFloat) -> ([WordBox], [CGRect]) {
        typealias K = PageLayoutConstants
        var widths = words.map { advance($0, fontSize) }
        let gapCount = CGFloat(max(words.count - 1, 0))
        var natural = widths.reduce(0, +)
        let minGap = fontSize * K.minimumGapEm
        // A line that cannot fit even with minimum gaps is condensed uniformly (never clipped).
        let squeeze = min(1, (rect.width - gapCount * minGap) / max(natural, 1))
        if squeeze < 1 { widths = widths.map { $0 * squeeze }; natural *= squeeze }

        let gap: CGFloat
        var x: CGFloat
        if centred || words.count == 1 {
            gap = fontSize * K.centredGapEm
            let total = natural + gapCount * gap
            x = rect.midX + total / 2
        } else {
            gap = max(minGap, (rect.width - natural) / gapCount)
            x = rect.maxX
        }
        let height = fontSize * 1.15
        let y = rect.midY - height / 2
        var boxes: [WordBox] = []
        var gaps: [CGRect] = []
        for (i, word) in words.enumerated() {
            let frame = CGRect(x: x - widths[i], y: y, width: widths[i], height: height)
            boxes.append(WordBox(word: word, frame: frame))
            x = frame.minX
            if i < words.count - 1 {
                gaps.append(CGRect(x: x - gap, y: y, width: gap, height: height))
                x -= gap
            }
        }
        return (boxes, gaps)
    }

    /// Hit test in page coordinates: the word under the point, or the nearest word on that line
    /// (so a tap in the space between two words still lands on one of them).
    public func word(at point: CGPoint) -> MushafWord? {
        guard let line = lines.first(where: { $0.rect.minY <= point.y && point.y < $0.rect.maxY }),
              case let .words(boxes, _) = line.content else { return nil }
        if let hit = boxes.first(where: { $0.frame.minX <= point.x && point.x <= $0.frame.maxX }) { return hit.word }
        return boxes.min(by: { abs($0.frame.midX - point.x) < abs($1.frame.midX - point.x) })?.word
    }
}
