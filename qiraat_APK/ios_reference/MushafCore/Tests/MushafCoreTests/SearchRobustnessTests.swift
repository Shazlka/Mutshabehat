import Foundation
import Testing
@testable import MushafCore

/// Inputs a person can type or a caller can pass that used to trap or throw.
@Suite struct SearchRobustnessTests {
    /// A `ClosedRange` with lower > upper is a fatal error, so a reversed range typed by the user ended the app.
    @Test func reversedRangeInAnAdvancedQueryDoesNotTrap() {
        #expect(AdvancedQuranQueryParser.parse("رقم_السورة:[10 الى 2]") != nil)
        #expect(AdvancedQuranQueryParser.parse("سورة:[5 الى 2]") != nil)
        #expect(AdvancedQuranQueryParser.parse("[10 الى 3]") != nil)
        #expect(AdvancedQuranQueryParser.parse("رقم_الآية:[7 الى 1]") != nil)
    }

    @Test func reversedRangeRunsAsTheOrderedRange() throws {
        let database = try openDatabase()
        let forward = try database.searchAyaat(matching: "سورة:[1 الى 2]", mode: .smart)
        let reversed = try database.searchAyaat(matching: "سورة:[2 الى 1]", mode: .smart)
        #expect(!forward.isEmpty)
        #expect(forward.map(\.ayah) == reversed.map(\.ayah))
    }

    /// Broad mode falls back to a rasm lookup when nothing matches exactly; its SQL ordered by an ambiguous
    /// column and threw `queryFailed` for every such query, which the search screen showed as an error.
    @Test func broadModeQueryWithNoExactMatchDoesNotThrow() throws {
        let database = try openDatabase()
        for typo in ["الرجمن", "الرحيل", "العالمبن", "الصراظ", "نستعبن"] {
            _ = try database.searchAyaat(matching: typo, mode: .broad)
        }
    }

    /// Smart mode shares the similarity stage's SQL shape; a missed word must return, never throw.
    @Test func smartModeQueryWithNoExactMatchDoesNotThrow() throws {
        let database = try openDatabase()
        for typo in ["الرجمن", "الرحيل", "العالمبن", "الصراظ", "نستعبن"] {
            _ = try database.searchAyaat(matching: typo, mode: .smart)
        }
    }

    @Test func fontNeighbourhoodNeverLeavesTheMushaf() {
        for page in [-5, 0, 1, 2, 603, 604, 605, 607, 900] {
            let range = QCFFontStore.neighbourhood(of: page)
            #expect(range.lowerBound >= 1 && range.upperBound <= mushafPageCount, "page \(page)")
        }
    }
}
