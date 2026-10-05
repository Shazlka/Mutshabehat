#if DEBUG
import MushafCore
import SwiftUI

struct SameWordView: View {
    @Bindable var store: ReviewStore
    let verifiedOnly: Bool
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Toggle("معتمدة فقط لنفس الباب", isOn: $store.sameWordVerifiedOnly)
                    .accessibilityIdentifier("review-same-word-verified-only")
                    .disabled(store.copying)
                    .onChange(of: store.sameWordVerifiedOnly) { _, _ in store.previewMatch = nil }
                if let row = store.previewMatch {
                    Section("معاينة النسخ — سيُضاف وجه غير معتمد") {
                        SameWordPreview(row: row)
                            .accessibilityIdentifier("review-copy-preview")
                        Button {
                            Task { if await store.confirmCopy() { dismiss() } }
                        } label: { Label("تأكيد النسخ", systemImage: "doc.on.doc.fill") }
                        .disabled(store.copying)
                        .accessibilityIdentifier("review-copy-confirm")
                        Button("رجوع") { store.previewMatch = nil }
                            .disabled(store.copying)
                            .accessibilityIdentifier("review-copy-back")
                    }
                } else {
                    switch store.sameWordState {
                    case .loading: ProgressView("جارٍ البحث…")
                    case .failed(let message): Text(message).foregroundStyle(.red)
                    case .idle:
                        if store.visibleSameWordMatches.isEmpty { Text("لا توجد أوجه مطابقة").foregroundStyle(.secondary) }
                    }
                    ForEach(store.visibleSameWordMatches) { row in
                        Button { store.previewMatch = row } label: { SameWordPreview(row: row) }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("review-same-word-match-\(row.entryId)")
                    }
                }
                if let notice = store.notice { Text(notice).foregroundStyle(.red).font(.footnote) }
            }
            .navigationTitle("نسخ من نفس الكلمة")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("إغلاق") { dismiss() }.disabled(store.copying)
                        .accessibilityIdentifier("review-same-word-close")
                }
            }
        }
        .environment(\.layoutDirection, .rightToLeft)
        .interactiveDismissDisabled(store.copying)
        .task { await store.loadSameWord(verifiedOnly: verifiedOnly) }
        .onDisappear { store.previewMatch = nil }
    }
}

/// Shows the configuration before the reviewer confirms creating a new copy.
private struct SameWordPreview: View {
    let row: ReviewRow

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("\(row.surah):\(row.ayah):\(row.startWord)").font(.caption).foregroundStyle(.secondary)
            Text(row.kind == .usul ? "أصول" : "فرش").font(.caption.weight(.bold))
            Text(FacesSummary.label(for: row)).font(.headline)
            if let text = row.readingText { Text(text).font(.title3) }
            if let text = row.uthmaniText, text != row.readingText { Text(text) }
            if let text = row.description { Text(text).font(.footnote) }
            if let text = row.performanceNote { Text(text).font(.footnote) }
            if let text = row.rulingText { Text(text).font(.footnote) }
            if let type = VariantType.canonical.first(where: { $0.dbEnum == row.variantType }) { Text(type.label).font(.caption) }
            if let detail = row.hamzahDetail { Text(hamzahText(detail)).font(.footnote) }
            NarratorChipsView(items: NarratorDisplay.describe(row.narrators.map { NarratorRef(id: $0.id, nameAr: $0.nameAr) }))
            ForEach(Array(row.narrators.enumerated()), id: \.offset) { _, narrator in
                Text("\(CanonicalReaders.narratorName(narrator.id) ?? narrator.nameAr) — الوجه \(narrator.wajhOrder)\(narrator.action.map { " — \($0)" } ?? "")\(narrator.wajhNote.map { " — \($0)" } ?? "")")
                    .font(.footnote)
            }
            Text(row.appliesWasl && row.appliesWaqf ? "وصلًا ووقفًا" : row.appliesWasl ? "وصلًا فقط" : "وقفًا فقط")
                .font(.caption).foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }

    private func hamzahText(_ detail: HamzahDetail) -> String {
        switch detail {
        case .single(let treatment): return treatment.rawValue
        case .kalima(let first, let second, let idkhal):
            return "الأولى: \(first.rawValue) — الثانية: \(second.rawValue)" + (idkhal == true ? " — إدخال ألف" : "")
        case .kalimatayn(let relation, let first, let second, let isqatFirst, let isqatSecond, let madd, _):
            return [relation.rawValue, "الأولى: \(first.rawValue)", "الثانية: \(second.rawValue)",
                    isqatFirst == true ? "إسقاط الأولى" : nil, isqatSecond == true ? "إسقاط الثانية" : nil,
                    madd == true ? "إبدال مع المد" : nil].compactMap { $0 }.joined(separator: " — ")
        }
    }

}
#endif
