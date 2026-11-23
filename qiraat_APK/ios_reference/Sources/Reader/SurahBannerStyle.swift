import CoreText
import UIKit

/// The look of the surah banner at the head of each surah, chosen in Settings → «شكل ترويسة السورة». `classic` is
/// the line-art banner tinted to the page's theme; the other five are the illuminated banners of
/// `docs/design/surah-banners-reference.jpg`, drawn from the pieces `scripts/make_surah_banners.swift` cuts from it.
enum SurahBannerStyle: String, CaseIterable, Identifiable {
    case royal
    case emerald
    case minimal
    case night
    case marble
    case classic

    static let storageKey = "mushaf:surahBanner:v1"

    /// The royal blue manuscript banner unless another was chosen.
    init(stored: String) { self = SurahBannerStyle(rawValue: stored) ?? .royal }

    static var current: SurahBannerStyle {
        SurahBannerStyle(stored: UserDefaults.standard.string(forKey: storageKey) ?? "")
    }

    var id: Self { self }

    func title(_ language: AppLanguage) -> String {
        switch (self, language) {
        case (.royal, .english): "Royal blue and gold"
        case (.royal, _): "الأزرق الملكي والذهبي"
        case (.emerald, .english): "Emerald and gold"
        case (.emerald, _): "الزمردي والذهبي"
        case (.minimal, .english): "Ivory and navy"
        case (.minimal, _): "العاجي والكحلي"
        case (.night, .english): "Night"
        case (.night, _): "الليلي المضيء"
        case (.marble, .english): "Marble and rose gold"
        case (.marble, _): "الرخام والذهب الوردي"
        case (.classic, .english): "Classic (follows the theme)"
        case (.classic, _): "الكلاسيكي (بلون المظهر)"
        }
    }

    /// The illuminated banner's pieces and colours; nil for the classic banner.
    var art: SurahBannerArt? {
        switch self {
        case .classic: nil
        case .emerald: .emerald
        case .minimal: .minimal
        case .night: .night
        case .marble: .marble
        case .royal: .royal
        }
    }
}

/// One illuminated banner: its two wings and centre strip (asset `SurahBanner<n>Left/Right/Middle`), where the
/// medallions and the title sit, measured in the reference's pixels, and how the title and the numbers are painted.
struct SurahBannerArt {
    let asset: Int
    /// The pieces' height in the reference; every length below is in the same pixels.
    let sourceHeight: CGFloat
    /// From the banner's outer edge to the centre of its medallion.
    let medallionX: CGFloat
    /// The medallion's clear inside, which the number must fit.
    let medallionRadius: CGFloat
    /// From the banner's outer edge to where the title may begin.
    let titleInset: CGFloat
    let title: Paint
    /// «سورة» in a colour of its own, as on the marble banner; nil paints it as the name.
    var titlePrefix: UIColor? = nil
    let digits: Paint

    enum Paint {
        /// A vertical gradient, top to bottom, over a soft shadow.
        case gradient([UIColor], shadow: UIColor)
        /// One colour with a shadow or a glow.
        case solid(UIColor, shadow: UIColor, blur: CGFloat)
    }

    static let emerald = SurahBannerArt(
        asset: 1, sourceHeight: 255, medallionX: 260, medallionRadius: 60, titleInset: 600,
        title: .gradient([UIColor(hex: 0xF7EBC0), UIColor(hex: 0xE2C266), UIColor(hex: 0xB8902F)],
                         shadow: UIColor.black.withAlphaComponent(0.55)),
        digits: .gradient([UIColor(hex: 0xF3E5AB), UIColor(hex: 0xD4AF37)], shadow: UIColor.black.withAlphaComponent(0.4)))

    static let minimal = SurahBannerArt(
        asset: 2, sourceHeight: 256, medallionX: 258, medallionRadius: 60, titleInset: 400,
        title: .solid(UIColor(hex: 0x0F172A), shadow: UIColor(hex: 0x0F172A, alpha: 0.12), blur: 2),
        digits: .solid(UIColor(hex: 0xF4F5FA), shadow: UIColor.black.withAlphaComponent(0.25), blur: 1.5))

    static let night = SurahBannerArt(
        asset: 3, sourceHeight: 255, medallionX: 316, medallionRadius: 58, titleInset: 510,
        title: .gradient([UIColor.white, UIColor(hex: 0xF4EAD2)], shadow: UIColor(hex: 0xC5A880, alpha: 0.75)),
        digits: .solid(UIColor(hex: 0x3EF2DA), shadow: UIColor(hex: 0x00F5D4, alpha: 0.85), blur: 6))

    static let marble = SurahBannerArt(
        asset: 4, sourceHeight: 256, medallionX: 320, medallionRadius: 62, titleInset: 436,
        title: .solid(UIColor(hex: 0x333333), shadow: UIColor.black.withAlphaComponent(0.12), blur: 2),
        titlePrefix: UIColor(hex: 0xB57B6B),
        digits: .solid(UIColor(hex: 0x2B2B2B), shadow: UIColor.white.withAlphaComponent(0.6), blur: 1))

