import Foundation
import MushafCore
import XCTest
@testable import Mutshabehat

/// Every value below is an invented test fixture, not Quran or Qiraat data.
final class QiraatSyncStatusTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_800_000_000)

    private func status(_ outcome: QiraatLiveSync.Outcome?, secondsSinceSuccess: TimeInterval?, offline: Bool = false) -> QiraatSyncStatus {
        QiraatSyncStatus.make(outcome: outcome,
                              lastSuccess: secondsSinceSuccess.map { now.addingTimeInterval(-$0) },
                              now: now, isOffline: offline)
    }

    // MARK: Every outcome, with and without an earlier confirmation

    func testUpdatedMeansCurrentWhetherOrNotThePreviousSuccessIsKnown() {
        XCTAssertEqual(status(.updated, secondsSinceSuccess: nil).kind, .current)
        XCTAssertEqual(status(.updated, secondsSinceSuccess: 0).kind, .current)
        XCTAssertEqual(status(.updated, secondsSinceSuccess: nil).title, "محدّث الآن")
    }

    func testUnchangedMeansCurrentBecauseTheWebAnsweredNow() {
        XCTAssertEqual(status(.unchanged, secondsSinceSuccess: nil).kind, .current)
        XCTAssertEqual(status(.unchanged, secondsSinceSuccess: 10).kind, .current)
    }

    func testFailedWithNoEarlierSuccessIsTheLocalCopy() {
        let result = status(.failed, secondsSinceSuccess: nil)
        XCTAssertEqual(result.kind, .localCopy)
        XCTAssertEqual(result.title.removingBidiIsolates, "نسخة محلية")
    }

    func testSkippedWithNoEarlierSuccessIsTheLocalCopy() {
        XCTAssertEqual(status(.skipped, secondsSinceSuccess: nil).kind, .localCopy)
    }

    func testNoOutcomeYetWithNoEarlierSuccessIsTheLocalCopy() {
        XCTAssertEqual(status(nil, secondsSinceSuccess: nil).kind, .localCopy)
    }

    func testFailedKeepsTheTimeOfTheLastConfirmation() {
        let result = status(.failed, secondsSinceSuccess: 5 * 60)
        XCTAssertEqual(result.kind, .confirmed(elapsed: 300))
        XCTAssertEqual(result.title.removingBidiIsolates, "محدّث قبل ٥ دقائق")
    }

    func testSkippedKeepsTheTimeOfTheLastConfirmation() {
        let result = status(.skipped, secondsSinceSuccess: 3 * 3600)
        XCTAssertEqual(result.title.removingBidiIsolates, "محدّث قبل ٣ ساعات")
    }

    func testNoOutcomeYetKeepsTheTimeOfAnEarlierConfirmation() {
        XCTAssertEqual(status(nil, secondsSinceSuccess: 90).title.removingBidiIsolates, "محدّث قبل دقيقة")
    }

    func testEveryOutcomeIsCoveredByOneRule() {
        let outcomes: [QiraatLiveSync.Outcome?] = [nil, .updated, .unchanged, .skipped, .failed]
        for outcome in outcomes {
            for previous in [nil, 0, 30, 600, 7200] as [TimeInterval?] {
                for offline in [false, true] {
                    let result = status(outcome, secondsSinceSuccess: previous, offline: offline)
                    XCTAssertEqual(result.isOffline, offline)
                    XCTAssertFalse(result.title.isEmpty)
                }
            }
        }
    }

    // MARK: Boundaries and wording

    func testTheCurrentWindowEndsAfterOneMinute() {
        XCTAssertEqual(status(.failed, secondsSinceSuccess: 59).kind, .current)
        XCTAssertEqual(status(.failed, secondsSinceSuccess: 60).kind, .confirmed(elapsed: 60))
    }

    func testMinutesUseArabicPlurals() {
        XCTAssertEqual(QiraatSyncStatus.agoText(60), "قبل دقيقة")
        XCTAssertEqual(QiraatSyncStatus.agoText(120), "قبل دقيقتين")
        XCTAssertEqual(QiraatSyncStatus.agoText(3 * 60), "قبل ٣ دقائق")
        XCTAssertEqual(QiraatSyncStatus.agoText(11 * 60), "قبل ١١ دقيقة")
    }

    func testHoursAndDaysUseArabicPlurals() {
        XCTAssertEqual(QiraatSyncStatus.agoText(3600), "قبل ساعة")
        XCTAssertEqual(QiraatSyncStatus.agoText(2 * 3600), "قبل ساعتين")
        XCTAssertEqual(QiraatSyncStatus.agoText(5 * 3600), "قبل ٥ ساعات")
        XCTAssertEqual(QiraatSyncStatus.agoText(12 * 3600), "قبل ١٢ ساعة")
        XCTAssertEqual(QiraatSyncStatus.agoText(24 * 3600), "قبل يوم")
        XCTAssertEqual(QiraatSyncStatus.agoText(2 * 86400), "قبل يومين")
        XCTAssertEqual(QiraatSyncStatus.agoText(5 * 86400), "قبل ٥ أيام")
        XCTAssertEqual(QiraatSyncStatus.agoText(11 * 86400), "قبل ١١ يومًا")
    }

    // MARK: Offline

    func testOfflineWithNoConfirmationIsStillTheLocalCopyAndSaysSo() {
        let result = status(.failed, secondsSinceSuccess: nil, offline: true)
        XCTAssertEqual(result.kind, .localCopy)
        XCTAssertTrue(result.isOffline)
        XCTAssertEqual(result.symbolName, "wifi.slash")
    }

    func testOfflineKeepsTheTimeOfTheLastConfirmation() {
        let result = status(.skipped, secondsSinceSuccess: 600, offline: true)
        XCTAssertEqual(result.title.removingBidiIsolates, "محدّث قبل ١٠ دقائق")
        XCTAssertEqual(result.symbolName, "wifi.slash")
    }

    func testOnlineStatusUsesTheStateSymbol() {
        XCTAssertEqual(status(.updated, secondsSinceSuccess: nil).symbolName, "checkmark.circle")
        XCTAssertEqual(status(.failed, secondsSinceSuccess: 600).symbolName, "clock")
        XCTAssertEqual(status(.failed, secondsSinceSuccess: nil).symbolName, "internaldrive")
    }

    // MARK: Error report text

    func testErrorReportNamesThePageThePositionTheWordAndTheEntries() {
        let report = QiraatErrorReport(page: 8, ayah: AyahKey(surah: 2, ayah: 255), token: 3, word: "كلمة اختبار",
                                       variantIDs: ["v-fixture-1"], rulingIDs: ["r-fixture-2", "r-fixture-3"])
        let lines = report.text.components(separatedBy: "\n")
        XCTAssertEqual(lines, [
            "بلاغ عن خطأ في القراءات",
            "الصفحة: 8",
            "الموضع: 2:255:3",
            "الكلمة: كلمة اختبار",
            "الوجوه: v-fixture-1",
            "الأحكام: r-fixture-2، r-fixture-3",
        ])
    }

    func testErrorReportLeavesOutEmptySections() {
        let report = QiraatErrorReport(page: 1, ayah: AyahKey(surah: 1, ayah: 4), token: 1, word: "كلمة اختبار ثانية",
                                       variantIDs: [], rulingIDs: [])
        XCTAssertFalse(report.text.contains("الوجوه"))
        XCTAssertFalse(report.text.contains("الأحكام"))
        XCTAssertTrue(report.text.contains("الموضع: 1:4:1"))
    }
}
