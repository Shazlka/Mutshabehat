import MushafCore
import UIKit
import XCTest
@testable import Mutshabehat

/// A long press finds its ayah even when it lands in the gap between two words of a line.
@MainActor
final class MushafPageHitTestTests: XCTestCase {
    /// A startup sync announces the whole store, rather than an individual live page. Keep the
    /// snapshot bytes unchanged: the fixture starts with an unavailable page, then receives it.
    func testASnapshotUpdateMakesTheVisiblePageTappableWithoutTurningIt() throws {
        let fixture = try makeQiraatFixture(page: 1)
        defer { try? FileManager.default.removeItem(at: fixture.directory) }
        let library = try MushafLibrary(qiraatStore: fixture.store)
        let page = try XCTUnwrap(library.page(1))
        let view = MushafPageView(page: page, library: library, appearance: .light)
        view.qiraat = QiraatDisplay(enabled: true, filter: .all)
        let window = show(view)
        defer { window.isHidden = true }
        let box = try XCTUnwrap(view.layout?.lines.flatMap(\.boxes).first {
            $0.word.ayahKey == AyahKey(surah: 1, ayah: 4) && $0.word.indexInAyah == 1
        })
        let point = CGPoint(x: box.frame.midX, y: box.frame.midY)
        XCTAssertNil(view.markedWord(at: point))

        try fixture.store.applyLivePage(fixture.pageData, number: 1)
        NotificationCenter.default.post(name: .qiraatDatabaseDidUpdate, object: nil)

        XCTAssertEqual(view.markedWord(at: point)?.id, box.word.id,
                       "A completed startup sync must update the visible hit map immediately")
        XCTAssertEqual(view.layout?.pageSize, CGSize(width: 402, height: 692))
    }

    func testASnapshotChangedWhileDetachedIsTappableWhenThePageReturns() throws {
        let fixture = try makeQiraatFixture(page: 1)
        defer { try? FileManager.default.removeItem(at: fixture.directory) }
        let library = try MushafLibrary(qiraatStore: fixture.store)
        let view = MushafPageView(page: try XCTUnwrap(library.page(1)), library: library, appearance: .light)
        view.qiraat = QiraatDisplay(enabled: true, filter: .all)
        let window = show(view)
        defer { window.isHidden = true }
        let parent = try XCTUnwrap(window.rootViewController?.view)
        view.removeFromSuperview()
        try fixture.store.applyLivePage(fixture.pageData, number: 1)
        NotificationCenter.default.post(name: .qiraatDatabaseDidUpdate, object: nil)
        parent.addSubview(view)

        let box = try XCTUnwrap(view.layout?.lines.flatMap(\.boxes).first {
            $0.word.ayahKey == AyahKey(surah: 1, ayah: 4) && $0.word.indexInAyah == 1
        })
        XCTAssertEqual(view.markedWord(at: CGPoint(x: box.frame.midX, y: box.frame.midY))?.id, box.word.id,
                       "Reattaching at the same size must refresh a store change missed while detached")
    }

    func testMarkedWordsAreTappableOnTheFirstLayoutAndAfterFilterChanges() throws {
        let library = try MushafLibrary()
        for number in [1, 2, 25, 249, 305, 600] {
            let view = MushafPageView(page: try XCTUnwrap(library.page(number)), library: library, appearance: .light)
            view.qiraat = QiraatDisplay(enabled: true, filter: .all)
            view.frame = CGRect(x: 0, y: 0, width: 402, height: 692)
            view.layoutIfNeeded()
            for filter in [QiraatFilter.all, .reader("Q01"), .reading("Q01-R02"), .all] {
                view.qiraat = QiraatDisplay(enabled: true, filter: filter)
                let source = try XCTUnwrap(library.qiraat?.marks(page: number))
                let boxes = try XCTUnwrap(view.layout).lines.flatMap(\.boxes)
                    .filter { source.wordMarks(for: $0.word, filter: filter) != nil }
                XCTAssertEqual(view.marks.count, boxes.count)
                if filter == .all { XCTAssertFalse(boxes.isEmpty) }
                for box in boxes {
                    XCTAssertEqual(view.markedWord(at: CGPoint(x: box.frame.midX, y: box.frame.midY))?.id,
                                   box.word.id, "First-layout tap on \(box.word.ayahKey):\(box.word.indexInAyah), p\(number)")
                }
            }
            view.qiraat = .off
            XCTAssertTrue(view.marks.isEmpty)
        }
    }

    private func show(_ pageView: MushafPageView) -> UIWindow {
        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 402, height: 692))
        let controller = UIViewController()
        window.rootViewController = controller
        pageView.frame = window.bounds
        controller.view.addSubview(pageView)
        window.isHidden = false
        controller.view.layoutIfNeeded()
        pageView.layoutIfNeeded()
        return window
    }

    private func makeQiraatFixture(page: Int) throws -> (directory: URL, store: QiraatStore, pageData: Data) {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let snapshot = directory.appendingPathComponent("snapshot")
        let overlay = directory.appendingPathComponent("overlay")
        try FileManager.default.createDirectory(at: snapshot, withIntermediateDirectories: true)
        let bundled = try XCTUnwrap(Bundle.main.url(forResource: "Qiraat", withExtension: nil))
        try FileManager.default.copyItem(at: bundled.appendingPathComponent("catalog.json"),
                                        to: snapshot.appendingPathComponent("catalog.json"))
        let store = try QiraatStore(directory: snapshot, overlayDirectory: overlay)
        return (directory, store, try Data(contentsOf: bundled.appendingPathComponent(String(format: "page-%03d.json", page))))
    }

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
