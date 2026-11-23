import MushafCore
import SwiftUI

/// «المقترح اليوم»: finish the range being learned, or review the most overdue surah. Local data only.
struct SuggestionCard: View {
    let suggestion: Suggestion
    let library: MushafLibrary
    let language: AppLanguage
    let openSurah: (Int) -> Void
    let startReview: (Int) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(verbatim: copy("المقترح اليوم", "Suggested today")).font(.subheadline).foregroundStyle(.secondary)
            Text(verbatim: message).font(.headline).accessibilityIdentifier("memo-suggestion-text")
            Button(actionTitle, action: action)
                .buttonStyle(.bordered)
                .accessibilityIdentifier("memo-suggestion-action")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color.secondary.opacity(0.1)))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("memo-suggestion")
    }

    private func name(_ surah: Int) -> String { library.surahNames[surah] ?? "\(surah)" }

    private var message: String {
        switch suggestion {
        case let .continueLearning(surah, remaining):
            let count = MemorizationTheme.number(remaining, language: language)
            return copy("أكمل سورة \(name(surah))، متبقٍ \(count) آيات", "Continue surah \(name(surah)), \(remaining) ayat left")
        case let .review(surah, days):
            if let days {
                return copy("راجع سورة \(name(surah))، آخر مراجعة منذ \(MemorizationTheme.number(days, language: language)) أيام",
                            "Review surah \(name(surah)), last reviewed \(days) days ago")
            }
            return copy("راجع سورة \(name(surah))، لم تتم مراجعتها بعد", "Review surah \(name(surah)), not reviewed yet")
        }
    }

    private var actionTitle: String {
        switch suggestion {
        case .continueLearning: copy("افتح السورة", "Open the surah")
        case .review: copy("ابدأ المراجعة", "Start the review")
        }
    }

    private func action() {
        switch suggestion {
        case let .continueLearning(surah, _): openSurah(surah)
        case let .review(surah, _): startReview(surah)
        }
    }

    private func copy(_ ar: String, _ en: String) -> String { language == .arabic ? ar : en }
}
