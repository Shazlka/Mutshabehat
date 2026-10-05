import Foundation

public enum ArabicDiffAlgorithm {
    public static func stripTashkeel(_ s: String) -> String {
        s.replacingOccurrences(of: "ٰ", with: "ا")
            .unicodeScalars.compactMap { scalar -> String? in
                if (0x064B...0x065F).contains(scalar.value) ||
                   (0x06D6...0x06ED).contains(scalar.value) ||
                   scalar.value == 0x0640 {
                    return nil
                }
                return String(scalar)
            }.joined()
    }

    public static func normalizeArabic(_ s: String) -> String {
        stripTashkeel(s).unicodeScalars.map { scalar -> String in
            switch scalar.value {
            case 0x0621, 0x0622, 0x0623, 0x0625, 0x0671: return "ا"
            case 0x0649: return "ي"
            case 0x0629: return "ه"
            case 0x0624: return "و"
            case 0x0626: return "ي"
            default: return String(scalar)
            }
        }.joined().trimmingCharacters(in: .whitespacesAndNewlines)
    }

    public enum WordStatus: Sendable, Equatable {
        case same
        case added
        case removed
        case changed(oldWord: String)
    }

    public struct WordToken: Sendable {
        public let word: String
        public let status: WordStatus
    }

    public static func levenshtein(_ a: String, _ b: String, cap: Int = 4) -> Int {
        if abs(a.count - b.count) > cap { return Int.max }
        let aChars = Array(a)
        let bChars = Array(b)
        let m = aChars.count
        let n = bChars.count
        if m == 0 { return n }
        if n == 0 { return m }
        var prev = [Int](0...n)
        var curr = [Int](repeating: 0, count: n + 1)

        for i in 1...m {
            curr[0] = i
            for j in 1...n {
                let cost = aChars[i - 1] == bChars[j - 1] ? 0 : 1
                curr[j] = min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
            }
            prev = curr
        }
        return prev[n]
    }

    public static func computeWordDiff(textA: String, textB: String) -> [WordToken] {
        let wordsA = textA.split(whereSeparator: \.isWhitespace).map(String.init)
        let wordsB = textB.split(whereSeparator: \.isWhitespace).map(String.init)
        let normA = wordsA.map { normalizeArabic($0) }
        let normB = wordsB.map { normalizeArabic($0) }

        let m = normA.count
        let n = normB.count

        var dp = [[Int]](repeating: [Int](repeating: 0, count: n + 1), count: m + 1)
        for i in 1...max(1, m) {
            if m == 0 { break }
            for j in 1...max(1, n) {
                if n == 0 { break }
                if normA[i - 1] == normB[j - 1] {
                    dp[i][j] = dp[i - 1][j - 1] + 1
                } else {
                    dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
                }
            }
        }

        enum Op {
            case same(idxA: Int, idxB: Int)
            case added(idxB: Int)
            case removed(idxA: Int)
        }
        var ops: [Op] = []
        var i = m, j = n
        while i > 0 || j > 0 {
            if i > 0 && j > 0 && normA[i - 1] == normB[j - 1] {
                ops.append(.same(idxA: i - 1, idxB: j - 1))
                i -= 1
                j -= 1
            } else if j > 0 && (i == 0 || dp[i][j - 1] >= dp[i - 1][j]) {
                ops.append(.added(idxB: j - 1))
                j -= 1
            } else if i > 0 {
                ops.append(.removed(idxA: i - 1))
                i -= 1
            } else {
                break
            }
        }
        ops.reverse()

        var raw: [WordToken] = []
        for op in ops {
            switch op {
            case let .same(idxA, _):
                raw.append(WordToken(word: wordsA[idxA], status: .same))
            case let .removed(idxA):
                raw.append(WordToken(word: wordsA[idxA], status: .removed))
            case let .added(idxB):
                raw.append(WordToken(word: wordsB[idxB], status: .added))
            }
        }

        // Merge adjacent removed + added pairs into 'changed' if Levenshtein <= 3
        var out: [WordToken] = []
        var k = 0
        while k < raw.count {
            let cur = raw[k]
            let next = (k + 1 < raw.count) ? raw[k + 1] : nil
            if case .removed = cur.status, let next = next, case .added = next.status,
               levenshtein(normalizeArabic(cur.word), normalizeArabic(next.word)) <= 3 {
                out.append(WordToken(word: next.word, status: .changed(oldWord: cur.word)))
                k += 2
            } else {
                out.append(cur)
                k += 1
            }
        }
        return out
    }

    public static func autoColorPair(textA: String, textB: String) -> (partsA: [PersonalPart], partsB: [PersonalPart]) {
        let tokens = computeWordDiff(textA: textA, textB: textB)
        var partsA: [PersonalPart] = []
        var partsB: [PersonalPart] = []

        for t in tokens {
            switch t.status {
            case .same:
                partsA.append(PersonalPart(id: UUID().uuidString, type: "shared", text: t.word, sortOrder: 0))
                partsB.append(PersonalPart(id: UUID().uuidString, type: "shared", text: t.word, sortOrder: 0))
            case .removed:
                partsA.append(PersonalPart(id: UUID().uuidString, type: "unique", text: t.word, sortOrder: 0))
            case .added:
                partsB.append(PersonalPart(id: UUID().uuidString, type: "addition", text: t.word, sortOrder: 0))
            case let .changed(oldWord):
                partsA.append(PersonalPart(id: UUID().uuidString, type: "diff", text: oldWord, sortOrder: 0))
                partsB.append(PersonalPart(id: UUID().uuidString, type: "diff", text: t.word, sortOrder: 0))
            }
        }

        return (mergeAdjacent(partsA), mergeAdjacent(partsB))
    }

    private static func mergeAdjacent(_ parts: [PersonalPart]) -> [PersonalPart] {
        var out: [PersonalPart] = []
        for p in parts {
            if let last = out.last, last.type == p.type {
                let mergedText = (last.text + " " + p.text).trimmingCharacters(in: .whitespaces)
                out[out.count - 1] = PersonalPart(id: last.id, type: last.type, text: mergedText, sortOrder: last.sortOrder)
            } else {
                out.append(PersonalPart(id: p.id, type: p.type, text: p.text, sortOrder: out.count))
            }
        }
        return out
    }
}
