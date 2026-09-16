import Foundation
import MutshabehatDomain
import Testing

struct StringVector: Decodable, Sendable, CustomStringConvertible {
    let input: String
    let expected: String
    var description: String { input.debugDescription }
}

struct IntVector: Decodable, Sendable, CustomStringConvertible {
    let input: String
    let expected: Int
    var description: String { input.debugDescription }
}

struct ArabicIntVector: Decodable, Sendable, CustomStringConvertible {
    let input: Int
    let expected: String
    var description: String { String(input) }
}

struct ArabicVector: Sendable, CustomStringConvertible {
    let input: String
    let normalized: String
    let skeleton: String
    var description: String { input.debugDescription }
}

private struct GoldenFixture: Decodable, Sendable {
    let normalizeArabic: [StringVector]
    let rasmSkeleton: [StringVector]
    let ayahToInt: [IntVector]
    let ayahToArabic: [ArabicIntVector]

    var arabicVectors: [ArabicVector] {
        precondition(normalizeArabic.count == rasmSkeleton.count)
        return zip(normalizeArabic, rasmSkeleton).map { normalized, skeleton in
            precondition(normalized.input == skeleton.input)
            return ArabicVector(
                input: normalized.input,
                normalized: normalized.expected,
                skeleton: skeleton.expected
            )
        }
    }
}

private let goldenFixture: GoldenFixture = {
    let url = Bundle.module.url(forResource: "arabic-golden", withExtension: "json")!
    let data = try! Data(contentsOf: url)
    return try! JSONDecoder().decode(GoldenFixture.self, from: data)
}()

@Suite("Arabic text")
struct ArabicGoldenTests {
    @Test("Golden Arabic vector", arguments: goldenFixture.arabicVectors)
    func goldenArabicVector(_ vector: ArabicVector) {
        #expect(
            ArabicText.normalizeArabic(vector.input) == vector.normalized,
            "normalizeArabic input: \(vector.input.debugDescription)"
        )
        #expect(
            ArabicText.rasmSkeleton(vector.input) == vector.skeleton,
            "rasmSkeleton input: \(vector.input.debugDescription)"
        )
    }

    @Test("Golden ayahToInt vector", arguments: goldenFixture.ayahToInt)
    func goldenAyahToIntVector(_ vector: IntVector) {
        #expect(
            ArabicText.ayahToInt(vector.input) == vector.expected,
            "ayahToInt input: \(vector.input.debugDescription)"
        )
    }

    @Test("Golden ayahToArabic vector", arguments: goldenFixture.ayahToArabic)
    func goldenAyahToArabicVector(_ vector: ArabicIntVector) {
        #expect(
            ArabicText.ayahToArabic(vector.input) == vector.expected,
            "ayahToArabic input: \(vector.input)"
        )
    }

    @Test("stripTashkeel removes combining marks by scalar")
    func stripTashkeelUsesScalars() {
        #expect(ArabicText.stripTashkeel("بِسْمِ") == "بسم")
    }

    @Test("normalizeArabicWithMap preserves surrounding whitespace")
    func mappedNormalizationDoesNotTrim() {
        let result = ArabicText.normalizeArabicWithMap(" أ ")
        #expect(result.norm == " ا ")
        #expect(result.map == [0, 1, 2])
        #expect(ArabicText.normalizeArabic(" أ ") == "ا")
    }

    @Test("matchRanges maps an exact normalized match to the original text")
    func exactMatchRange() throws {
        let text = "ٱلرَّحۡمَٰنِ"
        let range = try #require(ArabicText.matchRanges(text: text, query: "الرحمان").first)
        #expect(String(text[range]) == text)
    }

    @Test("matchRanges pulls a leading alef into a skeleton match")
    func skeletonMatchIncludesLeadingAlef() throws {
        let text = "في السموات"
        let range = try #require(ArabicText.matchRanges(text: text, query: "السماوات").first)
        #expect(String(text[range]) == "السموات")
    }

    @Test("matchRanges rejects skeleton queries shorter than three scalars")
    func shortSkeletonDoesNotMatch() {
        #expect(ArabicText.matchRanges(text: "قل", query: "قال").isEmpty)
    }
}

@Suite("Validated domain values")
struct ValidatedDomainValueTests {
    @Test("AyahKey accepts only ASCII surah:ayah values")
    func ayahKeyValidation() {
        #expect(AyahKey("1:2")?.rawValue == "1:2")
        #expect(AyahKey("1:") == nil)
        #expect(AyahKey(":2") == nil)
        #expect(AyahKey("1:2:3") == nil)
        #expect(AyahKey("١:٢") == nil)
    }

    @Test("PageNumber accepts the closed 1 through 604 range")
    func pageNumberValidation() {
        #expect(PageNumber(1)?.rawValue == 1)
        #expect(PageNumber(604)?.rawValue == 604)
        #expect(PageNumber(0) == nil)
        #expect(PageNumber(605) == nil)
    }
}