    static let royal = SurahBannerArt(
        asset: 5, sourceHeight: 257, medallionX: 318, medallionRadius: 57, titleInset: 531,
        title: .gradient([UIColor(hex: 0xF8E7A8), UIColor(hex: 0xD4AF37), UIColor(hex: 0x9C7A22)],
                         shadow: UIColor.black.withAlphaComponent(0.6)),
        digits: .gradient([UIColor(hex: 0xF3E1A0), UIColor(hex: 0xC9A034)], shadow: UIColor.black.withAlphaComponent(0.5)))

    @MainActor private static var pieces: [Int: (left: CGImage, middle: CGImage, right: CGImage)] = [:]

    /// The banner's three pieces, loaded once.
    @MainActor var images: (left: CGImage, middle: CGImage, right: CGImage)? {
        if let cached = Self.pieces[asset] { return cached }
        guard let left = UIImage(named: "SurahBanner\(asset)Left")?.cgImage,
              let middle = UIImage(named: "SurahBanner\(asset)Middle")?.cgImage,
              let right = UIImage(named: "SurahBanner\(asset)Right")?.cgImage else { return nil }
        Self.pieces[asset] = (left, middle, right)
        return (left, middle, right)
    }

    /// Draws the banner into `frame` of a UIKit (top-left origin) context: the wings at the frame's height, the
    /// centre strip stretched between them, the surah number in the right medallion, the ayah count in the left one,
    /// and «سورة <name>» centred. `writes`: false draws the pieces alone. False when the pieces are missing.
    @discardableResult @MainActor
    func draw(in frame: CGRect, title: String, prefixLength: Int, surahNumber: Int, ayahCount: Int,
              titleFont: (CGFloat) -> UIFont, context: CGContext, writes: Bool = true) -> Bool {
        guard let images, frame.width > 0, frame.height > 0 else { return false }
        let scale = frame.height / sourceHeight
        // The wings never take more than 42% of the width each; on a narrow frame they keep their shape, smaller.
        let wingScale = min(scale, frame.width * 0.42 / CGFloat(max(images.left.width, images.right.width)))
        let leftWidth = CGFloat(images.left.width) * wingScale
        let rightWidth = CGFloat(images.right.width) * wingScale
        let wingHeight = sourceHeight * wingScale
        let wingY = frame.midY - wingHeight / 2

        context.saveGState()
        context.addPath(UIBezierPath(roundedRect: frame, cornerRadius: frame.height * 0.04).cgPath)
        context.clip()
        context.interpolationQuality = .high
        drawImage(images.middle, in: CGRect(x: frame.minX + leftWidth - 1, y: frame.minY,
                                            width: frame.width - leftWidth - rightWidth + 2, height: frame.height),
                  context: context)
        drawImage(images.left, in: CGRect(x: frame.minX, y: wingY, width: leftWidth, height: wingHeight), context: context)
        drawImage(images.right, in: CGRect(x: frame.maxX - rightWidth, y: wingY, width: rightWidth, height: wingHeight),
                  context: context)
        context.restoreGState()
        guard writes else { return true }

        let radius = medallionRadius * wingScale
        drawNumber(surahNumber, centre: CGPoint(x: frame.maxX - medallionX * wingScale, y: frame.midY),
                   radius: radius, context: context)
        drawNumber(ayahCount, centre: CGPoint(x: frame.minX + medallionX * wingScale, y: frame.midY),
                   radius: radius, context: context)

        let available = max(frame.width * 0.3, frame.width - 2 * titleInset * wingScale)
        drawTitle(title, prefixLength: prefixLength, centre: CGPoint(x: frame.midX, y: frame.midY),
                  height: frame.height, maxWidth: available, font: titleFont, context: context)
        return true
    }

    private func drawImage(_ image: CGImage, in rect: CGRect, context: CGContext) {
        context.saveGState()
        context.translateBy(x: rect.minX, y: rect.maxY)
        context.scaleBy(x: 1, y: -1)
        context.draw(image, in: CGRect(origin: .zero, size: rect.size))
        context.restoreGState()
    }

    /// A number as large as the medallion's inside takes, its digits centred.
    private func drawNumber(_ value: Int, centre: CGPoint, radius: CGFloat, context: CGContext) {
        func line(_ size: CGFloat) -> CTLine {
            let font = UIFont(name: "GeezaPro-Bold", size: size) ?? .systemFont(ofSize: size, weight: .bold)
            return CTLineCreateWithAttributedString(NSAttributedString(string: ArabicDigits.string(value),
                                                                       attributes: [.font: font]))
        }
        var size = radius * 1.3
        var digits = line(size)
        let width = CTLineGetTypographicBounds(digits, nil, nil, nil)
        if width > radius * 1.55 {
            size *= radius * 1.55 / width
            digits = line(size)
        }
        paint(digits, centredOn: centre, with: self.digits, scale: radius / 60, context: context)
    }

