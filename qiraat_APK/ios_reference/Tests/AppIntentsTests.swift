import AppIntents
import MushafCore
import XCTest
@testable import Mutshabehat

/// Siri, Shortcuts and Spotlight can open the reader at a page or a surah. Each action lands in one router that the
/// reader reads, so a running app jumps at once and a cold launch resumes at the same place.
@MainActor
final class AppIntentsTests: XCTestCase {
    private func makeRouter() -> (AppIntentRouter, UserDefaults) {
        let suite = "AppIntentsTests-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defaults.removePersistentDomain(forName: suite)
        return (AppIntentRouter(defaults: defaults), defaults)
    }

    func testOpeningAPageClampsItAndSetsBothTheJumpAndTheResumePosition() {
        let (router, defaults) = makeRouter()
        router.open(page: 9999)
        XCTAssertEqual(router.pendingPage, 604)
        XCTAssertEqual(ReadingPosition(defaults: defaults).page, 604)
        router.open(page: 0)
        XCTAssertEqual(router.pendingPage, 1)
        XCTAssertEqual(ReadingPosition(defaults: defaults).page, 1)
    }

    func testAJumpIsTakenOnce() {
        let (router, _) = makeRouter()
        router.open(page: 77)
        XCTAssertEqual(router.takePendingPage(), 77)
        XCTAssertNil(router.takePendingPage())
    }

    func testContinueReadingChangesNothing() {
        let (router, defaults) = makeRouter()
        ReadingPosition(defaults: defaults).page = 120
        router.continueReading()
        XCTAssertNil(router.pendingPage)
        XCTAssertEqual(ReadingPosition(defaults: defaults).page, 120)
    }

    func testTheSurahListHasAll114WithTheirFirstPages() throws {
        let all = try SurahEntityQuery().suggestedEntitiesSync()
        XCTAssertEqual(all.count, 114)
        XCTAssertEqual(all.first?.startPage, 1)
        XCTAssertEqual(all.first(where: { $0.id == 2 })?.startPage, 2)
        XCTAssertEqual(all.first(where: { $0.id == 18 })?.startPage, 293)
        XCTAssertFalse(all.contains { $0.name.isEmpty })
    }

    func testASurahIsFoundByIdAndByItsNameWithoutDiacritics() throws {
        let query = SurahEntityQuery()
        XCTAssertEqual(try query.entitiesSync(for: [36]).map(\.id), [36])
        let name = try XCTUnwrap(try query.entitiesSync(for: [2]).first?.name)
        let plain = name.folding(options: [.diacriticInsensitive], locale: nil)
        XCTAssertTrue(try query.entitiesSync(matching: plain).contains { $0.id == 2 })
        XCTAssertTrue(try query.entitiesSync(matching: "zzzz").isEmpty)
    }

    func testTheIntentsReachTheRouter() async throws {
        let (router, _) = makeRouter()
        var page = OpenMushafPageIntent(); page.page = 50
        try await page.run(on: router)
        XCTAssertEqual(router.pendingPage, 50)

        var surah = OpenSurahIntent()
        surah.surah = try XCTUnwrap(try SurahEntityQuery().entitiesSync(for: [18]).first)
        try await surah.run(on: router)
        XCTAssertEqual(router.pendingPage, 293)
    }
}
