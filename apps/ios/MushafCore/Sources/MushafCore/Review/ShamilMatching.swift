import Foundation

/// Port of `shamilReference.ts`: which «الشامل» entries are about the clicked word, the groups of an entry
/// and the suggested kind and باب for a wajh. Display-only, like the web.
public enum ShamilMatching {
    /// الشامل narrator keys → this app's narrator ids.
    public static let narratorIds: [String: String] = [
        "qalun": "Q01-R01", "warsh": "Q01-R02", "bazzi": "Q02-R01", "qunbul": "Q02-R02",
        "duri_abuamr": "Q03-R01", "susi": "Q03-R02", "hisham": "Q04-R01", "ibn_dhakwan": "Q04-R02",
        "shubah": "Q05-R01", "hafs": "Q05-R02", "khalaf_hamzah": "Q06-R01", "khallad": "Q06-R02",
        "abulharith": "Q07-R01", "duri_kisai": "Q07-R02", "ibn_wardan": "Q08-R01", "ibn_jammaz": "Q08-R02",
        "ruways": "Q09-R01", "rawh": "Q09-R02", "ishaq": "Q10-R01", "idris": "Q10-R02",
    ]

    /// `normalizeArabic` plus dropping the hamza letter: الشامل writes «ءَاخِرَة» where the Mushaf writes «ـَٔاخِرَة».
    public static func matchKey(_ text: String) -> String { Arabic.removing(Arabic.normalize(text), [0x0621]) }

    /// Does `phrase` cover the clicked word: contiguous in this ayah, or straddling an ayah boundary the entry
    /// lists (head closes this ayah and the next is listed, or tail opens it and the previous is listed).
    static func phraseCoversWord(_ phrase: [String], keys: [String], wordIndex: Int,
                                 previousListed: Bool, nextListed: Bool) -> Bool {
        let at = wordIndex - 1
        var start = 0
        while start + phrase.count <= keys.count {
            defer { start += 1 }
            if at < start || at >= start + phrase.count { continue }
            if phrase.enumerated().allSatisfy({ keys[start + $0.offset] == $0.element }) { return true }
        }
        if phrase.count > 1 {
            for split in 1..<phrase.count {
                if nextListed {
                    let head = Array(phrase[..<split])
                    let from = keys.count - head.count
                    if from >= 0 && at >= from && head.enumerated().allSatisfy({ keys[from + $0.offset] == $0.element }) { return true }
                }
                if previousListed {
                    let tail = Array(phrase[split...])
                    if at < tail.count && tail.enumerated().allSatisfy({ keys[$0.offset] == $0.element }) { return true }
                }
            }
        }
        return false
    }

    /// Indices (into `entries`) of the entries about the clicked word. The ayah must be one the entry lists
    /// and one of its words must match by whole tokens; with the ayah's words a phrase must also occur
    /// contiguously around the clicked word. Without them it falls back to token equality.
    public static func matchingIndices(entries: [ShamilEntry], ayah: Int, wordText: String,
                                       context: NquranAyahContext?) -> [Int] {
        let wanted = matchKey(wordText)
        guard !wanted.isEmpty else { return [] }
        let complete = context.flatMap { $0.isComplete ? $0 : nil }
        let keys = complete?.ayahWords.map { matchKey($0.text) }
        return entries.indices.filter { index in
            let entry = entries[index]
            guard entry.ayahs.contains(ayah) else { return false }
            return entry.words.contains { word in
                let tokens = Arabic.words(matchKey(word))
                if let keys, let complete {
                    return keys[complete.wordIndex - 1] == wanted
                        && phraseCoversWord(tokens, keys: keys, wordIndex: complete.wordIndex,
                                            previousListed: entry.ayahs.contains(ayah - 1),
                                            nextListed: entry.ayahs.contains(ayah + 1))
                }
                return tokens.contains(wanted)
            }
        }
    }

    // MARK: Groups and suggestions