    /// «سورة <name>» centred, as large as 62% of the banner's height allows within `maxWidth` (never below 32%).
    private func drawTitle(_ title: String, prefixLength: Int, centre: CGPoint, height: CGFloat, maxWidth: CGFloat,
                           font: (CGFloat) -> UIFont, context: CGContext) {
        func line(_ size: CGFloat) -> CTLine {
            let string = NSMutableAttributedString(string: title, attributes: [.font: font(size)])
            // The two-tone title carries its colours; any other takes the paint's.
            if let titlePrefix, case let .solid(colour, _, _) = self.title {
                string.addAttribute(.foregroundColor, value: colour, range: NSRange(location: 0, length: string.length))
                string.addAttribute(.foregroundColor, value: titlePrefix,
                                    range: NSRange(location: 0, length: min(prefixLength, string.length)))
            }
            return CTLineCreateWithAttributedString(string)
        }
        var size = height * 0.62
        var text = line(size)
        let width = CTLineGetTypographicBounds(text, nil, nil, nil)
        if width > maxWidth {
            size = max(height * 0.32, size * maxWidth / width)
            text = line(size)
        }
        paint(text, centredOn: centre, with: self.title, scale: height / sourceHeight, context: context)
    }

    /// Fills a line's glyph outlines, their ink box centred on `centre`, in the paint's colours (runs that carry a
    /// colour of their own keep it), over its shadow or glow. Outlines rather than CTLineDraw, so the gradient, the
    /// shadow and the colour runs land on exactly the same shapes in this top-left context.
    private func paint(_ line: CTLine, centredOn centre: CGPoint, with paint: Paint, scale: CGFloat, context: CGContext) {
        let runs = Self.outlines(of: line)
        let all = CGMutablePath()
        for run in runs { all.addPath(run.path) }
        let box = all.boundingBoxOfPath
        guard !box.isEmpty else { return }
        let shift = CGAffineTransform(translationX: centre.x - box.midX, y: centre.y - box.midY)
        let unit = max(scale * 2, 0.5)

        context.saveGState()
        context.concatenate(shift)
        switch paint {
        case let .solid(colour, shadow, blur):
            context.setShadow(offset: CGSize(width: 0, height: blur > 3 ? 0 : 1.2 * unit), blur: blur * unit,
                              color: shadow.cgColor)
            for run in runs {
                context.addPath(run.path)
                context.setFillColor(run.colour ?? colour.cgColor)
                context.fillPath()
            }
        case let .gradient(colours, shadow):
            // The shadow first, under the glyphs; then the glyphs as a clip filled with the gradient.
            context.saveGState()
            context.setShadow(offset: CGSize(width: 0, height: 1.5 * unit), blur: 3 * unit, color: shadow.cgColor)
            context.addPath(all)
            context.setFillColor((colours.last ?? .black).cgColor)
            context.fillPath()
            context.restoreGState()
            context.addPath(all)
            context.clip()
            if let gradient = CGGradient(colorsSpace: CGColorSpace(name: CGColorSpace.sRGB),
                                         colors: colours.map(\.cgColor) as CFArray, locations: nil) {
                context.drawLinearGradient(gradient, start: CGPoint(x: 0, y: box.minY), end: CGPoint(x: 0, y: box.maxY),
                                           options: [])
            }
        }
        context.restoreGState()
    }

    /// Each run's glyph outlines, the baseline at y = 0 and y growing down, with the run's own colour if it has one.
    private static func outlines(of line: CTLine) -> [(path: CGPath, colour: CGColor?)] {
        (CTLineGetGlyphRuns(line) as? [CTRun] ?? []).compactMap { run in
            let attributes = CTRunGetAttributes(run) as NSDictionary
            guard let value = attributes[kCTFontAttributeName] else { return nil }
            let font = value as! CTFont
            let colour = (attributes[NSAttributedString.Key.foregroundColor] as? UIColor)?.cgColor
            let count = CTRunGetGlyphCount(run)
            var glyphs = [CGGlyph](repeating: 0, count: count)
            var positions = [CGPoint](repeating: .zero, count: count)
            CTRunGetGlyphs(run, CFRange(location: 0, length: count), &glyphs)
            CTRunGetPositions(run, CFRange(location: 0, length: count), &positions)
            let path = CGMutablePath()
            for (glyph, position) in zip(glyphs, positions) {
                var transform = CGAffineTransform(translationX: position.x, y: -position.y).scaledBy(x: 1, y: -1)
                if let glyphPath = CTFontCreatePathForGlyph(font, glyph, &transform) { path.addPath(glyphPath) }
            }
            return (path, colour)
        }
    }
}

private extension UIColor {
    convenience init(hex: UInt32, alpha: CGFloat = 1) {
        self.init(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
                  blue: CGFloat(hex & 0xFF) / 255, alpha: alpha)
    }
}
