import Foundation

public indirect enum AdvancedQueryNode: Equatable, Sendable {
    case and([AdvancedQueryNode])
    case or([AdvancedQueryNode])
    case not(AdvancedQueryNode)

    case surahNumber(range: ClosedRange<Int>)
    case ayahNumber(range: ClosedRange<Int>)
    case surahType(SurahRevelationType)
    case sajdah(required: Bool, isObligatoryOnly: Bool?)
    case wordCount(range: ClosedRange<Int>)
    case letterCount(range: ClosedRange<Int>)
    case surahAyahCount(range: ClosedRange<Int>)
    case termFrequency(count: Int, term: String?)

    case exactPhrase(String)
    case wildcard(pattern: String)
    case partialDiacritics(text: String)
    case wordDerivatives(word: String, rootLevel: Bool)
    case wordProperty(root: String, pos: QuranPartOfSpeech)
    case plainWord(String)
}

public final class AdvancedQuranQueryParser: Sendable {

    public static func parse(_ input: String) -> AdvancedQueryNode? {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "”", with: "\"")
            .replacingOccurrences(of: "“", with: "\"")
            .replacingOccurrences(of: "«", with: "\"")
            .replacingOccurrences(of: "»", with: "\"")
        guard !trimmed.isEmpty else { return nil }

        var lexer = QueryLexer(input: trimmed)
        let tokens = lexer.tokenize()
        guard !tokens.isEmpty else { return nil }

