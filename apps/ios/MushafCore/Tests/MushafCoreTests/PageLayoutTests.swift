import CoreGraphics
import Testing
@testable import MushafCore

@Suite struct PageLayoutTests {
    let size = CGSize(width: 400, height: 400 / PageLayoutConstants.pageAspect)
    var body: CGRect { CGRect(x: 400 * 0.072, y: 0, width: 400 * (1 - 0.144), height: 1) }

    @Test func justifiedLineRunsRightToLeftEdgeToEdge() {
        let words = (1...5).map { fakeWord($0) }
        let rect = CGRect(x: 28.8, y: 100, width: 342.4, height: 30)
        let (boxes, gaps) = PageLayout.placeWords(words, in: rect, fontSize: 17.4, centred: false) { _, _ in 40 }
        #expect(boxes.first!.word.indexInLine == 1)
        #expect(abs(boxes.first!.frame.maxX - rect.maxX) < 0.001, "first word touches the right edge")
        #expect(abs(boxes.last!.frame.minX - rect.minX) < 0.001, "last word touches the left edge")
        #expect(zip(boxes, boxes.dropFirst()).allSatisfy { $0.frame.minX > $1.frame.minX }, "each word left of the previous")
        #expect(gaps.count == 4)
        #expect(Set(gaps.map { ($0.width * 1000).rounded() }).count == 1, "gaps are even")
    }

    @Test func centredLineUsesFixedGapsAroundTheMiddle() {
        let words = (1...3).map { fakeWord($0) }
        let rect = CGRect(x: 0, y: 0, width: 300, height: 30)
        let (boxes, gaps) = PageLayout.placeWords(words, in: rect, fontSize: 20, centred: true) { _, _ in 30 }
        #expect(gaps.allSatisfy { abs($0.width - 20 * 0.12) < 0.001 })
        let left = boxes.last!.frame.minX, right = boxes.first!.frame.maxX
        #expect(abs((left + right) / 2 - rect.midX) < 0.001)
    }

    @Test func overlongLineIsCondensedNeverClipped() {
        let words = (1...10).map { fakeWord($0) }
        let rect = CGRect(x: 10, y: 0, width: 200, height: 30)
        let (boxes, gaps) = PageLayout.placeWords(words, in: rect, fontSize: 20, centred: false) { _, _ in 50 }
        #expect(boxes.last!.frame.minX >= rect.minX - 0.001)
        #expect(boxes.first!.frame.maxX <= rect.maxX + 0.001)
        #expect(gaps.allSatisfy { $0.width >= 20 * 0.06 - 0.001 })
    }

    @Test func realPageFifteenRowsWithDecorations() throws {
        let db = try openDatabase()
        let counts = Dictionary(uniqueKeysWithValues: try db.surahs().map { ($0.number, $0.ayahCount) })
        let layout = PageLayout(page: try db.page(50), pageSize: size, surahAyahCounts: counts) { _, s in s }
        #expect(layout.lines.count == 15)
        #expect(layout.lines[0].content == .surahHeader(3))
        #expect(layout.lines[1].content == .basmala)
        guard case let .words(boxes, _) = layout.lines[2].content else { Issue.record("line 3 has words"); return }
        #expect(boxes.first!.word.ayahKey == AyahKey(surah: 3, ayah: 1))
    }

    @Test func openingPagesAreACentredBlockWithoutEmptyRows() throws {
        let db = try openDatabase()
        let counts = Dictionary(uniqueKeysWithValues: try db.surahs().map { ($0.number, $0.ayahCount) })
        for n in [1, 2] {
            let layout = PageLayout(page: try db.page(n), pageSize: size, surahAyahCounts: counts) { _, s in s }
            #expect(layout.lines.allSatisfy { $0.isCentred })
            #expect(!layout.lines.contains { $0.content == .empty }, "page \(n)")
            #expect(layout.lines.first!.rect.minY >= size.height * 0.22 - 0.001)
        }
    }

    @Test func shortLastLineOfASurahIsCentred() throws {
        // Page 604 ends An-Nas (114:6) on a short final line.
        let db = try openDatabase()
        let counts = Dictionary(uniqueKeysWithValues: try db.surahs().map { ($0.number, $0.ayahCount) })
        let layout = PageLayout(page: try db.page(604), pageSize: size, surahAyahCounts: counts) { _, s in s * 0.5 }
        let last = layout.lines.last { if case .words = $0.content { true } else { false } }!
        #expect(last.isCentred)
    }

    @Test func hitTestingFindsTheWordOrTheNearestOnThatLine() throws {
        let db = try openDatabase()
        let counts = Dictionary(uniqueKeysWithValues: try db.surahs().map { ($0.number, $0.ayahCount) })
        let layout = PageLayout(page: try db.page(50), pageSize: size, surahAyahCounts: counts) { _, s in s }
        guard case let .words(boxes, gaps) = layout.lines[2].content else { Issue.record("no words"); return }
        #expect(layout.word(at: CGPoint(x: boxes[3].frame.midX, y: boxes[3].frame.midY)) == boxes[3].word)
        let inGap = CGPoint(x: gaps[0].midX, y: gaps[0].midY)
        #expect([boxes[0].word, boxes[1].word].contains(layout.word(at: inGap)))
        #expect(layout.word(at: CGPoint(x: 200, y: layout.lines[0].rect.midY)) == nil, "surah header is not a word")
    }

    @Test func tallPhoneStretchesAtMostEighteenPercent() {
        let area = CGRect(x: 0, y: 62, width: 440, height: 860)  // iPhone Pro Max safe area
        let rect = PageLayoutConstants.fittedPageRect(in: area, stretch: true)
        #expect(rect.width == 440)
        #expect(abs(rect.height - 440 / PageLayoutConstants.pageAspect * 1.18) < 0.001)
        #expect(abs(rect.midY - area.midY) < 0.001)
    }

    @Test func spreadPageKeepsThePrintAspectAndFitsHeight() {
        let area = CGRect(x: 0, y: 24, width: 683, height: 980)  // half an iPad Pro 13 landscape
        let rect = PageLayoutConstants.fittedPageRect(in: area, stretch: false)
        #expect(rect.height <= area.height + 0.001 && rect.width <= area.width + 0.001)
        #expect(abs(rect.width / rect.height - PageLayoutConstants.pageAspect) < 0.0001)
    }
}
