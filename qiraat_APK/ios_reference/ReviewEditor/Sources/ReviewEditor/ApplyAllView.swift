#if DEBUG
import MushafCore
import SwiftUI

struct ApplyAllView: View {
    @Bindable var store: ReviewStore
    let row: ReviewRow
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text(FacesSummary.label(for: row)).font(.headline)
                    Text("تُضاف الأوجه إلى المواضع المحددة غير معتمدة، وبحاجة لمراجعة.").font(.footnote).foregroundStyle(.secondary)
                }
                switch store.occurrencesState {
                case .loading: ProgressView("جارٍ البحث…")
                case .failed(let message): Text(message).foregroundStyle(.red)
                case .idle:
                    if store.occurrences.isEmpty { Text("لا توجد مواضع أخرى").foregroundStyle(.secondary) }
                }
                ForEach(store.occurrences) { occurrence in
                    Toggle(isOn: Binding(
                        get: { store.selectedOccurrences.contains(occurrence.canonicalKey) },
                        set: { selected in
                            if selected { store.selectedOccurrences.insert(occurrence.canonicalKey) }
                            else { store.selectedOccurrences.remove(occurrence.canonicalKey) }
                        })) {
                        VStack(alignment: .leading) {
                            Text(occurrence.text)
                            Text("\(occurrence.surah):\(occurrence.ayah):\(occurrence.word) — \(occurrence.status == .exists ? "موجود مسبقًا" : "إضافة")")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    .disabled(occurrence.status == .exists || store.applyingOccurrences || store.lastBulkResult != nil)
                    .accessibilityIdentifier("review-occurrence-\(occurrence.canonicalKey)")
                }
                Button {
                    Task { await store.applyToSelected(sourceEntryId: row.entryId) }
                } label: { Label("تطبيق على المحدد", systemImage: "checkmark.circle") }
                .disabled(store.applyingOccurrences || store.lastBulkResult != nil || !store.occurrences.contains {
                    $0.status == .add && store.selectedOccurrences.contains($0.canonicalKey)
                })
                .accessibilityIdentifier("review-apply-selected")
                if let result = store.lastBulkResult {
                    Section("نتيجة التطبيق") {
                        Text("أُضيف: \(result.added.count) — موجود مسبقًا: \(result.skipped.count) — أخطاء: \(result.errors.count)")
                            .accessibilityIdentifier("review-bulk-result")
                        ForEach(Array(result.errors.enumerated()), id: \.offset) { _, error in
                            Text("\(error.surah):\(error.ayah):\(error.word) — \(error.message)").foregroundStyle(.red)
                        }
                    }
                }
                if let notice = store.notice { Text(notice).font(.footnote).foregroundStyle(.red) }
            }
            .navigationTitle("تطبيق على كل المواضع")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("إغلاق") { dismiss() }.disabled(store.applyingOccurrences)
                        .accessibilityIdentifier("review-apply-all-close")
                }
            }
        }
        .environment(\.layoutDirection, .rightToLeft)
        .interactiveDismissDisabled(store.applyingOccurrences)
        .task { await store.loadOccurrences(for: row) }
    }
}
#endif
