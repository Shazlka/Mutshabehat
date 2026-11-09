import SwiftUI
import XCTest
@testable import Mutshabehat

@MainActor
private final class RunLog {
    var runs: [Int] = []
}

final class ReaderFixesTests: XCTestCase {
    // MARK: ChangeGate

    func testChangeGateRunsOnFirstKeyAndOnChangeOnly() {
        var gate = ChangeGate<Int>()
        XCTAssertTrue(gate.shouldRun(1))
        XCTAssertFalse(gate.shouldRun(1))
        XCTAssertTrue(gate.shouldRun(2))
        XCTAssertFalse(gate.shouldRun(2))
        XCTAssertTrue(gate.shouldRun(1), "going back to an earlier key is a change")
    }

    func testChangeGateResetRunsTheSameKeyAgain() {
        var gate = ChangeGate<String>()
        XCTAssertTrue(gate.shouldRun("a"))
        XCTAssertFalse(gate.shouldRun("a"))
        gate.reset()
        XCTAssertTrue(gate.shouldRun("a"))
    }

    // MARK: KeyedCache

    func testKeyedCacheHitsOnlyForTheStoredKey() {
        var cache = KeyedCache<Int, String>()
        XCTAssertNil(cache.value(for: 1))
        cache.store("one", for: 1)
        XCTAssertEqual(cache.value(for: 1), "one")
        XCTAssertNil(cache.value(for: 2), "a different key is a miss, never the stale value")
        cache.store("two", for: 2)
        XCTAssertNil(cache.value(for: 1))
        XCTAssertEqual(cache.value(for: 2), "two")
        cache.clear()
        XCTAssertNil(cache.value(for: 2))
    }

    // MARK: Debouncer

    @MainActor
    func testDebouncerRunsOnlyTheLatestWork() async throws {
        let debouncer = Debouncer()
        let log = RunLog()
        for i in 1...3 {
            debouncer.schedule(after: .milliseconds(40)) { log.runs.append(i) }
        }
        try await Task.sleep(for: .milliseconds(250))
        XCTAssertEqual(log.runs, [3])
    }

    @MainActor
    func testDebouncerCancelDropsPendingWork() async throws {
        let debouncer = Debouncer()
        let log = RunLog()
        debouncer.schedule(after: .milliseconds(40)) { log.runs.append(1) }
        debouncer.cancel()
        try await Task.sleep(for: .milliseconds(200))
        XCTAssertTrue(log.runs.isEmpty)
    }

    @MainActor
    func testDebouncerRunsAgainAfterThePause() async throws {
        let debouncer = Debouncer()
        let log = RunLog()
        debouncer.schedule(after: .milliseconds(30)) { log.runs.append(1) }
        try await Task.sleep(for: .milliseconds(200))
        debouncer.schedule(after: .milliseconds(30)) { log.runs.append(2) }
        try await Task.sleep(for: .milliseconds(200))
        XCTAssertEqual(log.runs, [1, 2])
    }

    func testSearchDebounceIsQuarterOfASecond() {
        XCTAssertEqual(SearchDebounce.interval, .milliseconds(250))
    }

    // MARK: ChromeContrast

    func testChromeIsOpaqueForReducedTransparencyOrIncreasedContrast() {
        XCTAssertFalse(ChromeContrast.prefersOpaque(reduceTransparency: false, contrast: .standard))
        XCTAssertTrue(ChromeContrast.prefersOpaque(reduceTransparency: true, contrast: .standard))
        XCTAssertTrue(ChromeContrast.prefersOpaque(reduceTransparency: false, contrast: .increased))
        XCTAssertTrue(ChromeContrast.prefersOpaque(reduceTransparency: true, contrast: .increased))
    }

    // MARK: LaunchHooks

    func testUnknownLaunchHooksAreOff() {
        XCTAssertFalse(LaunchHooks.has("-no-such-hook-for-tests"))
        XCTAssertNil(LaunchHooks.intValue(after: "-no-such-hook-for-tests"))
    }
}
