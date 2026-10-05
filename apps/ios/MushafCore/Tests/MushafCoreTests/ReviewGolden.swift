import Foundation
import Testing
@testable import MushafCore

/// Support for the golden-parity tests: the web's own TypeScript produced these files
/// (`make review-golden`), the Swift ports must give identical answers.
enum ReviewGolden {
    static let repoRoot = generatedDirectory.deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
    static let directory = generatedDirectory.appendingPathComponent("Review/golden")
    static let referenceDirectory = generatedDirectory.appendingPathComponent("Review/reference")

    static func load<T: Decodable>(_ name: String, as type: T.Type = T.self) throws -> T {
        let url = directory.appendingPathComponent("\(name).json")
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw GoldenMissing(name: name)
        }
        return try JSONDecoder().decode(T.self, from: Data(contentsOf: url))
    }

    struct GoldenMissing: Error, CustomStringConvertible {
        let name: String
        var description: String { "golden file \(name).json is missing: run `make review-golden` in apps/ios" }
    }

    struct FixtureWord { let surah: Int; let ayah: Int; let word: Int; let text: String }

    /// The real page words (type "word") the web review page lists, read from the web's fixtures.
    static func pageWords(_ page: Int) throws -> [FixtureWord] {
        struct File: Decodable {
            struct Line: Decodable {
                struct W: Decodable {
                    let surahNumber: Int, ayahNumber: Int, wordIndexInAyah: Int, textUthmani: String, charTypeName: String
                }
                let words: [W]
            }
            let lines: [Line]
        }
        let url = repoRoot.appendingPathComponent(
            "packages/quran-data/mushaf1441/fixtures/page-words/page-\(String(format: "%03d", page)).json")
        let file = try JSONDecoder().decode(File.self, from: Data(contentsOf: url))
        return file.lines.flatMap(\.words).filter { $0.charTypeName == "word" }
            .map { FixtureWord(surah: $0.surahNumber, ayah: $0.ayahNumber, word: $0.wordIndexInAyah, text: $0.textUthmani) }
    }

    static func context(_ words: [FixtureWord], surah: Int, ayah: Int, word: Int) -> NquranAyahContext {
        NquranAyahContext(
            wordIndex: word,
            ayahWords: words.filter { $0.surah == surah && $0.ayah == ayah }
                .map { AyahWord(word: $0.word, text: $0.text) }.sorted { $0.word < $1.word })
    }
}