    /// The wasl/waqf condition is a flag in the data, but the saved «الأداء» text should say it too.
    public static func performanceText(description: String, condition: ReferenceCondition) -> String {
        if condition == .both { return description }
        let normalized = Arabic.normalize(description)
        if normalized.contains("وقف") || normalized.contains("وصل") { return description }
        return condition == .waqf ? "\(description) وقفًا" : "\(description) وصلاً"
    }

    private static let directCategory: [String: String] = [
        "التقليل والإمالة": "IMALAH_TAQLIL", "الإبدال": "USUL_IBDAL", "إدغام بلا غنة": "TARK_GHUNNA",
        "صلة الهاء": "SILAT_HA", "الترقيق": "TARQIQ_RA", "التغليظ": "TAGHLIZ_LAM",
    ]

    private static func n(_ text: String) -> String { Arabic.normalize(text) }

    /// First match wins; every test runs on `normalize(description)`.
    private static let mixedBucketRules: [(test: @Sendable (String) -> Bool, code: String)] = [
        ({ $0.hasPrefix(n("وقفًا")) }, "WAQF_HAMZA"),
        ({ $0.contains(n("ترقيق الراء")) }, "TARQIQ_RA"),
        ({ $0.contains(n("البدل")) }, "MADD_BADAL"),
        ({ $0.contains(n("ميم")) }, "USUL_MIM_JAM"),
        ({ $0.contains(n("السكت")) }, "USUL_SAKT"),
        ({ d in
            ["المد المتصل", "المد المنفصل", "بين الشين والهمزة", "مراتبهم"].contains { d.contains(n($0)) }
                || ["القصر", "التوسط", "الإشباع", "المد", "فويق"].contains { d.hasPrefix(n($0)) }
        }, "USUL_MADD"),
        ({ $0.contains(n("التنوين")) }, "IKHFA"),
        ({ d in ["تسهيل الهمزة", "حذف الهمزة", "تحقيق الهمزة"].contains { d.hasPrefix(n($0)) } }, "TAGHYIR_HAMZ"),
    ]

    /// Suggested kind and باب for a wajh; the code is only a suggestion and is nil rather than guessed.
    public static func suggestCategory(type: ReadingKind, category: String, description: String) -> ReferenceSuggestion {
        if type == .farsh { return ReferenceSuggestion(kind: .farsh, categoryCode: nil) }
        if let direct = directCategory[category] { return ReferenceSuggestion(kind: .usul, categoryCode: direct) }
        let d = n(description)
        func usul(_ code: String?) -> ReferenceSuggestion { ReferenceSuggestion(kind: .usul, categoryCode: code) }
        if category == "النقل والسكت" {
            if d.contains(n("سكت")) { return usul("USUL_SAKT") }
            if d.contains(n("نقل")) { return usul("USUL_NAQL") }
            if d.contains(n("تحقيق")) { return usul("USUL_TAHQIQ") }
            return usul(nil)
        }
        if category == "إدغام صغير/كبير" {
            if d.contains(n("الكبير")) { return usul("IDGHAM_KABIR") }
            if d.range(of: "الذال (عند|في) التاء", options: .regularExpression) != nil { return usul("IDGHAM_SAGHIR") }
            return usul(nil)
        }
        if category == "الأصول/فرش" {
            return usul(mixedBucketRules.first { $0.test(d) }?.code)
        }
        return usul(nil)
    }

    /// One group per wajh, ready for the shared reference panel.
    public static func groups(for entry: ShamilEntry) -> [ReferenceGroup] {
        if let difference = entry.sourceDifference { return NquranMatching.groups(for: difference) }
        return entry.wajhs.map { wajh in
            let ids = wajh.narrators.compactMap { narratorIds[$0] }
            let refs = ids.map { NarratorRef(id: $0, nameAr: CanonicalReaders.narratorName($0) ?? $0) }
            return ReferenceGroup(
                key: wajh.id, readersLabel: NarratorDisplay.text(refs), narratorIds: ids,
                performanceText: performanceText(description: wajh.description, condition: wajh.condition),
                readingText: wajh.readingText, condition: wajh.condition, conditionBasis: wajh.conditionBasis,
                suggestion: suggestCategory(type: wajh.type, category: wajh.category, description: wajh.description))
        }
    }
}
