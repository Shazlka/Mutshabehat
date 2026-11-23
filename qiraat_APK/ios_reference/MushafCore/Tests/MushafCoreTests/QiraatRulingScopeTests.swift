import Foundation
import Testing
@testable import MushafCore

/// إمالة for حمزة (Q06-R01, Q06-R02) and تقليل for ورش (Q01-R02): with one reader or narrator selected the
/// ruling card must show only that reader's group, not every reader's.
private let imalah = QiraatRuling(
    id: "r", category: "IMALAH_TAQLIL", categoryAr: "الممال والمقلل", color: "#C026D3", wordAnchored: true,
    surah: 2, ayah: 1, startToken: 1, endToken: 1, baseText: "هُدًى", verificationStatus: "REVIEWED", hasAlternate: true,
    attribution: [
        QiraatRulingAttribution(authorityId: "Q06-R01", action: "إمالة"),
        QiraatRulingAttribution(authorityId: "Q06-R02", action: "إمالة"),
        QiraatRulingAttribution(authorityId: "Q01-R02", action: "تقليل", wajhOrder: 1),
        QiraatRulingAttribution(authorityId: "Q01-R02", action: "فتح", wajhOrder: 2),
        QiraatRulingAttribution(authorityId: "Q07", action: "إمالة"),
    ],
    readings: [
        QiraatRulingReading(readingId: "Q06-R01", action: "إمالة", isDefault: true),
        QiraatRulingReading(readingId: "Q06-R02", action: "إمالة", isDefault: true),
        QiraatRulingReading(readingId: "Q01-R02", action: "تقليل", isDefault: true),
        QiraatRulingReading(readingId: "Q01-R02", action: "فتح", isDefault: false),
    ])

@Suite struct QiraatRulingScopeTests {
    @Test func allKeepsEveryRow() {
        #expect(imalah.attribution(scopedTo: .all, catalog: testCatalog).count == 5)
    }

    @Test func aNarratorSeesOnlyHisOwnRows() {
        let rows = imalah.attribution(scopedTo: .reading("Q01-R02"), catalog: testCatalog)
        #expect(rows.map(\.action) == ["تقليل", "فتح"])
        #expect(rows.allSatisfy { $0.authorityId == "Q01-R02" })
        #expect(imalah.attributionByAction(scopedTo: .reading("Q06-R01"), catalog: testCatalog).map(\.action) == ["إمالة"])
    }

    @Test func aReaderSeesHisNarratorsAndHisReaderLevelRow() {
        let hamzah = imalah.attribution(scopedTo: .reader("Q06"), catalog: testCatalog)
        #expect(hamzah.map(\.authorityId) == ["Q06-R01", "Q06-R02"])
        let kisai = imalah.attribution(scopedTo: .reader("Q07"), catalog: testCatalog)
        #expect(kisai.map(\.authorityId) == ["Q07"])
    }

    @Test func aReaderLevelRowAppliesToHisNarrator() {
        #expect(imalah.attribution(scopedTo: .reading("Q07-R01"), catalog: testCatalog).map(\.authorityId) == ["Q07"])
    }

    @Test func theAlternateWajhIsOnlyReportedForTheSelectedReader() {
        #expect(imalah.hasAlternateReading(scopedTo: .all, catalog: testCatalog))
        #expect(imalah.hasAlternateReading(scopedTo: .reader("Q01"), catalog: testCatalog))
        #expect(!imalah.hasAlternateReading(scopedTo: .reader("Q06"), catalog: testCatalog))
    }
}
