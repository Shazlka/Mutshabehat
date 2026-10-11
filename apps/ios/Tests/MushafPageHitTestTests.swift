import MushafCore
import UIKit
import XCTest
@testable import Mutshabehat

/// A long press finds its ayah even when it lands in the gap between two words of a line.
@MainActor
final class MushafPageHitTestTests: XCTestCase {
    func testAPressBetweenTwoWordsOfALineFindsTheNearestWordsAyah() throws {
        let library = try MushafLibrary()
        let page = try XCTUnwrap(library.page(600))
        let view = MushafPageView(page: page, library: library, appearance: .light)
        view.frame = CGRect(x: 0, y: 0, width: 402, height: 692)
        view.layoutIfNeeded()
        let layout = try XCTUnwrap(view.layout)

        var checked = 0
        for line in layout.lines where line.boxes.count > 1 {
            let boxes = line.boxes.sorted { $0.frame.minX < $1.frame.minX }
            // The widest gap between two neighbouring words of this line.
            let pair = zip(boxes, boxes.dropFirst()).max { ($0.1.frame.minX - $0.0.frame.maxX) < ($1.1.frame.minX - $1.0.frame.maxX) }!
            let point = CGPoint(x: (pair.0.frame.maxX + pair.1.frame.minX) / 2, y: line.rect.maxY - 2)
            let found = view.ayahKey(at: point)
            XCTAssertNotNil(found, "line \(line.rect) gap at \(point)")
            if let found { XCTAssertTrue([pair.0.word.ayahKey, pair.1.word.ayahKey].contains(found)) }
            checked += 1
        }
        XCTAssertGreaterThan(checked, 8)
    }

    /// Lines are taller than their glyphs (the page spreads the 15 lines over the screen): a press low in a
    /// line, under a word, answers like a press on the word.
    func testAPressAnywhereInALineUnderAWordAnswersLikeAPressOnTheWord() throws {
        let library = try MushafLibrary()
        let page = try XCTUnwrap(library.page(600))
        let view = MushafPageView(page: page, library: library, appearance: .light)
        view.frame = CGRect(x: 0, y: 0, width: 402, height: 692)
        view.layoutIfNeeded()
        let layout = try XCTUnwrap(view.layout)
        var checked = 0
        for line in layout.lines where !line.boxes.isEmpty {
            for box in line.boxes {
                // Whatever pressing the glyph itself gives (an ayah-end marker nearby takes priority there too).
                let onGlyph = view.ayahKey(at: CGPoint(x: box.frame.midX, y: box.frame.midY))
                XCTAssertNotNil(onGlyph)
                for y in [line.rect.minY + 2, line.rect.midY, line.rect.maxY - 2] {
                    XCTAssertEqual(view.ayahKey(at: CGPoint(x: box.frame.midX, y: y)), onGlyph,
                                   "\(box.word.ayahKey) at y \(y) in line \(line.rect)")
                    checked += 1
                }
            }
        }
        XCTAssertGreaterThan(checked, 300)
    }

    func testAPressOnASurahHeaderFindsNoAyah() throws {
        let library = try MushafLibrary()
        let page = try XCTUnwrap(library.page(600))
        let view = MushafPageView(page: page, library: library, appearance: .light)
        view.frame = CGRect(x: 0, y: 0, width: 402, height: 692)
        view.layoutIfNeeded()
        let header = try XCTUnwrap(view.layout?.lines.first { if case .surahHeader = $0.content { return true }; return false })
        XCTAssertNil(view.ayahKey(at: CGPoint(x: header.rect.midX, y: header.rect.midY)))
    }
}
