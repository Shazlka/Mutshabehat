import Foundation
@testable import MushafCore

/// apps/ios/Generated — built by scripts/ios/build_mushaf_db.py and scripts/ios/fetch_qcf_fonts.sh.
let generatedDirectory = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent()  // MushafCoreTests
    .deletingLastPathComponent()  // Tests
    .deletingLastPathComponent()  // MushafCore
    .deletingLastPathComponent()  // apps/ios
    .appendingPathComponent("Generated")

func openDatabase() throws -> MushafDatabase {
    try MushafDatabase(url: generatedDirectory.appendingPathComponent("mushaf.sqlite"))
}

/// A word with only the fields the layout rules look at.
func fakeWord(_ i: Int, line: Int = 3, surah: Int = 2, ayah: Int = 10, type: CharType = .word) -> MushafWord {
    MushafWord(id: "w\(line)-\(i)", page: 10, line: line, indexInLine: i, ayahKey: AyahKey(surah: surah, ayah: ayah),
               indexInAyah: i, charType: type, glyph: "\u{FC41}", textUthmani: "x")
}
