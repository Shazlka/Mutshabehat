import Foundation
import Testing
@testable import MushafCore

@Suite struct NavigationTests {
    @Test func spreadsPairOddRightWithEvenLeft() {
        #expect(Spread.rightPage(of: 1) == 1 && Spread.leftPage(of: 1) == 2)
        #expect(Spread.rightPage(of: 2) == 1 && Spread.leftPage(of: 2) == 2)
        #expect(Spread.rightPage(of: 604) == 603 && Spread.leftPage(of: 604) == 604)
    }

    @Test func spreadOnlyInWideLandscape() {
        #expect(Spread.isSpread(width: 1366, height: 1024))   // iPad Pro 13 landscape
        #expect(Spread.isSpread(width: 1180, height: 820))    // iPad Air 11 landscape
        #expect(!Spread.isSpread(width: 1024, height: 1366))  // portrait
        #expect(!Spread.isSpread(width: 956, height: 440))    // iPhone landscape: too narrow
    }

    func freshDefaults() -> UserDefaults {
        let name = "test-\(UUID().uuidString)"
        return UserDefaults(suiteName: name)!
    }

    @Test func readingPositionDefaultsToPageOne() {
        #expect(ReadingPosition(defaults: freshDefaults()).page == 1)
    }

    @Test(arguments: [(50, 50), (0, 1), (605, 604), (-3, 1), (604, 604)])
    func readingPositionIsClamped(_ stored: Int, _ expected: Int) {
        let defaults = freshDefaults()
        defaults.set(stored, forKey: ReadingPosition.key)
        #expect(ReadingPosition(defaults: defaults).page == expected)
    }

    @Test func garbageStoredValueFallsBackToPageOne() {
        let defaults = freshDefaults()
        defaults.set("not a page", forKey: ReadingPosition.key)
        #expect(ReadingPosition(defaults: defaults).page == 1)
    }

    @Test func writingClamps() {
        let position = ReadingPosition(defaults: freshDefaults())
        position.page = 9999
        #expect(position.page == 604)
    }
}
