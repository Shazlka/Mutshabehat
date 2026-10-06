import MushafCore
import SwiftUI

/// Rate how a recitation from memory went. A review never changes the memorization status; it only schedules
/// the next review and updates the review strength.
struct ReviewView: View {
    let selection: MemorizationSelection
    let title: String
    let store: MemorizationStore
    let language: AppLanguage
    let onFinished: (MemorizationStore.ApplyResult, BatchPlan) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var errorMessage: String?

    private var reviewableCount: Int {
        store.reviewPlan(selection, label: title, result: .good).changes.count
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text(verbatim: title).font(.headline)
                    let count = reviewableCount
                    if count == 0 {
                        Text(verbatim: copy("لا توجد آيات محفوظة في هذا النطاق", "No memorized ayat in this range"))
                            .foregroundStyle(.secondary)
                            .accessibilityIdentifier("memo-review-empty")
                    } else {
                        Text(verbatim: copy("\(MemorizationTheme.number(count, language: language)) آية للمراجعة",
                                            "\(count) ayat to review"))
                            .foregroundStyle(.secondary)
                            .accessibilityIdentifier("memo-review-count")
                    }
                }
                if reviewableCount > 0 {
                    Section(copy("كيف كانت التلاوة؟", "How was the recitation?")) {
                        resultButton(.excellent, ar: "ممتاز", en: "Excellent", identifier: "memo-review-excellent")
                        resultButton(.good, ar: "جيد", en: "Good", identifier: "memo-review-good")
                        resultButton(.mistakes, ar: "أخطاء", en: "Mistakes", identifier: "memo-review-mistakes")
                        resultButton(.forgot, ar: "لم أتذكر", en: "Could not recall", identifier: "memo-review-forgot")
                    }
                    Section {
                        Text(verbatim: copy("المراجعة لا تغيّر حالة الحفظ، بل تحدد موعد المراجعة القادمة.",
                                            "A review never changes the memorization status; it only schedules the next review."))
                            .font(.footnote).foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle(copy("مراجعة", "Review"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button(copy("إغلاق", "Close")) { dismiss() } } }
            .alert(copy("تعذرت المراجعة", "Could not review"),
                   isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
                Button(copy("حسنًا", "OK"), role: .cancel) {}
            } message: {
                Text(verbatim: errorMessage ?? "")
            }
        }
        .environment(\.layoutDirection, language.layoutDirection)
        .presentationDetents([.large])
        .presentationSizing(.page)
    }

    private func resultButton(_ result: ReviewResult, ar: String, en: String, identifier: String) -> some View {
        Button {
            let plan = store.reviewPlan(selection, label: title, result: result)
            do {
                let applied = try store.apply(plan)
                onFinished(applied, plan)
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
        } label: {
            HStack {
                Text(verbatim: copy(ar, en))
                Spacer()
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
    }

    private func copy(_ ar: String, _ en: String) -> String { language == .arabic ? ar : en }
}

struct ReviewRequest: Identifiable {
    let id = UUID()
    let selection: MemorizationSelection
    let title: String
}
