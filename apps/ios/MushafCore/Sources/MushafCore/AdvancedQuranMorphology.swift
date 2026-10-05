import Foundation

public enum QuranPartOfSpeech: String, Sendable, CaseIterable {
    case noun = "اسم"
    case verb = "فعل"
    case particle = "حرف"

    public static func from(_ text: String) -> QuranPartOfSpeech? {
        let clean = text.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        switch clean {
        case "اسم", "noun", "n": return .noun
        case "فعل", "verb", "v": return .verb
        case "حرف", "particle", "p": return .particle
        default: return nil
        }
    }
}

public enum AdvancedQuranMorphology: Sendable {
    /// Roots map to sets of canonical / normalized words and their part of speech
    public struct WordEntry: Sendable {
        public let word: String
        public let root: String
        public let pos: QuranPartOfSpeech
    }

    /// Curated known roots for Quranic advanced search
    public static let wordEntries: [WordEntry] = [
        // ملك
        WordEntry(word: "ملك", root: "ملك", pos: .noun),
        WordEntry(word: "ملكا", root: "ملك", pos: .noun),
        WordEntry(word: "الملك", root: "ملك", pos: .noun),
        WordEntry(word: "مالك", root: "ملك", pos: .noun),
        WordEntry(word: "مليك", root: "ملك", pos: .noun),
        WordEntry(word: "ملائكه", root: "ملك", pos: .noun),
        WordEntry(word: "الملائكه", root: "ملك", pos: .noun),
        WordEntry(word: "ملكوت", root: "ملك", pos: .noun),
        WordEntry(word: "ملك", root: "ملك", pos: .verb),
        WordEntry(word: "ملكت", root: "ملك", pos: .verb),
        WordEntry(word: "يملك", root: "ملك", pos: .verb),
        WordEntry(word: "يملكون", root: "ملك", pos: .verb),
        WordEntry(word: "تملك", root: "ملك", pos: .verb),
        WordEntry(word: "نملك", root: "ملك", pos: .verb),
        WordEntry(word: "لا يملكون", root: "ملك", pos: .verb),

        // قول
        WordEntry(word: "قول", root: "قول", pos: .noun),
        WordEntry(word: "قولا", root: "قول", pos: .noun),
        WordEntry(word: "القول", root: "قول", pos: .noun),
        WordEntry(word: "اقاويل", root: "قول", pos: .noun),
        WordEntry(word: "قيل", root: "قول", pos: .noun),
        WordEntry(word: "قال", root: "قول", pos: .verb),
        WordEntry(word: "قالوا", root: "قول", pos: .verb),
        WordEntry(word: "يقول", root: "قول", pos: .verb),
        WordEntry(word: "يقولون", root: "قول", pos: .verb),
        WordEntry(word: "قل", root: "قول", pos: .verb),
        WordEntry(word: "قلنا", root: "قول", pos: .verb),
        WordEntry(word: "تقول", root: "قول", pos: .verb),
        WordEntry(word: "يقولوا", root: "قول", pos: .verb),
        WordEntry(word: "تقولون", root: "قول", pos: .verb),

        // سجد
        WordEntry(word: "سجد", root: "سجد", pos: .verb),
        WordEntry(word: "سجدوا", root: "سجد", pos: .verb),
        WordEntry(word: "يسجد", root: "سجد", pos: .verb),
        WordEntry(word: "يسجدون", root: "سجد", pos: .verb),
        WordEntry(word: "تسجدوا", root: "سجد", pos: .verb),
        WordEntry(word: "اسجد", root: "سجد", pos: .verb),
        WordEntry(word: "اسجدوا", root: "سجد", pos: .verb),
        WordEntry(word: "سجدا", root: "سجد", pos: .noun),
        WordEntry(word: "ساجد", root: "سجد", pos: .noun),
        WordEntry(word: "ساجدين", root: "سجد", pos: .noun),
        WordEntry(word: "ساجدون", root: "سجد", pos: .noun),
        WordEntry(word: "سجود", root: "سجد", pos: .noun),
        WordEntry(word: "سجودا", root: "سجد", pos: .noun),
        WordEntry(word: "مسجد", root: "سجد", pos: .noun),
        WordEntry(word: "مساجد", root: "سجد", pos: .noun),
        WordEntry(word: "المساجد", root: "سجد", pos: .noun),
        WordEntry(word: "سجده", root: "سجد", pos: .noun),

        // صبر
        WordEntry(word: "صبر", root: "صبر", pos: .verb),
        WordEntry(word: "صبروا", root: "صبر", pos: .verb),
        WordEntry(word: "يصبر", root: "صبر", pos: .verb),
        WordEntry(word: "اصبر", root: "صبر", pos: .verb),
        WordEntry(word: "اصبروا", root: "صبر", pos: .verb),
        WordEntry(word: "صابرو", root: "صبر", pos: .verb),
        WordEntry(word: "وتواصوا بالصبر", root: "صبر", pos: .noun),
        WordEntry(word: "صبر", root: "صبر", pos: .noun),
        WordEntry(word: "صبرا", root: "صبر", pos: .noun),
        WordEntry(word: "صابرين", root: "صبر", pos: .noun),
        WordEntry(word: "الصابرين", root: "صبر", pos: .noun),
        WordEntry(word: "صابرون", root: "صبر", pos: .noun),
        WordEntry(word: "الصابرون", root: "صبر", pos: .noun),
        WordEntry(word: "صبار", root: "صبر", pos: .noun),

        // صلو
        WordEntry(word: "صلي", root: "صلو", pos: .verb),
        WordEntry(word: "يصلون", root: "صلو", pos: .verb),
        WordEntry(word: "صل", root: "صلو", pos: .verb),
        WordEntry(word: "صلوا", root: "صلو", pos: .verb),
        WordEntry(word: "مصلي", root: "صلو", pos: .noun),
        WordEntry(word: "صلاه", root: "صلو", pos: .noun),
        WordEntry(word: "الصلاه", root: "صلو", pos: .noun),
        WordEntry(word: "صلوات", root: "صلو", pos: .noun),
        WordEntry(word: "الصلوات", root: "صلو", pos: .noun),
        WordEntry(word: "مصلين", root: "صلو", pos: .noun),
        WordEntry(word: "المصلين", root: "صلو", pos: .noun),

        // لعن
        WordEntry(word: "لعن", root: "لعن", pos: .verb),
        WordEntry(word: "لعنهم", root: "لعن", pos: .verb),
        WordEntry(word: "يلعن", root: "لعن", pos: .verb),
        WordEntry(word: "يلعنهم", root: "لعن", pos: .verb),
        WordEntry(word: "لعنا", root: "لعن", pos: .noun),
        WordEntry(word: "لعنه", root: "لعن", pos: .noun),
        WordEntry(word: "اللعنه", root: "لعن", pos: .noun),
        WordEntry(word: "ملعون", root: "لعن", pos: .noun),
        WordEntry(word: "ملعونين", root: "لعن", pos: .noun),
        WordEntry(word: "ملعونه", root: "لعن", pos: .noun),

        // توب
        WordEntry(word: "تاب", root: "توب", pos: .verb),
        WordEntry(word: "يتوب", root: "توب", pos: .verb),
        WordEntry(word: "توبوا", root: "توب", pos: .verb),
        WordEntry(word: "تب", root: "توب", pos: .verb),
        WordEntry(word: "توبه", root: "توب", pos: .noun),
        WordEntry(word: "التوبه", root: "توب", pos: .noun),
        WordEntry(word: "تواب", root: "توب", pos: .noun),
        WordEntry(word: "التواب", root: "توب", pos: .noun),
        WordEntry(word: "تائبين", root: "توب", pos: .noun),
        WordEntry(word: "التائبون", root: "توب", pos: .noun),

        // غفر
        WordEntry(word: "غفر", root: "غفر", pos: .verb),
        WordEntry(word: "يغفر", root: "غفر", pos: .verb),
        WordEntry(word: "اغفر", root: "غفر", pos: .verb),
        WordEntry(word: "استغفر", root: "غفر", pos: .verb),
        WordEntry(word: "يستغفرون", root: "غفر", pos: .verb),
        WordEntry(word: "مغفره", root: "غفر", pos: .noun),
        WordEntry(word: "المغفره", root: "غفر", pos: .noun),
        WordEntry(word: "غفور", root: "غفر", pos: .noun),
        WordEntry(word: "الغفور", root: "غفر", pos: .noun),
        WordEntry(word: "غفار", root: "غفر", pos: .noun),
        WordEntry(word: "الغفار", root: "غفر", pos: .noun),
        WordEntry(word: "غافر", root: "غفر", pos: .noun),
        WordEntry(word: "استغفار", root: "غفر", pos: .noun),

        // زوج
        WordEntry(word: "زوج", root: "زوج", pos: .noun),
        WordEntry(word: "زوجك", root: "زوج", pos: .noun),
        WordEntry(word: "زوجه", root: "زوج", pos: .noun),
        WordEntry(word: "ازواج", root: "زوج", pos: .noun),
        WordEntry(word: "ازواجكم", root: "زوج", pos: .noun),
        WordEntry(word: "ازواجهم", root: "زوج", pos: .noun),
        WordEntry(word: "ازواجا", root: "زوج", pos: .noun),
        WordEntry(word: "زوجناهم", root: "زوج", pos: .verb),
        WordEntry(word: "زوجت", root: "زوج", pos: .verb),

        // حب
        WordEntry(word: "يحب", root: "حب", pos: .verb),
        WordEntry(word: "يحبهم", root: "حب", pos: .verb),
        WordEntry(word: "يحبكم", root: "حب", pos: .verb),
        WordEntry(word: "يحبون", root: "حب", pos: .verb),
        WordEntry(word: "تحبون", root: "حب", pos: .verb),
        WordEntry(word: "احب", root: "حب", pos: .verb),
        WordEntry(word: "حب", root: "حب", pos: .noun),
        WordEntry(word: "حبه", root: "حب", pos: .noun),
        WordEntry(word: "محبه", root: "حب", pos: .noun),

        // خوف
        WordEntry(word: "خوف", root: "خوف", pos: .noun),
        WordEntry(word: "خوفا", root: "خوف", pos: .noun),
        WordEntry(word: "خوفهم", root: "خوف", pos: .noun),
        WordEntry(word: "يخاف", root: "خوف", pos: .verb),
        WordEntry(word: "يخافون", root: "خوف", pos: .verb),
        WordEntry(word: "تخف", root: "خوف", pos: .verb),
        WordEntry(word: "تخافوا", root: "خوف", pos: .verb),
        WordEntry(word: "خافوا", root: "خوف", pos: .verb),

        // حزن
        WordEntry(word: "يحزن", root: "حزن", pos: .verb),
        WordEntry(word: "يحزنون", root: "حزن", pos: .verb),
        WordEntry(word: "يحزنك", root: "حزن", pos: .verb),
        WordEntry(word: "تحزن", root: "حزن", pos: .verb),
        WordEntry(word: "تحزنوا", root: "حزن", pos: .verb),
        WordEntry(word: "حزن", root: "حزن", pos: .noun),
        WordEntry(word: "حزنا", root: "حزن", pos: .noun),

        // موسي
        WordEntry(word: "موسي", root: "موسي", pos: .noun),
        WordEntry(word: "بموسي", root: "موسي", pos: .noun),
        WordEntry(word: "لموسي", root: "موسي", pos: .noun),
        WordEntry(word: "موسى", root: "موسي", pos: .noun),

        // ادم
        WordEntry(word: "ادم", root: "ادم", pos: .noun),
        WordEntry(word: "لادم", root: "ادم", pos: .noun),
        WordEntry(word: "يادم", root: "ادم", pos: .noun),
        WordEntry(word: "ويادم", root: "ادم", pos: .noun),
        WordEntry(word: "اادم", root: "ادم", pos: .noun),
        WordEntry(word: "ءادم", root: "ادم", pos: .noun),
        WordEntry(word: "بني ادم", root: "ادم", pos: .noun),

        // اله
        WordEntry(word: "الله", root: "اله", pos: .noun),
        WordEntry(word: "لله", root: "اله", pos: .noun),
        WordEntry(word: "والله", root: "اله", pos: .noun),
        WordEntry(word: "بالله", root: "اله", pos: .noun),
        WordEntry(word: "تالله", root: "اله", pos: .noun),
        WordEntry(word: "فالله", root: "اله", pos: .noun),
        WordEntry(word: "ابالله", root: "اله", pos: .noun),
        WordEntry(word: "اللهم", root: "اله", pos: .noun),
        WordEntry(word: "اله", root: "اله", pos: .noun),
        WordEntry(word: "الهكم", root: "اله", pos: .noun),
        WordEntry(word: "الهين", root: "اله", pos: .noun),
        WordEntry(word: "الهه", root: "اله", pos: .noun),
        WordEntry(word: "الهتنا", root: "اله", pos: .noun)
    ]