        var parser = QueryParser(tokens: tokens)
        return parser.parseExpression()
    }

    // MARK: - Token Types
    enum Token: Equatable {
        case openParen
        case closeParen
        case andOp
        case orOp
        case notOp
        case range(min: Int, max: Int)
        case field(name: String, value: String)
        case property(root: String, pos: String)
        case phrase(String)
        case wildcard(String)
        case derivative(word: String, rootLevel: Bool)
        case diacriticsWord(String)
        case word(String)
    }

    // MARK: - Lexer
    struct QueryLexer {
        let input: String
        var index: String.Index

        init(input: String) {
            self.input = input
            self.index = input.startIndex
        }

        mutating func tokenize() -> [Token] {
            var tokens: [Token] = []
            skipWhitespace()

            while index < input.endIndex {
                let ch = input[index]

                if ch == "(" {
                    tokens.append(.openParen)
                    index = input.index(after: index)
                } else if ch == ")" {
                    tokens.append(.closeParen)
                    index = input.index(after: index)
                } else if ch == "\"" {
                    tokens.append(readPhrase())
                } else if ch == "{" {
                    tokens.append(readProperty())
                } else if ch == "[" {
                    if let range = readBracketRange() {
                        tokens.append(range)
                    }
                } else {
                    let wordToken = readWordOrField()
                    if let wordToken = wordToken {
                        tokens.append(wordToken)
                    }
                }
                skipWhitespace()
            }
            return tokens
        }

        private mutating func skipWhitespace() {
            while index < input.endIndex && input[index].isWhitespace {
                index = input.index(after: index)
            }
        }

        private mutating func readPhrase() -> Token {
            index = input.index(after: index) // skip opening quote
            var text = ""
            while index < input.endIndex && input[index] != "\"" {
                text.append(input[index])
                index = input.index(after: index)
            }
            if index < input.endIndex && input[index] == "\"" {
                index = input.index(after: index)
            }
            return .phrase(text.trimmingCharacters(in: .whitespaces))
        }

        private mutating func readProperty() -> Token {
            index = input.index(after: index) // skip {
            var text = ""
            while index < input.endIndex && input[index] != "}" {
                text.append(input[index])
                index = input.index(after: index)
            }
            if index < input.endIndex && input[index] == "}" {
                index = input.index(after: index)
            }
            let parts = text.split(whereSeparator: { $0 == "," || $0 == "،" }).map { String($0).trimmingCharacters(in: .whitespaces) }
            if parts.count >= 2 {
                return .property(root: parts[0], pos: parts[1])
            }
            return .word(text)
        }

        private mutating func readBracketRange() -> Token? {
            index = input.index(after: index) // skip [
            var text = ""
            while index < input.endIndex && input[index] != "]" {
                text.append(input[index])
                index = input.index(after: index)
            }
            if index < input.endIndex && input[index] == "]" {
                index = input.index(after: index)
            }
            return parseRange(from: text)
        }

        private func parseRange(from text: String) -> Token? {
            // E.g. "129 الى 200" or "1..5" or "1 to 5"
            let normalized = text.replacingOccurrences(of: "إلى", with: "الى")
                .replacingOccurrences(of: "to", with: "الى")
                .replacingOccurrences(of: "..", with: "الى")
                .replacingOccurrences(of: "-", with: "الى")
            let parts = normalized.split(separator: "الى").map { String($0).trimmingCharacters(in: .whitespaces) }
            if parts.count == 2, let minVal = Int(parts[0]), let maxVal = Int(parts[1]) {
                return .range(min: minVal, max: maxVal)
            }
            return nil
        }

        private mutating func readWordOrField() -> Token? {
            var text = ""
            while index < input.endIndex {
                let ch = input[index]
                if ch.isWhitespace || ch == "(" || ch == ")" || ch == "\"" || ch == "{" || ch == "}" || ch == "[" || ch == "]" {
                    break
                }
                text.append(ch)
                index = input.index(after: index)
            }
            guard !text.isEmpty else { return nil }

            // Check field with colon, e.g. "ك_آ:[129 الى 200]" or "نوع_السورة:مدنية"
            if let colonIdx = text.firstIndex(of: ":") {
                let fieldName = String(text[..<colonIdx]).trimmingCharacters(in: .whitespaces)
                let remaining = String(text[text.index(after: colonIdx)...]).trimmingCharacters(in: .whitespaces)
                if fieldName == "آية_" {
                    return .diacriticsWord(remaining)
                }
                if remaining.isEmpty && index < input.endIndex && input[index] == "[" {
                    if let rangeToken = readBracketRange() {
                        if case let .range(min, max) = rangeToken {
                            return .field(name: fieldName, value: "[\(min) الى \(max)]")
                        }
                    }
                }
                return .field(name: fieldName, value: remaining)
            }

            // Logical keywords
            if text == "و" || text.lowercased() == "and" { return .andOp }
            if text == "أو" || text == "او" || text.lowercased() == "or" { return .orOp }
            if text == "وليس" || text == "ليس" || text.lowercased() == "not" { return .notOp }

            // Wildcards: *word* or *word or word*
            if text.contains("*") {
                let pattern = text.replacingOccurrences(of: "*", with: "")
                return .wildcard(pattern)
            }

            // Derivatives
            if text.hasPrefix("><") {
                return .derivative(word: String(text.dropFirst(2)), rootLevel: true)
            } else if text.hasPrefix(">>") {
                return .derivative(word: String(text.dropFirst(2)), rootLevel: true)
            } else if text.hasPrefix(">") {
                return .derivative(word: String(text.dropFirst(1)), rootLevel: false)
            }

            return .word(text)
        }
    }

    // MARK: - Parser
    struct QueryParser {
        let tokens: [Token]
        var current = 0

        mutating func parseExpression() -> AdvancedQueryNode? {
            return parseOr()
        }

        private mutating func parseOr() -> AdvancedQueryNode? {
            guard var left = parseAnd() else { return nil }

            while match(.orOp) {
                if let right = parseAnd() {
                    if case var .or(children) = left {
                        children.append(right)
                        left = .or(children)
                    } else {
                        left = .or([left, right])
                    }
                }
            }
            return left
        }

        private mutating func parseAnd() -> AdvancedQueryNode? {
            guard var left = parseNot() else { return nil }

            while peek() == .andOp || peek() == .notOp || peekIsImplicitAnd() {
                let isNot = match(.notOp)
                if !isNot && peek() == .andOp { advance() }

                let nextNode = isNot ? parsePrimary().map { AdvancedQueryNode.not($0) } : parseNot()
                if let right = nextNode {
                    if !isNot && isImplicitOr(left: left, right: right) {
                        if case var .or(children) = left {
                            children.append(right)
                            left = .or(children)
                        } else {
                            left = .or([left, right])
                        }
                    } else if case var .and(children) = left {
                        if !isNot, let rRoot = rootFor(node: right),
                           let existingIdx = children.firstIndex(where: { rootFor(node: $0) == rRoot }) {
                            let existing = children[existingIdx]
                            children[existingIdx] = .or([existing, right])
                            left = .and(children)
                        } else {
                            children.append(right)
                            left = .and(children)
                        }
                    } else if !isNot, let rRoot = rootFor(node: right), rootFor(node: left) == rRoot {
                        left = .or([left, right])
                    } else {
                        left = .and([left, right])
                    }
                }
            }
            return left
        }

        private func rootFor(node: AdvancedQueryNode) -> String? {
            switch node {
            case let .plainWord(w):
                let clean = QuranSearchNormalizer.canonical(w)
                return AdvancedQuranMorphology.wordEntries.first(where: { $0.word == clean })?.root
            case let .wordDerivatives(w, _):
                let clean = QuranSearchNormalizer.canonical(w)
                return AdvancedQuranMorphology.wordEntries.first(where: { $0.word == clean })?.root
            default:
                return nil
            }
        }

        private func isImplicitOr(left: AdvancedQueryNode, right: AdvancedQueryNode) -> Bool {
            if isDiacriticNode(left) && isDiacriticNode(right) {
                return true
            }
            if isMuqattaatNode(left) && isMuqattaatNode(right) {
                return true
            }
            return false
        }

        private func isDiacriticNode(_ node: AdvancedQueryNode) -> Bool {
            switch node {
            case .partialDiacritics: return true
            case let .or(children): return children.allSatisfy(isDiacriticNode)
            default: return false
            }
        }

        private func isMuqattaatNode(_ node: AdvancedQueryNode) -> Bool {
            switch node {
            case let .plainWord(w):
                return AdvancedQuranSearchData.muqattaatList.contains(w)
            case let .or(children):
                return children.allSatisfy(isMuqattaatNode)
            default:
                return false
            }
        }

        private mutating func parseNot() -> AdvancedQueryNode? {
            if match(.notOp) {
                if let operand = parsePrimary() {
                    return .not(operand)
                }
            }
            return parsePrimary()
        }

        private mutating func parsePrimary() -> AdvancedQueryNode? {
            guard current < tokens.count else { return nil }
            let token = tokens[current]
            advance()

            switch token {
            case .openParen:
                let expr = parseExpression()
                if match(.closeParen) {
                    return expr
                }
                return expr

            case let .field(name, value):
                return parseFieldNode(name: name, value: value)

            case let .property(root, pos):
                if let parsedPos = QuranPartOfSpeech.from(pos) {
                    return .wordProperty(root: root, pos: parsedPos)
                }
                return .plainWord(root)

            case let .phrase(text):
                return .exactPhrase(text)

            case let .wildcard(pattern):
                return .wildcard(pattern: pattern)

            case let .diacriticsWord(text):
                return .partialDiacritics(text: text)

            case let .derivative(word, rootLevel):
                return .wordDerivatives(word: word, rootLevel: rootLevel)

            case let .word(text):
                return .plainWord(text)

            case let .range(min, max):
                return .ayahNumber(range: min...max)

            default:
                return nil
            }
        }

        private func parseFieldNode(name: String, value: String) -> AdvancedQueryNode? {
            let cleanName = name.trimmingCharacters(in: .whitespaces)
            let cleanVal = value.trimmingCharacters(in: .whitespaces)

            func parseValRange(_ str: String) -> ClosedRange<Int>? {
                if str.hasPrefix("[") && str.hasSuffix("]") {
                    let inner = str.dropFirst().dropLast()
                    let normalized = inner.replacingOccurrences(of: "إلى", with: "الى")
                    let parts = normalized.split(separator: "الى").map { String($0).trimmingCharacters(in: .whitespaces) }
                    if parts.count == 2, let minVal = Int(parts[0]), let maxVal = Int(parts[1]) {
                        return minVal...maxVal
                    }
                }
                if let single = Int(str) {
                    return single...single
                }
                return nil
            }

            switch cleanName {
            case "رقم_السورة", "سورة":
                if let r = parseValRange(cleanVal) {
                    return .surahNumber(range: r)
                }
                // Try finding by surah name
                for (num, meta) in AdvancedQuranSearchData.surahMetadata {
                    if meta.name == cleanVal || cleanVal.contains(meta.name) {
                        return .surahNumber(range: num...num)
                    }
                }
                return nil

            case "رقم_الآية", "آية", "رقم_الاية":
                if let r = parseValRange(cleanVal) {
                    return .ayahNumber(range: r)
                }
                return nil

            case "نوع_السورة":
                if cleanVal.contains("مكي") {
                    return .surahType(.makkiyah)
                } else if cleanVal.contains("مدن") {
                    return .surahType(.madaniyah)
                }
                return nil

            case "سجدة", "سجده":
                let isYes = cleanVal == "نعم" || cleanVal == "yes" || cleanVal == "1"
                return .sajdah(required: isYes, isObligatoryOnly: nil)

            case "نوع_السجدة", "نوع_السجده":
                if cleanVal.contains("واجب") {
                    return .sajdah(required: true, isObligatoryOnly: true)
                } else if cleanVal.contains("مستحب") {
                    return .sajdah(required: true, isObligatoryOnly: false)
                }
                return nil

            case "ك_آ", "كلمات_الآية":
                if let r = parseValRange(cleanVal) {
                    return .wordCount(range: r)
                }
                return nil

            case "ح_آ", "حروف_الآية":
                if let r = parseValRange(cleanVal) {
                    return .letterCount(range: r)
                }
                return nil

            case "آ_س", "ايات_السورة":
                if let r = parseValRange(cleanVal) {
                    return .surahAyahCount(range: r)
                }
                return nil

            case "ج_آ", "تكرار":
                if let count = Int(cleanVal) {
                    return .termFrequency(count: count, term: nil)
                }
                return nil

            default:
                return .plainWord("\(cleanName):\(cleanVal)")
            }
        }

        private func peek() -> Token? {
            guard current < tokens.count else { return nil }
            return tokens[current]
        }

        private func peekIsImplicitAnd() -> Bool {
            guard current < tokens.count else { return false }
            switch tokens[current] {
            case .word, .phrase, .wildcard, .diacriticsWord, .derivative, .property, .field, .openParen:
                return true
            default:
                return false
            }
        }

        private mutating func match(_ expected: Token) -> Bool {
            guard current < tokens.count, tokens[current] == expected else { return false }
            current += 1
            return true
        }

        private mutating func advance() {
            if current < tokens.count { current += 1 }
        }
    }
}
