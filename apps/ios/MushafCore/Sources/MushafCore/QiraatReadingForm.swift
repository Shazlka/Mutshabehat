import Foundation

/// How a word is written when it is read with a given أصول rule, for the «تُقرأ هكذا» line of a ruling card:
/// صلة ميم الجمع adds the small waw after the meem («كَأَنَّهُمُۥ»), and نقل حركة الهمزة drops the hamza and gives its
/// vowel to the letter before it («وَٱلْأَرْضِ» → «وَٱلَرْضِ»). Pure text; nothing is guessed: a word the rule does not
/// change returns nil.
public enum QiraatReadingForm {
    private static let sukun: Set<UInt32> = [0x0652, 0x06E1]
    private static let shortVowels: Set<UInt32> = [0x064B, 0x064C, 0x064D, 0x064E, 0x064F, 0x0650]
    private static let hamzaLetters: Set<UInt32> = [0x0621, 0x0623, 0x0624, 0x0625, 0x0626]
    private static let smallHamza: Set<UInt32> = [0x0654, 0x0655]
    private static let tatweel: UInt32 = 0x0640
    private static let smallWaw: UInt32 = 0x06E5
    private static let damma: UInt32 = 0x064F
    private static let meem: UInt32 = 0x0645
    /// The small high rounded zero marks a silent letter; the page font draws it as a large dotted circle that cuts
    /// the word in two, so the card's word is shown without it.
    private static let roundedZero: UInt32 = 0x06DF

    private static func isMark(_ s: UInt32) -> Bool {
        (0x064B...0x065F).contains(s) || s == 0x0670 || (0x06D6...0x06ED).contains(s) && s != smallWaw && s != 0x06E6
    }

    /// The word as the card draws it: the text without the rounded-zero mark.
    public static func display(_ text: String) -> String {
        String(String.UnicodeScalarView(text.unicodeScalars.filter { $0.value != roundedZero }))
    }

    /// The word as read for one narrator group's action, or nil when the action does not change the writing.
    /// `previousWord` / `nextWord` are the Mushaf words around the ruling's span (same ayah or across the ayah end):
    /// نقل حركة الهمزة happens across a word boundary (مِنْ + آمَنَ → مِنَ امَنَ), so the two words are drawn together.
    public static func form(baseText: String, action: String, categoryCode: String,
                            previousWord: String? = nil, nextWord: String? = nil) -> String? {
        let clean = display(baseText)
        let result: String?
        if appliesSilat(action) { result = withSilat(clean) }
        else if appliesNaql(action, categoryCode: categoryCode) {
            result = withNaql(clean) ?? withNaqlAcross(clean, previous: previousWord.map(display), next: nextWord.map(display))
        } else { result = nil }
        guard let result, result != clean else { return nil }
        return result
    }

    // MARK: Which action does what

    private static func normalized(_ s: String) -> String {
        String(String.UnicodeScalarView(s.unicodeScalars.filter { !(0x064B...0x065F).contains($0.value) && $0.value != 0x0670 && $0.value != tatweel }))
            .replacingOccurrences(of: "أ", with: "ا").replacingOccurrences(of: "إ", with: "ا")
            .replacingOccurrences(of: "ة", with: "ه")
    }

    static func appliesSilat(_ action: String) -> Bool {
        let n = normalized(action)
        return n.contains("صله ميم الجمع") || n.contains("ضم ميم الجمع") || n.contains("وصلها بواو")
    }

    /// Naql counts only when it is how the word is read while continuing (before any «ووقف …» part).
    static func appliesNaql(_ action: String, categoryCode: String) -> Bool {
        let n = normalized(action)
        let continuing = n.components(separatedBy: "وقف").first ?? n
        guard continuing.contains("النقل") || continuing.contains("نقل حركه") || categoryCode == "USUL_NAQL" && continuing.contains("نقل") else { return false }
        return !continuing.contains("ترك النقل") && !continuing.contains("بلا نقل")
    }

    // MARK: Transformations

    /// The meem at the end of the first word that ends in one: sukun → damma, a damma stays, no vowel → damma; then the small waw.
    static func withSilat(_ text: String) -> String? {
        var scalars = Array(text.unicodeScalars)
        var i = 0
        while i < scalars.count {
            var end = i
            while end < scalars.count, scalars[end].value != 0x20 { end += 1 }
            // walk back over marks (and the pause sign) to the last base letter of the word
            var j = end - 1
            while j >= i, isMark(scalars[j].value) || scalars[j].value == 0x06DA { j -= 1 }
            if j >= i, scalars[j].value == meem {
                let marks = scalars[(j + 1)..<end].map(\.value)
                if marks.contains(where: { $0 == 0x0650 || $0 == 0x064E }) { i = end + 1; continue } // kasra / fatha: not this rule
                if let s = (j + 1..<end).first(where: { sukun.contains(scalars[$0].value) }) {
                    scalars[s] = Unicode.Scalar(damma)!
                    scalars.insert(Unicode.Scalar(smallWaw)!, at: s + 1)
                } else if let d = (j + 1..<end).first(where: { scalars[$0].value == damma }) {
                    scalars.insert(Unicode.Scalar(smallWaw)!, at: d + 1)
                } else {
                    scalars.insert(contentsOf: [Unicode.Scalar(damma)!, Unicode.Scalar(smallWaw)!], at: j + 1)
                }
                return String(String.UnicodeScalarView(scalars))
            }
            i = end + 1
        }
        return nil
    }

