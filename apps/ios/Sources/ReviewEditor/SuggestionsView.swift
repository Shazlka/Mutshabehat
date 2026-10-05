#if DEBUG
import MushafCore
import SwiftUI

struct SuggestionsView: View {
    let store: ReviewStore

    var body: some View {
        if store.spanEndKey == nil {
            ForEach(store.suggestions) { suggestion in
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text(suggestion.tier == .exact ? "مطابق" : "نمط")
                            .font(.caption.weight(.bold))
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(suggestion.tier == .exact ? Color.green.opacity(0.15) : Color.orange.opacity(0.15), in: Capsule())
                        Text(suggestion.config.kind == .usul ? "أصول" : "فرش").font(.caption)
                        Spacer()
                        Button("➕ إضافة") { store.addSuggestion(suggestion) }
                            .buttonStyle(.bordered).controlSize(.small)
                            .disabled(SuggestionLogic.isBlocked(suggestion, wordRows: store.rows(forKey: store.selectedKey ?? "")))
                            .accessibilityIdentifier("review-suggestion-add-\(suggestion.key)")
                            .accessibilityHint("إضافة كوجه غير معتمد")
                    }
                    if let category = suggestion.config.categoryNameAr { Text(category).font(.headline) }
                    if let text = suggestion.config.readingText, !text.isEmpty { Text(text).font(.title3) }
                    if let text = suggestion.config.rulingText, !text.isEmpty { Text(text).font(.footnote) }
                    NarratorChipsView(items: NarratorDisplay.describe(suggestion.config.narrators.map { NarratorRef(id: $0.id, nameAr: $0.nameAr) }))
                    if suggestion.config.appliesWasl == false || suggestion.config.appliesWaqf == false {
                        Text(suggestion.config.appliesWasl == false ? "وقفًا فقط" : "وصلًا فقط").font(.caption)
                    }
                    Text(evidence(suggestion)).font(.caption).foregroundStyle(.secondary)
                }
                .padding(.vertical, 4)
                .accessibilityElement(children: .contain)
                .accessibilityIdentifier("review-suggestion-\(suggestion.key)")
            }
        }
    }

    private func evidence(_ s: ReviewSuggestion) -> String {
        let whereText = s.sources.isEmpty ? "" : " (مثل \(s.sources.joined(separator: "، ")))"
        if s.tier == .exact {
            return "الكلمة نفسها — اعتُمد \(s.support) \(s.support == 1 ? "مرة" : "مرات")\(whereText)"
        }
        return "كلمات تنتهي بـ «…\(s.shape ?? "")» — \(s.support) من \(s.shapeTotal ?? s.support) موضعًا معتمدًا\(whereText)"
    }
}
#endif
