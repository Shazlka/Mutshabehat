import Foundation
import Testing
@testable import MushafCore

@Suite struct QiraatPageTintTests {
    @Test func noReaderChosenLeavesThePaperAlone() {
        #expect(QiraatPageTint.readerColor(for: .all, catalog: testCatalog) == nil)
    }

    @Test func aReaderUsesItsOwnColour() throws {
        let hex = try #require(testCatalog.reader("Q05")?.color)
        #expect(QiraatPageTint.readerColor(for: .reader("Q05"), catalog: testCatalog) == QiraatColor(hex: hex))
    }

    @Test func aNarratorUsesItsReadersColour() throws {
        let hex = try #require(testCatalog.reader("Q03")?.color)
        #expect(QiraatPageTint.readerColor(for: .reading("Q03-R01"), catalog: testCatalog) == QiraatColor(hex: hex))
        #expect(QiraatPageTint.readerColor(for: .reading("Q03-R02"), catalog: testCatalog)
                == QiraatPageTint.readerColor(for: .reading("Q03-R01"), catalog: testCatalog))
    }

    @Test func anUnknownReaderOrNarratorGivesNoTint() {
        #expect(QiraatPageTint.readerColor(for: .reader("Q99"), catalog: testCatalog) == nil)
        #expect(QiraatPageTint.readerColor(for: .reading("Q99-R01"), catalog: testCatalog) == nil)
    }

    @Test func eachOfTheTenReadersGetsADistinctTint() {
        let tints = testCatalog.readers.compactMap { QiraatPageTint.readerColor(for: .reader($0.id), catalog: testCatalog) }
        #expect(tints.count == 10)
        #expect(Set(tints).count == 10)
    }

    @Test func mixingMovesTheOpenPaperOnlyPartWayTowardsTheTint() {
        let paper = QiraatColor(red: 1, green: 1, blue: 1)
        let tint = QiraatColor(red: 0, green: 0, blue: 0)
        let mixed = QiraatPageTint.mixed(paper: paper, with: tint, amount: 0.25)
        #expect(abs(mixed.red - 0.75) < 1e-9 && abs(mixed.green - 0.75) < 1e-9 && abs(mixed.blue - 0.75) < 1e-9)
        #expect(QiraatPageTint.mixed(paper: paper, with: tint, amount: 0) == paper)
    }

    /// The wash must stay soft: with every reader, light paper stays light and the ink still reads at AAA (7:1).
    @Test func theSoftWashKeepsInkReadableOnEveryReaderInLightAndDark() throws {
        let lightPaper = QiraatColor(red: 1, green: 0.992, blue: 0.965)
        let lightInk = QiraatColor(red: 0.09, green: 0.09, blue: 0.09)
        let darkPaper = QiraatColor(red: 0.11, green: 0.105, blue: 0.09)
        let darkInk = QiraatColor(red: 0.92, green: 0.91, blue: 0.86)
        for reader in testCatalog.readers {
            let tint = try #require(QiraatColor(hex: reader.color))
            let light = QiraatPageTint.mixed(paper: lightPaper, with: tint, amount: QiraatPageTint.washAmount)
            let dark = QiraatPageTint.mixed(paper: darkPaper, with: tint, amount: QiraatPageTint.washAmount)
            #expect(light.luminance > 0.70, "light wash too heavy for \(reader.id)")
            #expect(dark.luminance < 0.12, "dark wash too bright for \(reader.id)")
            #expect(QiraatColor.contrast(lightInk, light) >= 7, "light ink for \(reader.id)")
            #expect(QiraatColor.contrast(darkInk, dark) >= 7, "dark ink for \(reader.id)")
        }
    }
}