    /// Hamza after a letter that carries a sukun, inside one word → the hamza goes, its vowel moves to that letter.
    static func withNaql(_ text: String) -> String? {
        var s = Array(text.unicodeScalars)
        var i = 1
        while i < s.count {
            let v = s[i].value
            let isLetterHamza = hamzaLetters.contains(v)
            let isTatweelHamza = smallHamza.contains(v)
            guard isLetterHamza || isTatweelHamza else { i += 1; continue }
            // carrier: for a small hamza the tatweel/letter it sits on, for a hamza letter the letter itself
            var carrier = i
            if isTatweelHamza {
                var k = i - 1
                while k > 0, isMark(s[k].value) { k -= 1 }
                carrier = k
            }
            // the previous base letter (marks skipped), in the same word, carrying a sukun
            var p = carrier - 1
            var sukunAt: Int?
            while p >= 0, isMark(s[p].value) { if sukun.contains(s[p].value) { sukunAt = p }; p -= 1 }
            guard p >= 0, s[p].value != 0x20, let sk = sukunAt else { i += 1; continue }
            // the hamza's vowel: a short vowel on the carrier or after the hamza letter
            var vowel: UInt32?
            var q = carrier + 1
            while q < s.count, isMark(s[q].value) || smallHamza.contains(s[q].value) {
                if shortVowels.contains(s[q].value), vowel == nil { vowel = s[q].value }
                q += 1
            }
            guard let moved = vowel else { i += 1; continue }
            // drop carrier + its marks (up to the next base letter), replace the sukun by the vowel
            s.removeSubrange(carrier..<q)
            s[sk] = Unicode.Scalar(moved)!
            return String(String.UnicodeScalarView(s))
        }
        return nil
    }

    /// A word's first letter is a hamza that carries a short vowel; returns that vowel and the word without hamza and vowel.
    private static func splitInitialHamza(_ word: String) -> (vowel: UInt32, rest: String)? {
        let s = Array(word.unicodeScalars)
        var i = 0
        while i < s.count, s[i].value == 0x0671 { i += 1 } // alef wasla does not start a hamza word
        guard i == 0, i < s.count, hamzaLetters.contains(s[i].value) || s[i].value == 0x0622 else { return nil }
        var vowel: UInt32?
        var q = i + 1
        while q < s.count, isMark(s[q].value) {
            if shortVowels.contains(s[q].value), vowel == nil, ![0x064B, 0x064C, 0x064D].contains(s[q].value) { vowel = s[q].value }
            q += 1
        }
        if s[i].value == 0x0622 { // آ = hamza with fatha + alef
            var rest = Array(s[(i + 1)...]); rest.insert(Unicode.Scalar(0x0627)!, at: 0)
            return (0x064E, String(String.UnicodeScalarView(rest)))
        }
        guard let v = vowel else { return nil }
        return (v, String(String.UnicodeScalarView(Array(s[q...]))))
    }

    /// The word ends in a letter carrying a sukun: returns it with that sukun replaced by `vowel`.
    private static func giveVowel(_ word: String, _ vowel: UInt32) -> String? {
        var s = Array(word.unicodeScalars)
        var p = s.count - 1
        var sukunAt: Int?
        while p >= 0, isMark(s[p].value) || s[p].value == 0x06DA { if sukun.contains(s[p].value) { sukunAt = p }; p -= 1 }
        guard p >= 0, let sk = sukunAt else { return nil }
        s[sk] = Unicode.Scalar(vowel)!
        return String(String.UnicodeScalarView(s))
    }

    /// Hamza word next to a word whose last letter is at rest: the hamza goes, its vowel moves to that letter.
    /// Tries (this word, next word), then (previous word, this word); returns the two words as read.
    static func withNaqlAcross(_ text: String, previous: String?, next: String?) -> String? {
        let words = text.split(separator: " ").map(String.init)
        // the span itself holds two words
        if words.count >= 2 {
            for k in 0..<(words.count - 1) {
                if let h = splitInitialHamza(words[k + 1]), let moved = giveVowel(words[k], h.vowel) {
                    var out = words; out[k] = moved; out[k + 1] = h.rest
                    return out.joined(separator: " ")
                }
            }
        }
        guard let last = words.last, let first = words.first else { return nil }
        if let next, let h = splitInitialHamza(next), let moved = giveVowel(last, h.vowel) {
            return (words.dropLast() + [moved, h.rest]).joined(separator: " ")
        }
        if let previous, let h = splitInitialHamza(first), let moved = giveVowel(previous, h.vowel) {
            return ([moved, h.rest] + words.dropFirst()).joined(separator: " ")
        }
        return nil
    }
}
