#if DEBUG
/// The suggestion card's rules, shared with the web review editor.
public enum SuggestionLogic {
    public static func isBlocked(_ s: ReviewSuggestion, wordRows: [ReviewRow]) -> Bool {
        guard s.config.kind == .farsh else { return false }
        let occupied = Set(wordRows.filter { !$0.deleted && $0.kind == .farsh }.flatMap { $0.narrators.map(\.id) })
        return s.config.narrators.contains { occupied.contains($0.id) }
    }

    public static func createInput(for s: ReviewSuggestion, surah: Int, ayah: Int, startWord: Int) -> CreateEntryInput {
        let c = s.config
        return CreateEntryInput(surah: surah, ayah: ayah, startWord: startWord, kind: c.kind,
            readingText: c.readingText, uthmaniText: c.uthmaniText, description: c.description,
            performanceNote: c.performanceNote, variantType: c.variantType, categoryCode: c.categoryCode,
            rulingText: c.rulingText,
            narrators: c.narrators.map { NarratorInput(id: $0.id, action: $0.action, wajhOrder: $0.wajhOrder, wajhNote: $0.wajhNote) },
            appliesWasl: c.appliesWasl, appliesWaqf: c.appliesWaqf, hamzahDetail: c.hamzahDetail)
    }
}

public enum SameWordLogic {
    /// The server returns reviewed matches. Like the web, this only narrows kind and category; it does
    /// not reinterpret verificationStatus or reviewStatus on the returned configurations.
    public static func verifiedSameCategory(matches: [ReviewRow], for row: ReviewRow?) -> [ReviewRow] {
        matches.filter { match in
            if let row, match.kind != row.kind { return false }
            if match.kind == .usul, let category = row?.categoryCode, !category.isEmpty,
               match.categoryCode != category { return false }
            return true
        }
    }
}
#endif
