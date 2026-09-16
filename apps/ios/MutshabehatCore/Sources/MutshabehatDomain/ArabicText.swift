import Foundation

public enum ArabicText {
    public static func stripTashkeel(_ value: String) -> String {
        String(value.unicodeScalars.filter { !isTashkeel($0) })
    }

    public static func normalizeArabic(_ value: String) -> String {
        let normalized = normalizeArabicWithMap(value).norm
        let trimSet = CharacterSet.whitespacesAndNewlines.union(
            CharacterSet(charactersIn: "\u{FEFF}")
        )
        return normalized.trimmingCharacters(in: trimSet)
    }

    public static func rasmSkeleton(_ value: String) -> String {
        String(normalizeArabic(value).unicodeScalars.filter { $0.value != 0x0627 })
    }

    public static func normalizeArabicWithMap(_ value: String) -> (norm: String, map: [Int]) {
        var normalized = String.UnicodeScalarView()
        var map: [Int] = []

        for (offset, scalar) in value.unicodeScalars.enumerated() {
            guard let output = normalizedScalar(scalar) else { continue }
            normalized.append(output)
            map.append(offset)
        }

        return (String(normalized), map)
    }

    public static func matchRanges(text: String, query: String) -> [Range<String.Index>] {
        let mapped = normalizeArabicWithMap(text)
        let normalizedScalars = Array(mapped.norm.unicodeScalars)
        guard !normalizedScalars.isEmpty else { return [] }

        let normalizedQuery = Array(normalizeArabic(query).unicodeScalars)
        if !normalizedQuery.isEmpty {
            let matches = matchingOffsets(of: normalizedQuery, in: normalizedScalars)
            if !matches.isEmpty {
                return matches.map {
                    originalRange(
                        normalizedStart: $0,
                        normalizedEnd: $0 + normalizedQuery.count,
                        map: mapped.map,
                        text: text
                    )
                }
            }
        }

        let querySkeleton = Array(rasmSkeleton(query).unicodeScalars)
        guard querySkeleton.count >= 3 else { return [] }

        var skeleton: [Unicode.Scalar] = []
        var skeletonToNormalized: [Int] = []
        for (index, scalar) in normalizedScalars.enumerated() where scalar.value != 0x0627 {
            skeleton.append(scalar)
            skeletonToNormalized.append(index)
        }

        return matchingOffsets(of: querySkeleton, in: skeleton).map { matchStart in
            var normalizedStart = skeletonToNormalized[matchStart]
            while normalizedStart > 0, normalizedScalars[normalizedStart - 1].value == 0x0627 {
                normalizedStart -= 1
            }

            let skeletonEnd = matchStart + querySkeleton.count
            let normalizedEnd = skeletonEnd < skeletonToNormalized.count
                ? skeletonToNormalized[skeletonEnd]
                : normalizedScalars.count
            return originalRange(
                normalizedStart: normalizedStart,
                normalizedEnd: normalizedEnd,
                map: mapped.map,
                text: text
            )
        }
    }

    public static func ayahToInt(_ value: String) -> Int {
        let westernScalars = value.unicodeScalars.map { scalar -> Unicode.Scalar in
            if (0x0660...0x0669).contains(scalar.value) {
                return Unicode.Scalar(0x0030 + scalar.value - 0x0660)!
            }
            return scalar
        }

        var index = westernScalars.startIndex
        while index < westernScalars.endIndex,
              CharacterSet.whitespacesAndNewlines.contains(westernScalars[index]) {
            index += 1
        }

        var parsed = ""
        if index < westernScalars.endIndex,
           westernScalars[index].value == 0x002B || westernScalars[index].value == 0x002D {
            parsed.unicodeScalars.append(westernScalars[index])
            index += 1
        }

        let digitStart = parsed.count
        while index < westernScalars.endIndex,
              (0x0030...0x0039).contains(westernScalars[index].value) {
            parsed.unicodeScalars.append(westernScalars[index])
            index += 1
        }

        guard parsed.count > digitStart, let result = Int(parsed) else { return 1 }
        return result
    }

    public static func ayahToInt(_ value: Int) -> Int {
        value
    }

    public static func ayahToArabic(_ value: Int) -> String {
        var result = String.UnicodeScalarView()
        for scalar in String(value).unicodeScalars {
            if (0x0030...0x0039).contains(scalar.value) {
                result.append(Unicode.Scalar(0x0660 + scalar.value - 0x0030)!)
            } else {
                result.append(scalar)
            }
        }
        return String(result)
    }

    private static func normalizedScalar(_ scalar: Unicode.Scalar) -> Unicode.Scalar? {
        switch scalar.value {
        case 0x0670:
            return Unicode.Scalar(0x0627)!
        case _ where isTashkeel(scalar):
            return nil
        case 0x0625, 0x0623, 0x0622, 0x0627, 0x0671:
            return Unicode.Scalar(0x0627)!
        case 0x0649:
            return Unicode.Scalar(0x064A)!
        case 0x0629:
            return Unicode.Scalar(0x0647)!
        case 0x0624:
            return Unicode.Scalar(0x0648)!
        case 0x0626:
            return Unicode.Scalar(0x064A)!
        case 0x0640:
            return nil
        default:
            return scalar
        }
    }

    private static func isTashkeel(_ scalar: Unicode.Scalar) -> Bool {
        switch scalar.value {
        case 0x064B...0x065F,
             0x0670,
             0x06D6...0x06ED,
             0x08E0...0x08FE,
             0x200B...0x200F:
            return true
        default:
            return false
        }
    }

    private static func matchingOffsets(
        of needle: [Unicode.Scalar],
        in haystack: [Unicode.Scalar]
    ) -> [Int] {
        guard !needle.isEmpty, needle.count <= haystack.count else { return [] }
        var matches: [Int] = []
        var offset = 0

        while offset + needle.count <= haystack.count {
            if haystack[offset..<(offset + needle.count)].elementsEqual(needle) {
                matches.append(offset)
                offset += needle.count
            } else {
                offset += 1
            }
        }
        return matches
    }

    private static func originalRange(
        normalizedStart: Int,
        normalizedEnd: Int,
        map: [Int],
        text: String
    ) -> Range<String.Index> {
        let startOffset = map[normalizedStart]
        let endOffset = normalizedEnd < map.count
            ? map[normalizedEnd]
            : text.unicodeScalars.count
        let scalars = text.unicodeScalars
        let start = scalars.index(scalars.startIndex, offsetBy: startOffset)
        let end = scalars.index(scalars.startIndex, offsetBy: endOffset)
        return start..<end
    }
}
