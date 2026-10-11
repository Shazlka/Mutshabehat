import XCTest

/// Every Arabic string the Qiraat section shows as app chrome must have an English translation in
/// `Sources/Localizable.xcstrings`, so switching the app to English translates the whole section. The scan reads
/// `Sources/Qiraat/*.swift` through `#filePath`, so it needs no build step and fails the moment a new literal
/// lands without a translation.
final class QiraatLocalizationTests: XCTestCase {
    private struct Literal {
        let file: String
        let value: String
        /// The argument label before the literal (`verbatim` in `Text(verbatim: "…")`), if any.
        let label: String?
    }

    private var appRoot: URL { URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent() }

    func testEveryArabicQiraatLiteralHasAnEnglishTranslation() throws {
        let catalog = try loadCatalog()
        let literals = try qiraatLiterals()
        let arabic = literals.filter { Self.containsArabic($0.value) }
        XCTAssertGreaterThan(arabic.count, 15, "the scan must find the Qiraat section's literals, not an empty set")
        XCTAssertTrue(arabic.contains { $0.value == "إغلاق" }, "the scan must see the sheet's close button")

        let missing = arabic.filter { !catalog.english.contains(Self.normalize($0.value)) }
            .map { "\($0.file): \($0.value)" }
        XCTAssertEqual(missing, [], "Arabic Qiraat strings without an English translation in Localizable.xcstrings")
    }

    func testArabicChromeIsNotPassedAsVerbatimText() throws {
        let verbatim = try qiraatLiterals()
            .filter { ["verbatim", "text", "title"].contains($0.label) && Self.containsArabic($0.value) }
            .map { "\($0.file): \($0.label ?? "") \($0.value)" }
        XCTAssertEqual(verbatim, [], "Arabic app chrome must use a localized Text(\"…\"), not verbatim text")
    }

    func testTheDifferenceKindKeysHaveArabicAndEnglish() throws {
        let catalog = try loadCatalog()
        let keys = try qiraatLiterals().map(\.value).filter { $0.hasPrefix("qiraat.") }
        XCTAssertGreaterThanOrEqual(keys.count, 13, "every difference kind is a namespaced key")
        for key in Set(keys) {
            XCTAssertTrue(catalog.english.contains(key), "\(key) has no English value")
            XCTAssertTrue(catalog.arabic.contains(key), "\(key) has no Arabic value (the Arabic UI reads it)")
        }
    }

    // MARK: - Sources and catalog

    private struct Catalog {
        /// Keys (format specifiers normalised) that have a non-empty English value.
        let english: Set<String>
        /// Keys (format specifiers normalised) that have a non-empty Arabic value.
        let arabic: Set<String>
    }

    private func loadCatalog() throws -> Catalog {
        let url = appRoot.appendingPathComponent("Sources/Localizable.xcstrings")
        let root = try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any]
        let strings = try XCTUnwrap(root?["strings"] as? [String: Any], "Localizable.xcstrings has no strings")
        var english: Set<String> = []
        var arabic: Set<String> = []
        for (key, entry) in strings {
            let localizations = (entry as? [String: Any])?["localizations"] as? [String: Any] ?? [:]
            for (language, value) in localizations {
                let unit = (value as? [String: Any])?["stringUnit"] as? [String: Any]
                guard let text = unit?["value"] as? String, !text.isEmpty else { continue }
                if language == "en" { english.insert(Self.normalize(key)) }
                if language == "ar" { arabic.insert(Self.normalize(key)) }
            }
        }
        return Catalog(english: english, arabic: arabic)
    }

    private func qiraatLiterals() throws -> [Literal] {
        let directory = appRoot.appendingPathComponent("Sources/Qiraat", isDirectory: true)
        let files = try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
            .filter { $0.pathExtension == "swift" }
        XCTAssertFalse(files.isEmpty, "no Qiraat sources found at \(directory.path)")
        return try files.flatMap { file in
            let source = try String(contentsOf: file, encoding: .utf8)
            return Self.literals(in: source).map { Literal(file: file.lastPathComponent, value: $0.value, label: $0.label) }
        }
    }

    // MARK: - Scanning

    /// A small lexer: skips comments, reads string literals, and turns each `\(…)` interpolation into `%@`.
    private static func literals(in source: String) -> [(value: String, label: String?)] {
        let chars = Array(source)
        var result: [(value: String, label: String?)] = []
        var i = 0
        func at(_ k: Int) -> Character? { k < chars.count ? chars[k] : nil }
        while i < chars.count {
            let c = chars[i]
            if c == "/", at(i + 1) == "/" {
                while i < chars.count, chars[i] != "\n" { i += 1 }
            } else if c == "/", at(i + 1) == "*" {
                i += 2
                while i < chars.count, !(chars[i] == "*" && at(i + 1) == "/") { i += 1 }
                i += 2
            } else if c == "\"" {
                let label = labelBefore(i, in: chars)
                i += 1
                var value = ""
                while i < chars.count, chars[i] != "\"" {
                    if chars[i] == "\\", at(i + 1) == "(" {
                        value += "%@"
                        i += 2
                        var depth = 1
                        while i < chars.count, depth > 0 {
                            if chars[i] == "(" { depth += 1 } else if chars[i] == ")" { depth -= 1 }
                            i += 1
                        }
                    } else if chars[i] == "\\" {
                        if let next = at(i + 1) { value.append(next) }
                        i += 2
                    } else {
                        value.append(chars[i])
                        i += 1
                    }
                }
                i += 1
                result.append((value, label))
            } else {
                i += 1
            }
        }
        return result
    }

    /// The argument label written just before a literal, e.g. `verbatim` in `Text(verbatim: "…")`.
    private static func labelBefore(_ index: Int, in chars: [Character]) -> String? {
        var j = index - 1
        while j >= 0, chars[j] == " " { j -= 1 }
        guard j >= 0, chars[j] == ":" else { return nil }
        j -= 1
        var name = ""
        while j >= 0, chars[j].isLetter {
            name.insert(chars[j], at: name.startIndex)
            j -= 1
        }
        return name.isEmpty ? nil : name
    }

    /// True for a literal that has an Arabic letter. Punctuation and separators (the Arabic comma «،», dashes,
    /// spaces) are not translatable chrome, so a literal made only of them is skipped, not reported.
    private static func containsArabic(_ text: String) -> Bool {
        text.unicodeScalars.contains { isArabicLetter($0) }
    }

    private static func isArabicLetter(_ scalar: Unicode.Scalar) -> Bool {
        let isArabic = (0x0600...0x06FF).contains(scalar.value)
            || (0x0750...0x077F).contains(scalar.value)
            || (0x08A0...0x08FF).contains(scalar.value)
        guard isArabic else { return false }
        switch scalar.properties.generalCategory {
        case .otherLetter, .modifierLetter, .uppercaseLetter, .lowercaseLetter, .titlecaseLetter:
            return true
        default:
            return false
        }
    }

    /// `%lld`, `%d` and `%@` are the same argument for this check.
    private static func normalize(_ key: String) -> String {
        key.replacingOccurrences(of: #"%(\d+\$)?(lld|ld|d|@)"#, with: "%@", options: .regularExpression)
    }
}