    /// Returns derivatives of a given word or root
    public static func derivatives(for query: String, includeRootLevel: Bool = false) -> [String] {
        let clean = QuranSearchNormalizer.canonical(query).trimmingCharacters(in: .whitespacesAndNewlines)
        var results = Set<String>()
        results.insert(clean)

        // Direct check in word entries
        for entry in wordEntries {
            if entry.root == clean || entry.word == clean {
                results.insert(entry.word)
                if includeRootLevel {
                    results.insert(entry.root)
                }
            }
        }

        // Check if query is in any root's words
        let matchedRoots = Set(wordEntries.filter { $0.word == clean }.map(\.root))
        for r in matchedRoots {
            for entry in wordEntries where entry.root == r {
                results.insert(entry.word)
                if includeRootLevel {
                    results.insert(entry.root)
                }
            }
        }

        // Dynamic prefix/stem variants if not found in static dictionary
        if results.count <= 1 {
            let prefixes = ["و", "ف", "ب", "ك", "ل", "ال", "وال", "فال", "بال", "ول", "فل"]
            for p in prefixes {
                results.insert(p + clean)
                if clean.hasPrefix(p) {
                    let stripped = String(clean.dropFirst(p.count))
                    if stripped.count >= 2 {
                        results.insert(stripped)
                    }
                }
            }
        }

        return Array(results)
    }

    /// Match by root and part of speech: {root, type}
    public static func words(forRoot root: String, pos: QuranPartOfSpeech) -> [String] {
        let cleanRoot = QuranSearchNormalizer.canonical(root).trimmingCharacters(in: .whitespacesAndNewlines)
        let matches = wordEntries.filter { $0.root == cleanRoot && $0.pos == pos }.map(\.word)
        if !matches.isEmpty { return matches }
        // Fallback: return root itself
        return [cleanRoot]
    }
}
