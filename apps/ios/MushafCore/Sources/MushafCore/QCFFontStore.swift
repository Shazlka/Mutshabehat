import CoreText
import Foundation

/// Loads the per-page QCF V2 fonts (p1.woff2 … p604.woff2) from a directory, without registering
/// them process-wide, and keeps the most recently used descriptors in memory.
/// Each page's glyph codes only render with that page's own font — never fall back to another page's.
/// `@unchecked Sendable`: CTFontDescriptor is an immutable, thread-safe CoreFoundation object and
/// every access to the mutable cache goes through `lock`.
public final class QCFFontStore: @unchecked Sendable {
    public enum Failure: Error, Equatable { case missing(Int), unreadable(Int) }

    private let directory: URL
    private let capacity: Int
    private let lock = NSLock()
    private var descriptors: [Int: CTFontDescriptor] = [:]
    /// Least recently used first.
    private var order: [Int] = []

    public init(directory: URL, capacity: Int = 12) {
        self.directory = directory
        self.capacity = capacity
    }

    public func fileURL(page: Int) -> URL { directory.appendingPathComponent("p\(page).woff2") }

    public func font(page: Int, size: CGFloat) throws -> CTFont {
        CTFontCreateWithFontDescriptor(try descriptor(page: page), size, nil)
    }

    /// One token as a CoreText line in this page's font. Always draw and measure through this:
    /// 198 tokens are two glyphs joined by a space (rub al-hizb ۞ + word, e.g. 2:26 «۞ إِنَّ») and
    /// the QCF fonts have no space glyph, so CoreText must be allowed to fall back for it.
    public func line(for glyph: String, page: Int, size: CGFloat) throws -> CTLine {
        Self.line(glyph, font: try font(page: page, size: size))
    }

    /// Same as above with a font already in hand (draw one page with one font lookup).
    public static func line(_ glyph: String, font: CTFont) -> CTLine {
        let attributed = NSAttributedString(string: glyph, attributes: [
            NSAttributedString.Key(kCTFontAttributeName as String): font,
        ])
        return CTLineCreateWithAttributedString(attributed)
    }

    /// Same, filled with `color` (the Qiraat layer colours words; CTLineDraw honours the attribute).
    public static func line(_ glyph: String, font: CTFont, color: CGColor) -> CTLine {
        let attributed = NSAttributedString(string: glyph, attributes: [
            NSAttributedString.Key(kCTFontAttributeName as String): font,
            NSAttributedString.Key(kCTForegroundColorAttributeName as String): color,
        ])
        return CTLineCreateWithAttributedString(attributed)
    }

    /// Advance width of one token at `size`.
    public func advance(of glyph: String, page: Int, size: CGFloat) throws -> CGFloat {
        CGFloat(CTLineGetTypographicBounds(try line(for: glyph, page: page, size: size), nil, nil, nil))
    }

    /// True when every non-space code point of the token has a glyph in this page's font.
    public func covers(_ glyph: String, page: Int) throws -> Bool {
        let font = try font(page: page, size: 12)
        let utf16 = Array(glyph.unicodeScalars.filter { $0 != " " }.map(String.init).joined().utf16)
        var glyphs = [CGGlyph](repeating: 0, count: utf16.count)
        return CTFontGetGlyphsForCharacters(font, utf16, &glyphs, utf16.count)
    }

    /// Decodes the fonts of `pages` ahead of need (a cold woff2 decode costs ~2 ms). Thread-safe;
    /// call it off the main thread. Out-of-range and missing pages are ignored.
    public func prewarm(pages: some Sequence<Int>) {
        for page in pages where (1...mushafPageCount).contains(page) { _ = try? descriptor(page: page) }
    }

    /// Pages around `page` worth having decoded: one spread back, two spreads forward.
    public static func neighbourhood(of page: Int) -> ClosedRange<Int> {
        max(1, page - 2)...min(mushafPageCount, page + 4)
    }

    private func descriptor(page: Int) throws -> CTFontDescriptor {
        if let hit = lock.withLock({ () -> CTFontDescriptor? in
            guard let d = descriptors[page] else { return nil }
            touch(page)
            return d
        }) { return hit }

        guard let data = try? Data(contentsOf: fileURL(page: page)) else { throw Failure.missing(page) }
        guard let made = CTFontManagerCreateFontDescriptorFromData(data as CFData) else { throw Failure.unreadable(page) }
        lock.withLock {
            descriptors[page] = made
            touch(page)
            while order.count > capacity { descriptors[order.removeFirst()] = nil }
        }
        return made
    }

    /// Call with `lock` held.
    private func touch(_ page: Int) {
        order.removeAll { $0 == page }
        order.append(page)
    }

    public var cachedPages: [Int] { lock.withLock { order } }
}
